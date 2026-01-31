import { IsOptional, IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RateLimitTier } from '@prisma/client';

export class RateLimitLogQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(RateLimitTier)
  tier?: RateLimitTier;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'requestCount' | 'tier' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class RateLimitPenaltyQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(RateLimitTier)
  tier?: RateLimitTier;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  activeOnly?: string; // "true" or "false"
}

export class RateLimitLogResponseDto {
  id: string;
  userId: string | null;
  username?: string | null;
  ipAddress: string;
  endpoint: string;
  action: string;
  tier: RateLimitTier;
  requestCount: number;
  windowSize: number;
  intervalVariance: number | null;
  avgInterval: number | null;
  createdAt: Date;
  windowStart: Date;
}

export class RateLimitPenaltyResponseDto {
  id: string;
  userId: string | null;
  username?: string | null;
  ipAddress: string;
  tier: RateLimitTier;
  reason: string;
  startedAt: Date;
  expiresAt: Date;
  violationCount: number;
  isActive: boolean;
}

export class PaginatedLogsResponseDto {
  data: RateLimitLogResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class PaginatedPenaltiesResponseDto {
  data: RateLimitPenaltyResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
