import { Module } from '@nestjs/common'
import { ReportsController, AdminReportsController } from './reports.controller'
import { ReportsService } from './reports.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
