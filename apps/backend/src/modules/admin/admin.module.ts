import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminCacheController } from './controllers/admin-cache.controller'
import { AdminService } from './admin.service'
import { AdminActivityDeliveriesService } from './services/admin-activity-deliveries.service'
import { PrismaModule } from '../prisma/prisma.module'
import { FederationModule } from '../federation/federation.module'

@Module({
  imports: [PrismaModule, FederationModule],
  controllers: [AdminController, AdminCacheController],
  providers: [AdminService, AdminActivityDeliveriesService],
  exports: [AdminService],
})
export class AdminModule {}
