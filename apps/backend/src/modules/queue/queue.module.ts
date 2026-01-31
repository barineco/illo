import { Module, Global } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { ConfigModule, ConfigService } from '@nestjs/config'

export const ACTIVITY_DELIVERY_QUEUE = 'activity-delivery'
export const REMOTE_IMAGE_CACHE_QUEUE = 'remote-image-cache'

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: false, // Keep failed jobs for inspection
        },
      }),
    }),
    BullModule.registerQueue({
      name: ACTIVITY_DELIVERY_QUEUE,
    }),
    BullModule.registerQueue({
      name: REMOTE_IMAGE_CACHE_QUEUE,
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
