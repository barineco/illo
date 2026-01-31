import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { ACTIVITY_DELIVERY_QUEUE } from '../../queue/queue.module'
import { ACTIVITY_DELIVERY_JOB_OPTIONS } from '../../queue/backoff-strategies'
import { ActivityDeliveryJobData } from '../../federation/interfaces/activity-delivery-job.interface'
import { ActivityDeliveryStatus } from '@prisma/client'

interface GetDeliveriesOptions {
  status?: ActivityDeliveryStatus
  activityType?: string
  page: number
  limit: number
}

@Injectable()
export class AdminActivityDeliveriesService {
  private readonly logger = new Logger(AdminActivityDeliveriesService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(ACTIVITY_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<ActivityDeliveryJobData>,
  ) {}

  async getDeliveries(options: GetDeliveriesOptions) {
    const { status, activityType, page, limit } = options
    const skip = (page - 1) * limit

    const where: {
      status?: ActivityDeliveryStatus
      activityType?: string
    } = {}
    if (status) where.status = status
    if (activityType) where.activityType = activityType

    const [deliveries, total] = await Promise.all([
      this.prisma.activityDeliveryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityDeliveryLog.count({ where }),
    ])

    // Fetch sender info for each delivery
    const senderIds = [...new Set(deliveries.map((d) => d.senderId))]
    const senders = await this.prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, username: true, displayName: true, domain: true },
    })
    const senderMap = new Map(senders.map((s) => [s.id, s]))

    const enrichedDeliveries = deliveries.map((d) => ({
      ...d,
      sender: senderMap.get(d.senderId) || null,
      // Exclude full activityPayload from list view
      activityPayload: undefined,
    }))

    return {
      deliveries: enrichedDeliveries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getDeliveryById(id: string) {
    const delivery = await this.prisma.activityDeliveryLog.findUnique({
      where: { id },
    })

    if (!delivery) {
      throw new NotFoundException('Delivery log not found')
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: delivery.senderId },
      select: { id: true, username: true, displayName: true, domain: true },
    })

    return {
      ...delivery,
      sender,
    }
  }

  async getDeliveryStats() {
    const [pending, delivered, failed, byType] = await Promise.all([
      this.prisma.activityDeliveryLog.count({ where: { status: 'PENDING' } }),
      this.prisma.activityDeliveryLog.count({ where: { status: 'DELIVERED' } }),
      this.prisma.activityDeliveryLog.count({ where: { status: 'FAILED' } }),
      this.prisma.activityDeliveryLog.groupBy({
        by: ['activityType'],
        _count: true,
      }),
    ])

    return {
      pending,
      delivered,
      failed,
      total: pending + delivered + failed,
      byType: byType.map((t) => ({ type: t.activityType, count: t._count })),
    }
  }

  async retryDelivery(id: string) {
    const delivery = await this.prisma.activityDeliveryLog.findUnique({
      where: { id },
    })

    if (!delivery) {
      throw new NotFoundException('Delivery log not found')
    }

    if (delivery.status !== 'FAILED') {
      throw new BadRequestException('Can only retry failed deliveries')
    }

    // Reset status and queue new job
    await this.prisma.activityDeliveryLog.update({
      where: { id },
      data: {
        status: 'PENDING',
        attemptCount: 0,
        lastError: null,
      },
    })

    const job = await this.deliveryQueue.add(
      `retry-${delivery.activityType}-${id}`,
      {
        deliveryLogId: id,
        senderId: delivery.senderId,
        inboxUrl: delivery.inboxUrl,
        activity: delivery.activityPayload as Record<string, unknown>,
        activityType: delivery.activityType,
      },
      ACTIVITY_DELIVERY_JOB_OPTIONS,
    )

    await this.prisma.activityDeliveryLog.update({
      where: { id },
      data: { bullmqJobId: job.id },
    })

    this.logger.log(`Queued retry for delivery ${id} (job: ${job.id})`)

    return { success: true, jobId: job.id }
  }

  async retryAllFailed() {
    const failedDeliveries = await this.prisma.activityDeliveryLog.findMany({
      where: { status: 'FAILED' },
      take: 100, // Limit to prevent overload
    })

    let queued = 0
    for (const delivery of failedDeliveries) {
      try {
        await this.retryDelivery(delivery.id)
        queued++
      } catch (error) {
        this.logger.error(`Failed to queue retry for ${delivery.id}: ${error}`)
      }
    }

    return {
      success: true,
      totalFailed: failedDeliveries.length,
      queued,
    }
  }
}
