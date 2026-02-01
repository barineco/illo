import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HeadlessDetectionService } from './headless-detection.service';
import { HeadlessDetectionGuard } from './headless-detection.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [HeadlessDetectionService, HeadlessDetectionGuard],
  exports: [HeadlessDetectionService, HeadlessDetectionGuard],
})
export class HeadlessDetectionModule {}
