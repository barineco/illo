import { IsBoolean, IsNumber, IsOptional, Min, Max } from 'class-validator'

export class UpdateCacheSettingsDto {
  @IsOptional()
  @IsBoolean()
  remoteImageCacheEnabled?: boolean

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  remoteImageCacheTtlDays?: number

  @IsOptional()
  @IsBoolean()
  remoteImageAutoCache?: boolean

  @IsOptional()
  @IsBoolean()
  cachePriorityEnabled?: boolean

  @IsOptional()
  @IsNumber()
  @Min(1)
  cachePriorityThreshold?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  cacheTtlMultiplierTier1?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  cacheTtlMultiplierTier2?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  cacheTtlMultiplierTier3?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  cacheLikeTier1?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  cacheLikeTier2?: number

  @IsOptional()
  @IsNumber()
  @Min(1)
  cacheLikeTier3?: number
}
