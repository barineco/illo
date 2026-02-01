import {
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class UpdateRateLimitConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(300)
  windowSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  softLimitPerWindow?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  hardLimitPerWindow?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000)
  softLimitPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(2000)
  hardLimitPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1)
  cvSoftThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1)
  cvHardThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  softPenaltyMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(240)
  hardPenaltyMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  maxPenaltyMinutes?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // Composite score thresholds (new algorithm)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  hardLimitScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  softLimitScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  warningScore?: number;

  // Minimum sample size for pattern analysis
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  minSamplesAnonymous?: number;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  minSamplesUser?: number;

  // Instant detection (for obvious automation)
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(30000)
  instantDetectionIntervalMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  instantDetectionCV?: number;

  // Rollout control
  @IsOptional()
  @IsBoolean()
  measurementMode?: boolean;

  @IsOptional()
  @IsBoolean()
  useCompositeScore?: boolean;

  // No real interaction detection (headless browser integration)
  @IsOptional()
  @IsBoolean()
  noInteractionEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  noInteractionThresholdMultiplier?: number;
}

export class RateLimitConfigResponseDto {
  id: string;
  windowSeconds: number;
  softLimitPerWindow: number;
  hardLimitPerWindow: number;
  softLimitPerHour: number;
  hardLimitPerHour: number;
  cvSoftThreshold: number;
  cvHardThreshold: number;
  softPenaltyMinutes: number;
  hardPenaltyMinutes: number;
  maxPenaltyMinutes: number;
  enabled: boolean;
  // Composite score thresholds (new algorithm)
  hardLimitScore: number;
  softLimitScore: number;
  warningScore: number;
  minSamplesAnonymous: number;
  minSamplesUser: number;
  instantDetectionIntervalMs: number;
  instantDetectionCV: number;
  measurementMode: boolean;
  useCompositeScore: boolean;
  // No real interaction detection (headless browser integration)
  noInteractionEnabled: boolean;
  noInteractionThresholdMultiplier: number;
  updatedAt: Date;
  updatedBy: string | null;
}
