import { IsEnum, IsOptional, IsString } from 'class-validator'
import { ReportType, ReportStatus } from '@prisma/client'

export class ReportQueryDto {
  @IsEnum(ReportType)
  @IsOptional()
  type?: ReportType

  @IsEnum(ReportStatus)
  @IsOptional()
  status?: ReportStatus

  @IsString()
  @IsOptional()
  page?: string = '1'

  @IsString()
  @IsOptional()
  limit?: string = '20'
}
