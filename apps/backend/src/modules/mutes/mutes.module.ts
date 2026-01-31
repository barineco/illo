import { Module } from '@nestjs/common'
import { MutesController } from './mutes.controller'
import { MutesService } from './mutes.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [MutesController],
  providers: [MutesService],
  exports: [MutesService],
})
export class MutesModule {}
