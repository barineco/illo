import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Logger, Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { HttpSignatureService } from '../services/http-signature.service'
import { ACTIVITY_DELIVERY_QUEUE } from '../../queue/queue.module'
import {
  ActivityDeliveryJobData,
  ActivityDeliveryResult,
} from '../interfaces/activity-delivery-job.interface'

@Injectable()
@Processor(ACTIVITY_DELIVERY_QUEUE)
export class ActivityDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityDeliveryProcessor.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpSignature: HttpSignatureService,
  ) {
    super()
  }

  async process(job: Job<ActivityDeliveryJobData>): Promise<ActivityDeliveryResult> {
    const { deliveryLogId, senderId, inboxUrl, activity, activityType } = job.data

    this.logger.log(
      `Processing ${activityType} delivery to ${inboxUrl} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    )

    // Fetch sender for signing
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
    })

    if (!sender?.privateKey) {
      const error = `Sender ${senderId} not found or has no private key`
      this.logger.error(error)
      await this.updateDeliveryLogFailed(deliveryLogId, error)
      throw new Error(error)
    }

    try {
      await this.attemptDelivery(sender, inboxUrl, activity)

      // Update delivery log on success
      await this.prisma.activityDeliveryLog.update({
        where: { id: deliveryLogId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
          attemptCount: job.attemptsMade + 1,
          lastAttemptAt: new Date(),
          lastError: null,
        },
      })

      this.logger.log(`Successfully delivered ${activityType} to ${inboxUrl}`)
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Update attempt count and error
      await this.prisma.activityDeliveryLog.update({
        where: { id: deliveryLogId },
        data: {
          attemptCount: job.attemptsMade + 1,
          lastAttemptAt: new Date(),
          lastError: errorMessage,
        },
      })

      this.logger.warn(`Delivery attempt failed: ${errorMessage}`)
      throw error // Re-throw to trigger BullMQ retry
    }
  }

  private async attemptDelivery(
    sender: { username: string; privateKey: string },
    inboxUrl: string,
    activity: Record<string, unknown>,
  ): Promise<void> {
    const publicUrl = this.configService.get<string>('PUBLIC_URL', 'http://localhost:11104')
    const keyId = `${publicUrl}/users/${sender.username}#main-key`

    const url = new URL(inboxUrl)
    const path = url.pathname + url.search
    const host = url.host

    const body = JSON.stringify(activity)
    const signatureHeaders = await this.httpSignature.signRequest({
      keyId,
      privateKeyPem: sender.privateKey,
      method: 'POST',
      path,
      headers: { host },
      body,
    })

    const response = await fetch(inboxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/activity+json',
        Accept: 'application/activity+json',
        Host: host,
        Date: signatureHeaders.date,
        Signature: signatureHeaders.signature,
        ...(signatureHeaders.digest ? { Digest: signatureHeaders.digest } : {}),
      },
      body,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`)
    }
  }

  private async updateDeliveryLogFailed(id: string, error: string): Promise<void> {
    await this.prisma.activityDeliveryLog.update({
      where: { id },
      data: {
        status: 'FAILED',
        lastError: error,
        lastAttemptAt: new Date(),
      },
    })
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ActivityDeliveryJobData>, error: Error): Promise<void> {
    const { deliveryLogId, activityType, inboxUrl } = job.data
    const maxAttempts = job.opts.attempts || 4

    // Check if this is the final failure (all retries exhausted)
    if (job.attemptsMade >= maxAttempts) {
      this.logger.error(
        `Final failure for ${activityType} to ${inboxUrl}: ${error.message}`,
      )

      await this.prisma.activityDeliveryLog.update({
        where: { id: deliveryLogId },
        data: {
          status: 'FAILED',
          lastError: `All ${job.attemptsMade} attempts failed. Last error: ${error.message}`,
        },
      })
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ActivityDeliveryJobData>): void {
    this.logger.log(`Job ${job.id} completed for ${job.data.activityType}`)
  }
}
