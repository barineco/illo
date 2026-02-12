import { Module } from '@nestjs/common'
import { OCsController } from './ocs.controller'
import { OCsService } from './ocs.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [OCsController],
  providers: [OCsService],
  exports: [OCsService],
})
export class OCsModule {}
