import { Module } from '@nestjs/common'
import { InstanceController } from './instance.controller'
import { InstanceService } from './instance.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [InstanceController],
  providers: [InstanceService],
  exports: [InstanceService],
})
export class InstanceModule {}
