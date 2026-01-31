import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator'
import { ReportType, ReportReason } from '@prisma/client'

export class CreateReportDto {
  @IsEnum(ReportType)
  @IsNotEmpty()
  type: ReportType

  @IsEnum(ReportReason)
  @IsNotEmpty()
  reason: ReportReason

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string

  // Target ID (artworkId, userId, or commentId based on type)
  @IsString()
  @IsOptional()
  artworkId?: string

  @IsString()
  @IsOptional()
  targetUserId?: string

  @IsString()
  @IsOptional()
  commentId?: string
}
