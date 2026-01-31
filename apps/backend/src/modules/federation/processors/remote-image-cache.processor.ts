import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { REMOTE_IMAGE_CACHE_QUEUE } from '../../queue/queue.module'
import { RemoteImageCacheService } from '../services/remote-image-cache.service'
import { RemoteAvatarCacheService } from '../services/remote-avatar-cache.service'

export interface CacheImageJobData {
  type: 'artwork_image' | 'avatar' | 'cleanup'
  artworkImageId?: string
  userId?: string
}

@Processor(REMOTE_IMAGE_CACHE_QUEUE)
export class RemoteImageCacheProcessor extends WorkerHost {
  private readonly logger = new Logger(RemoteImageCacheProcessor.name)

  constructor(
    private readonly remoteImageCacheService: RemoteImageCacheService,
    private readonly remoteAvatarCacheService: RemoteAvatarCacheService,
  ) {
    super()
  }

  async process(job: Job<CacheImageJobData>): Promise<any> {
    const { type } = job.data

    this.logger.debug(`Processing cache job: ${job.id} (type: ${type})`)

    try {
      switch (type) {
        case 'artwork_image':
          return await this.processArtworkImageCache(job)
        case 'avatar':
          return await this.processAvatarCache(job)
        case 'cleanup':
          return await this.processCleanup(job)
        default:
          throw new Error(`Unknown cache job type: ${type}`)
      }
    } catch (error) {
      this.logger.error(`Cache job failed: ${job.id}`, error)
      throw error
    }
  }

  private async processArtworkImageCache(job: Job<CacheImageJobData>): Promise<any> {
    const { artworkImageId } = job.data

    if (!artworkImageId) {
      throw new Error('Missing artworkImageId for artwork_image job')
    }

    const result = await this.remoteImageCacheService.cacheRemoteImage(artworkImageId)

    if (result.success) {
      this.logger.log(`Cached artwork image: ${artworkImageId}`)
    } else {
      this.logger.warn(`Failed to cache artwork image: ${artworkImageId} - ${result.error}`)
    }

    return result
  }

  private async processAvatarCache(job: Job<CacheImageJobData>): Promise<any> {
    const { userId } = job.data

    if (!userId) {
      throw new Error('Missing userId for avatar job')
    }

    const result = await this.remoteAvatarCacheService.cacheAvatar(userId)

    if (result.success) {
      this.logger.log(`Cached avatar for user: ${userId}`)
    } else {
      this.logger.warn(`Failed to cache avatar: ${userId} - ${result.error}`)
    }

    return result
  }

  private async processCleanup(job: Job<CacheImageJobData>): Promise<any> {
    this.logger.log('Running cache cleanup...')

    const result = await this.remoteImageCacheService.cleanupExpiredCache()

    this.logger.log(
      `Cleanup completed: ${result.deletedImages} images, ${result.deletedAvatars} avatars, ${result.freedBytes} bytes freed`,
    )

    return result
  }
}
