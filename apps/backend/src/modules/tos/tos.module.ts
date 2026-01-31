import { Module } from '@nestjs/common'
import { TosController } from './tos.controller'
import { TosService } from './tos.service'
import { PrismaModule } from '../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [TosController],
  providers: [TosService],
  exports: [TosService],
})
export class TosModule {}
