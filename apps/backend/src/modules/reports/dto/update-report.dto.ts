import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator'
import { ReportStatus } from '@prisma/client'

export class UpdateReportDto {
  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  adminNotes?: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  adminAction?: string
}
