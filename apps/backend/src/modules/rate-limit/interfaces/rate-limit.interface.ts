import { RateLimitTier } from '@prisma/client';

export interface RateLimitIdentifier {
  userId?: string;
  ipAddress: string;
}

export interface CompositeRiskScore {
  score: number; // 0-100 の危険度スコア
  factors: {
    intervalScore: number; // 平均間隔からのスコア (0-50)
    regularityScore: number; // CV（規則性）からのスコア (0-50)
  };
  avgIntervalMs: number;
  cv: number;
  sampleSize: number;
}

export interface RateLimitStatus {
  tier: RateLimitTier;
  degradeQuality: boolean;
  penaltyExpiresAt?: Date;
  reason?: string;
  requestsInWindow?: number;
  requestsInHour?: number;
  riskScore?: CompositeRiskScore;
  detectionReason?: string;
}

export interface PatternAnalysis {
  intervalCV: number; // Coefficient of Variation
  avgInterval: number | null; // Average interval in milliseconds
  sampleSize: number;
}

export interface RateLimitConfig {
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
  // 複合スコア閾値（新規）
  hardLimitScore: number;
  softLimitScore: number;
  warningScore: number;
  // 最低サンプル数（新規）
  minSamplesAnonymous: number;
  minSamplesUser: number;
  // 即時検知条件（新規）
  instantDetectionIntervalMs: number;
  instantDetectionCV: number;
  // ロールアウト制御（新規）
  measurementMode: boolean;
  useCompositeScore: boolean;
  // インタラクション検出連携（新規）
  noInteractionEnabled: boolean;
  noInteractionThresholdMultiplier: number;
}

export interface RateLimitDecoratorOptions {
  action: string;
  skipPatternAnalysis?: boolean;
}

export interface RateLimitStats {
  totalLogs: number;
  logsByTier: {
    NORMAL: number;
    WARNING: number;
    SOFT_LIMIT: number;
    HARD_LIMIT: number;
  };
  activePenalties: number;
  uniqueIPs: number;
  uniqueUsers: number;
  last24Hours: {
    logs: number;
    penalties: number;
  };
}
