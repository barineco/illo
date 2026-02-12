import { Type } from 'class-transformer'
import { IsOptional, IsInt, Min, Max, IsBoolean, IsEnum, IsString } from 'class-validator'
import { FanArtPermission } from '@prisma/client'

export class OCQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  fanArtWelcome?: boolean

  @IsEnum(FanArtPermission)
  @IsOptional()
  fanArtPermission?: FanArtPermission

  @IsString()
  @IsOptional()
  search?: string
}
