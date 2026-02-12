import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitTier } from '@prisma/client';
import {
  RateLimitIdentifier,
  RateLimitStatus,
  PatternAnalysis,
  RateLimitConfig,
  RateLimitStats,
  CompositeRiskScore,
} from './interfaces/rate-limit.interface';
import { UpdateRateLimitConfigDto } from './dto/rate-limit-config.dto';
import {
  RateLimitLogQueryDto,
  RateLimitPenaltyQueryDto,
} from './dto/rate-limit-log-query.dto';

const CONFIG_CACHE_TTL = 300; // 5 minutes
const CONFIG_CACHE_KEY = 'ratelimit:config';
const PATTERN_SAMPLE_SIZE = 100;

@Injectable()
export class RateLimitService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitService.name);
  private redis: Redis;
  private configCache: RateLimitConfig | null = null;
  private configCacheExpiry: number = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      this.logger.log('Redis connected for rate limiting');
    } catch (error) {
      this.logger.error('Failed to connect to Redis for rate limiting', error);
    }
  }

  /**
   * Main entry point for checking rate limits
   */
  async checkRateLimit(
    identifier: RateLimitIdentifier,
    action: string,
    artworkId?: string,
    hasRealInteraction?: boolean,
  ): Promise<RateLimitStatus> {
    const config = await this.getConfig();

    // Even if rate limiting is disabled, apply interaction-based degradation if enabled
    if (!config.enabled) {
      if (config.noInteractionEnabled && hasRealInteraction === false) {
        // Log this detection (without full rate limit processing)
        this.logInteractionOnlyDetection(identifier, action);
        return {
          tier: RateLimitTier.SOFT_LIMIT,
          degradeQuality: true,
          reason: 'no_real_interaction',
        };
      }
      return { tier: RateLimitTier.NORMAL, degradeQuality: false };
    }

    // Check for active penalty first (fast path)
    const penalty = await this.getActivePenalty(identifier);
    if (penalty) {
      return {
        tier: penalty.tier,
        degradeQuality:
          penalty.tier === RateLimitTier.SOFT_LIMIT ||
          penalty.tier === RateLimitTier.HARD_LIMIT,
        penaltyExpiresAt: penalty.expiresAt,
        reason: penalty.reason,
      };
    }

    const key = this.buildKey(identifier, action);
    const now = Date.now();

    if (artworkId) {
      await this.recordRequest(key, now, artworkId, config.windowSeconds);
    }

    const [countPerWindow, countPerHour] = await Promise.all([
      this.getRequestCount(key, config.windowSeconds),
      this.getRequestCount(key, 3600),
    ]);

    const patternAnalysis = await this.analyzeRequestPattern(identifier, action);
    const isAnonymous = !identifier.userId;

    let tier: RateLimitTier;
    let riskScore: CompositeRiskScore | undefined;
    let detectionReason: string | undefined;

    if (config.useCompositeScore) {
      const result = this.determineTierV2(
        countPerWindow,
        countPerHour,
        patternAnalysis,
        config,
        isAnonymous,
        hasRealInteraction,
      );
      tier = result.tier;
      riskScore = result.riskScore;
      detectionReason = result.reason;
    } else {
      tier = this.determineTier(
        countPerWindow,
        countPerHour,
        patternAnalysis,
        config,
        isAnonymous,
      );
    }

    // Measurement mode: log everything but don't apply penalties
    if (config.measurementMode) {
      // Always log in measurement mode (including NORMAL)
      await this.logRateLimitEventV2(
        identifier,
        action,
        tier,
        countPerWindow,
        config.windowSeconds,
        patternAnalysis,
        riskScore,
        `measurement:${detectionReason || 'legacy'}`,
        isAnonymous,
        hasRealInteraction,
      );
      return {
        tier: RateLimitTier.NORMAL, // Always return NORMAL in measurement mode
        degradeQuality: false,
        requestsInWindow: countPerWindow,
        requestsInHour: countPerHour,
        riskScore,
        detectionReason: `measurement:${detectionReason || 'legacy'}`,
      };
    }

    // Apply penalty if needed
    if (tier === RateLimitTier.SOFT_LIMIT || tier === RateLimitTier.HARD_LIMIT) {
      await this.applyPenalty(identifier, tier, action, config);
    }

    // Log if not NORMAL
    if (tier !== RateLimitTier.NORMAL) {
      await this.logRateLimitEventV2(
        identifier,
        action,
        tier,
        countPerWindow,
        config.windowSeconds,
        patternAnalysis,
        riskScore,
        detectionReason,
        isAnonymous,
        hasRealInteraction,
      );
    }

    return {
      tier,
      degradeQuality:
        tier === RateLimitTier.SOFT_LIMIT || tier === RateLimitTier.HARD_LIMIT,
      requestsInWindow: countPerWindow,
      requestsInHour: countPerHour,
      riskScore,
      detectionReason,
    };
  }

  /**
   * Get cached config or fetch from database
   */
  async getConfig(): Promise<RateLimitConfig> {
    const now = Date.now();
    if (this.configCache && this.configCacheExpiry > now) {
      return this.configCache;
    }

    // Try Redis cache first
    const cachedConfig = await this.redis.hgetall(CONFIG_CACHE_KEY);
    if (cachedConfig && Object.keys(cachedConfig).length > 0) {
      this.configCache = this.parseConfigFromRedis(cachedConfig);
      this.configCacheExpiry = now + CONFIG_CACHE_TTL * 1000;
      return this.configCache;
    }

    // Fetch from database
    let dbConfig = await this.prisma.rateLimitConfig.findFirst();
    if (!dbConfig) {
      // Create default config with environment variable overrides
      dbConfig = await this.prisma.rateLimitConfig.create({
        data: {
          measurementMode: this.configService.get('RATE_LIMIT_MEASUREMENT_MODE', 'false') === 'true',
          useCompositeScore: this.configService.get('RATE_LIMIT_USE_COMPOSITE_SCORE', 'false') === 'true',
          hardLimitScore: parseFloat(this.configService.get('RATE_LIMIT_HARD_SCORE', '90')),
          softLimitScore: parseFloat(this.configService.get('RATE_LIMIT_SOFT_SCORE', '50')),
          warningScore: parseFloat(this.configService.get('RATE_LIMIT_WARNING_SCORE', '35')),
        },
      });
    }

    const config: RateLimitConfig = {
      windowSeconds: dbConfig.windowSeconds,
      softLimitPerWindow: dbConfig.softLimitPerWindow,
      hardLimitPerWindow: dbConfig.hardLimitPerWindow,
      softLimitPerHour: dbConfig.softLimitPerHour,
      hardLimitPerHour: dbConfig.hardLimitPerHour,
      cvSoftThreshold: dbConfig.cvSoftThreshold,
      cvHardThreshold: dbConfig.cvHardThreshold,
      softPenaltyMinutes: dbConfig.softPenaltyMinutes,
      hardPenaltyMinutes: dbConfig.hardPenaltyMinutes,
      maxPenaltyMinutes: dbConfig.maxPenaltyMinutes,
      enabled: dbConfig.enabled,
      hardLimitScore: dbConfig.hardLimitScore,
      softLimitScore: dbConfig.softLimitScore,
      warningScore: dbConfig.warningScore,
      minSamplesAnonymous: dbConfig.minSamplesAnonymous,
      minSamplesUser: dbConfig.minSamplesUser,
      instantDetectionIntervalMs: dbConfig.instantDetectionIntervalMs,
      instantDetectionCV: dbConfig.instantDetectionCV,
      measurementMode: dbConfig.measurementMode,
      useCompositeScore: dbConfig.useCompositeScore,
      noInteractionEnabled: dbConfig.noInteractionEnabled,
      noInteractionThresholdMultiplier: dbConfig.noInteractionThresholdMultiplier,
    };

    // Cache in Redis
    await this.cacheConfig(config);
    this.configCache = config;
    this.configCacheExpiry = now + CONFIG_CACHE_TTL * 1000;

    return config;
  }

  /**
   * Update config and invalidate cache
   */
  async updateConfig(
    dto: UpdateRateLimitConfigDto,
    updatedBy: string,
  ): Promise<RateLimitConfig> {
    let dbConfig = await this.prisma.rateLimitConfig.findFirst();
    if (!dbConfig) {
      dbConfig = await this.prisma.rateLimitConfig.create({
        data: { ...dto, updatedBy },
      });
    } else {
      dbConfig = await this.prisma.rateLimitConfig.update({
        where: { id: dbConfig.id },
        data: { ...dto, updatedBy },
      });
    }

    // Invalidate caches
    await this.redis.del(CONFIG_CACHE_KEY);
    this.configCache = null;
    this.configCacheExpiry = 0;

    return this.getConfig();
  }

  /**
   * Record a request in Redis sorted set
   */
  private async recordRequest(
    key: string,
    timestamp: number,
    artworkId: string,
    windowSeconds: number,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    // Use artworkId as member for deduplication within the same artwork
    // Score is the timestamp for time-based expiry
    pipeline.zadd(key, timestamp, `${artworkId}:${timestamp}`);
    // Set TTL
    pipeline.expire(key, windowSeconds + 3700); // Keep for window + 1 hour buffer
    // Also record timestamp for pattern analysis
    const intervalKey = `ratelimit:intervals:${key}`;
    pipeline.lpush(intervalKey, timestamp.toString());
    pipeline.ltrim(intervalKey, 0, PATTERN_SAMPLE_SIZE - 1);
    pipeline.expire(intervalKey, 3600);
    await pipeline.exec();
  }

  /**
   * Get request count using sliding window
   */
  private async getRequestCount(
    key: string,
    windowSeconds: number,
  ): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // Clean old entries and count
    await this.redis.zremrangebyscore(key, 0, windowStart);
    const count = await this.redis.zcount(key, windowStart, now);
    return count;
  }

  /**
   * Analyze request pattern using coefficient of variation
   */
  private async analyzeRequestPattern(
    identifier: RateLimitIdentifier,
    action: string,
  ): Promise<PatternAnalysis> {
    const key = `ratelimit:intervals:${this.buildKey(identifier, action)}`;
    const timestamps = await this.redis.lrange(key, 0, PATTERN_SAMPLE_SIZE - 1);

    if (timestamps.length < 10) {
      return { intervalCV: 1.0, avgInterval: null, sampleSize: timestamps.length };
    }

    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      const interval = parseInt(timestamps[i - 1]) - parseInt(timestamps[i]);
      if (interval > 0) {
        intervals.push(interval);
      }
    }

    if (intervals.length < 5) {
      return { intervalCV: 1.0, avgInterval: null, sampleSize: intervals.length };
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1.0;

    return {
      intervalCV: cv,
      avgInterval: mean,
      sampleSize: intervals.length,
    };
  }

  // ============================================
  // Composite Risk Score Algorithm (New)
  // ============================================

  /**
   * Calculate interval score (0-50 points)
   */
  private calculateIntervalScore(avgIntervalMs: number): number {
    const avgSeconds = avgIntervalMs / 1000;
    if (avgSeconds < 1) return 50;
    if (avgSeconds < 2) return 45;
    if (avgSeconds < 3) return 35;
    if (avgSeconds < 5) return 25;
    if (avgSeconds < 8) return 15;
    if (avgSeconds < 15) return 5;
    return 0;
  }

  /**
   * Calculate regularity score from CV (0-50 points)
   */
  private calculateRegularityScore(cv: number): number {
    if (cv < 0.05) return 50;
    if (cv < 0.10) return 45;
    if (cv < 0.15) return 40;
    if (cv < 0.25) return 30;
    if (cv < 0.40) return 20;
    if (cv < 0.60) return 10;
    if (cv < 0.80) return 5;
    return 0;
  }

  /**
   * Calculate composite risk score
   */
  private calculateRiskScore(
    avgIntervalMs: number,
    cv: number,
    sampleSize: number,
  ): CompositeRiskScore {
    const intervalScore = this.calculateIntervalScore(avgIntervalMs);
    const regularityScore = this.calculateRegularityScore(cv);

    return {
      score: intervalScore + regularityScore,
      factors: { intervalScore, regularityScore },
      avgIntervalMs,
      cv,
      sampleSize,
    };
  }

  /**
   * New algorithm: Determine tier using composite risk score
   */
  private determineTierV2(
    countPerWindow: number,
    countPerHour: number,
    pattern: PatternAnalysis,
    config: RateLimitConfig,
    isAnonymous: boolean,
    hasRealInteraction?: boolean,
  ): { tier: RateLimitTier; riskScore?: CompositeRiskScore; reason?: string } {
    // Anonymous users have 50% stricter volume limits
    const anonymousMultiplier = isAnonymous ? 0.5 : 1.0;

    const effectiveHardLimitPerWindow = Math.floor(
      config.hardLimitPerWindow * anonymousMultiplier,
    );
    const effectiveHardLimitPerHour = Math.floor(
      config.hardLimitPerHour * anonymousMultiplier,
    );
    const effectiveSoftLimitPerWindow = Math.floor(
      config.softLimitPerWindow * anonymousMultiplier,
    );
    const effectiveSoftLimitPerHour = Math.floor(
      config.softLimitPerHour * anonymousMultiplier,
    );

    // 1. Volume-based hard limit check
    if (
      countPerWindow > effectiveHardLimitPerWindow ||
      countPerHour > effectiveHardLimitPerHour
    ) {
      return { tier: RateLimitTier.HARD_LIMIT, reason: 'volume_hard_limit' };
    }

    // 2. Volume-based soft limit check
    if (
      countPerWindow > effectiveSoftLimitPerWindow ||
      countPerHour > effectiveSoftLimitPerHour
    ) {
      return { tier: RateLimitTier.SOFT_LIMIT, reason: 'volume_soft_limit' };
    }

    // 3. No real interaction detection (immediate trigger)
    // If enabled and no real interaction detected, immediately apply SOFT_LIMIT
    if (
      config.noInteractionEnabled &&
      hasRealInteraction === false // explicitly false, not undefined
    ) {
      return {
        tier: RateLimitTier.SOFT_LIMIT,
        reason: 'no_real_interaction',
      };
    }

    // 4. Instant detection (obvious automation, sample size not required)
    if (
      pattern.avgInterval &&
      pattern.intervalCV < config.instantDetectionCV &&
      pattern.avgInterval < config.instantDetectionIntervalMs
    ) {
      const riskScore = this.calculateRiskScore(
        pattern.avgInterval,
        pattern.intervalCV,
        pattern.sampleSize,
      );
      return {
        tier: RateLimitTier.HARD_LIMIT,
        reason: 'instant_automation_detected',
        riskScore,
      };
    }

    // 5. Check minimum sample size for pattern analysis
    const minSamples = isAnonymous
      ? config.minSamplesAnonymous
      : config.minSamplesUser;
    if (pattern.sampleSize < minSamples || !pattern.avgInterval) {
      return { tier: RateLimitTier.NORMAL, reason: 'insufficient_samples' };
    }

    // 6. Calculate composite risk score
    const riskScore = this.calculateRiskScore(
      pattern.avgInterval,
      pattern.intervalCV,
      pattern.sampleSize,
    );

    // Anonymous users have 10% stricter thresholds
    const thresholdMultiplier = isAnonymous ? 0.9 : 1.0;

    // 7. Pattern-based tier determination
    if (riskScore.score >= config.hardLimitScore * thresholdMultiplier) {
      return { tier: RateLimitTier.HARD_LIMIT, riskScore, reason: 'pattern_hard_limit' };
    }
    if (riskScore.score >= config.softLimitScore * thresholdMultiplier) {
      return { tier: RateLimitTier.SOFT_LIMIT, riskScore, reason: 'pattern_soft_limit' };
    }
    if (riskScore.score >= config.warningScore * thresholdMultiplier) {
      return { tier: RateLimitTier.WARNING, riskScore, reason: 'pattern_warning' };
    }

    return { tier: RateLimitTier.NORMAL, riskScore, reason: 'normal' };
  }

  /**
   * Determine rate limit tier based on volume thresholds
   * Anonymous (non-logged-in) users have stricter limits
   */
  private determineTier(
    countPerWindow: number,
    countPerHour: number,
    _pattern: PatternAnalysis,
    config: RateLimitConfig,
    isAnonymous: boolean = false,
  ): RateLimitTier {
    // Anonymous users have 50% stricter limits
    const anonymousMultiplier = isAnonymous ? 0.5 : 1.0;

    const effectiveSoftLimitPerWindow = Math.floor(config.softLimitPerWindow * anonymousMultiplier);
    const effectiveHardLimitPerWindow = Math.floor(config.hardLimitPerWindow * anonymousMultiplier);
    const effectiveSoftLimitPerHour = Math.floor(config.softLimitPerHour * anonymousMultiplier);
    const effectiveHardLimitPerHour = Math.floor(config.hardLimitPerHour * anonymousMultiplier);

    // Hard limit checks (any one triggers)
    if (
      countPerWindow > effectiveHardLimitPerWindow ||
      countPerHour > effectiveHardLimitPerHour
    ) {
      return RateLimitTier.HARD_LIMIT;
    }

    // Soft limit checks
    if (
      countPerWindow > effectiveSoftLimitPerWindow ||
      countPerHour > effectiveSoftLimitPerHour
    ) {
      return RateLimitTier.SOFT_LIMIT;
    }

    // Warning level (volume)
    const warningWindowThreshold = Math.floor(
      (effectiveSoftLimitPerWindow + effectiveHardLimitPerWindow) / 3,
    );
    const warningHourThreshold = Math.floor(
      (effectiveSoftLimitPerHour + effectiveHardLimitPerHour) / 3,
    );

    if (countPerWindow > warningWindowThreshold || countPerHour > warningHourThreshold) {
      return RateLimitTier.WARNING;
    }

    return RateLimitTier.NORMAL;
  }

  /**
   * Get active penalty from cache or database
   */
  private async getActivePenalty(
    identifier: RateLimitIdentifier,
  ): Promise<{ tier: RateLimitTier; expiresAt: Date; reason: string } | null> {
    const now = Date.now();

    // Check Redis cache for both user and IP
    const keys = [];
    if (identifier.userId) {
      keys.push(`ratelimit:penalty:user:${identifier.userId}`);
    }
    keys.push(`ratelimit:penalty:ip:${identifier.ipAddress}`);

    for (const key of keys) {
      const cached = await this.redis.hgetall(key);
      if (cached && cached.tier && cached.expiresAt) {
        const expiresAt = parseInt(cached.expiresAt);
        if (expiresAt > now) {
          return {
            tier: cached.tier as RateLimitTier,
            expiresAt: new Date(expiresAt),
            reason: cached.reason || 'Rate limit exceeded',
          };
        } else {
          // Expired, clean up
          await this.redis.del(key);
        }
      }
    }

    // Fallback to database
    const penalty = await this.prisma.rateLimitPenalty.findFirst({
      where: {
        OR: [
          identifier.userId ? { userId: identifier.userId } : {},
          { ipAddress: identifier.ipAddress },
        ].filter((o) => Object.keys(o).length > 0),
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
    });

    if (penalty) {
      // Cache it
      await this.cachePenalty(identifier, penalty.tier, penalty.expiresAt, penalty.reason);
      return {
        tier: penalty.tier,
        expiresAt: penalty.expiresAt,
        reason: penalty.reason,
      };
    }

    return null;
  }

  /**
   * Apply penalty with escalation
   */
  private async applyPenalty(
    identifier: RateLimitIdentifier,
    tier: RateLimitTier,
    action: string,
    config: RateLimitConfig,
  ): Promise<void> {
    // Check for recent penalties for escalation
    const recentPenalty = await this.prisma.rateLimitPenalty.findFirst({
      where: {
        OR: [
          identifier.userId ? { userId: identifier.userId } : {},
          { ipAddress: identifier.ipAddress },
        ].filter((o) => Object.keys(o).length > 0),
        startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Calculate duration with escalation
    let baseDuration =
      tier === RateLimitTier.SOFT_LIMIT
        ? config.softPenaltyMinutes
        : config.hardPenaltyMinutes;
    let violationCount = 1;

    if (recentPenalty) {
      violationCount = recentPenalty.violationCount + 1;
      // Exponential backoff: base * 3^(violations-1), capped at max
      baseDuration = Math.min(
        baseDuration * Math.pow(3, violationCount - 1),
        config.maxPenaltyMinutes,
      );
    }

    const expiresAt = new Date(Date.now() + baseDuration * 60 * 1000);
    const reason = `Rate limit exceeded: ${action} (violation #${violationCount})`;

    // Upsert penalty in database
    await this.prisma.rateLimitPenalty.upsert({
      where: {
        user_ip_penalty: {
          userId: identifier.userId || '',
          ipAddress: identifier.ipAddress,
        },
      },
      create: {
        userId: identifier.userId || null,
        ipAddress: identifier.ipAddress,
        tier,
        reason,
        expiresAt,
        violationCount,
        escalatedFrom: recentPenalty?.id,
      },
      update: {
        tier,
        reason,
        expiresAt,
        violationCount,
        startedAt: new Date(),
      },
    });

    // Cache in Redis
    await this.cachePenalty(identifier, tier, expiresAt, reason);

    this.logger.warn(
      `Rate limit penalty applied: ${tier} for ${identifier.userId || identifier.ipAddress}, duration: ${baseDuration} minutes`,
    );
  }

  /**
   * Cache penalty in Redis
   */
  private async cachePenalty(
    identifier: RateLimitIdentifier,
    tier: RateLimitTier,
    expiresAt: Date,
    reason: string,
  ): Promise<void> {
    const ttl = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (ttl <= 0) return;

    const pipeline = this.redis.pipeline();

    if (identifier.userId) {
      const userKey = `ratelimit:penalty:user:${identifier.userId}`;
      pipeline.hset(userKey, {
        tier,
        expiresAt: expiresAt.getTime().toString(),
        reason,
      });
      pipeline.expire(userKey, ttl);
    }

    const ipKey = `ratelimit:penalty:ip:${identifier.ipAddress}`;
    pipeline.hset(ipKey, {
      tier,
      expiresAt: expiresAt.getTime().toString(),
      reason,
    });
    pipeline.expire(ipKey, ttl);

    await pipeline.exec();
  }

  /**
   * Log rate limit event to database (legacy)
   */
  private async logRateLimitEvent(
    identifier: RateLimitIdentifier,
    action: string,
    tier: RateLimitTier,
    requestCount: number,
    windowSize: number,
    pattern: PatternAnalysis,
  ): Promise<void> {
    try {
      await this.prisma.rateLimitLog.create({
        data: {
          userId: identifier.userId || null,
          ipAddress: identifier.ipAddress,
          endpoint: 'artwork_view',
          action,
          tier,
          requestCount,
          windowSize,
          intervalVariance: pattern.intervalCV,
          avgInterval: pattern.avgInterval,
          windowStart: new Date(Date.now() - windowSize * 1000),
        },
      });
    } catch (error) {
      this.logger.error('Failed to log rate limit event', error);
    }
  }

  /**
   * Log rate limit event to database (v2 with composite score)
   */
  private async logRateLimitEventV2(
    identifier: RateLimitIdentifier,
    action: string,
    tier: RateLimitTier,
    requestCount: number,
    windowSize: number,
    pattern: PatternAnalysis,
    riskScore?: CompositeRiskScore,
    detectionReason?: string,
    isAnonymous?: boolean,
    hasRealInteraction?: boolean,
  ): Promise<void> {
    try {
      await this.prisma.rateLimitLog.create({
        data: {
          userId: identifier.userId || null,
          ipAddress: identifier.ipAddress,
          endpoint: 'artwork_view',
          action,
          tier,
          requestCount,
          windowSize,
          intervalVariance: pattern.intervalCV,
          avgInterval: pattern.avgInterval,
          windowStart: new Date(Date.now() - windowSize * 1000),
          riskScore: riskScore?.score ?? null,
          intervalScore: riskScore?.factors.intervalScore ?? null,
          regularityScore: riskScore?.factors.regularityScore ?? null,
          detectionReason: detectionReason ?? null,
          isAnonymous: isAnonymous ?? !identifier.userId,
          hasRealInteraction: hasRealInteraction ?? null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log rate limit event', error);
    }
  }

  /**
   * Log interaction-only detection (when rate limiting is disabled but noInteractionEnabled is true)
   */
  private async logInteractionOnlyDetection(
    identifier: RateLimitIdentifier,
    action: string,
  ): Promise<void> {
    try {
      await this.prisma.rateLimitLog.create({
        data: {
          userId: identifier.userId || null,
          ipAddress: identifier.ipAddress,
          endpoint: 'artwork_view',
          action,
          tier: RateLimitTier.SOFT_LIMIT,
          requestCount: 0,
          windowSize: 0,
          intervalVariance: null,
          avgInterval: null,
          windowStart: new Date(),
          riskScore: null,
          intervalScore: null,
          regularityScore: null,
          detectionReason: 'no_real_interaction_only',
          isAnonymous: !identifier.userId,
          hasRealInteraction: false,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log interaction-only detection', error);
    }
  }

  /**
   * Build Redis key for identifier
   */
  private buildKey(identifier: RateLimitIdentifier, action: string): string {
    if (identifier.userId) {
      return `user:${identifier.userId}:${action}`;
    }
    return `ip:${identifier.ipAddress}:${action}`;
  }

  /**
   * Cache config in Redis
   */
  private async cacheConfig(config: RateLimitConfig): Promise<void> {
    await this.redis.hset(CONFIG_CACHE_KEY, {
      windowSeconds: config.windowSeconds.toString(),
      softLimitPerWindow: config.softLimitPerWindow.toString(),
      hardLimitPerWindow: config.hardLimitPerWindow.toString(),
      softLimitPerHour: config.softLimitPerHour.toString(),
      hardLimitPerHour: config.hardLimitPerHour.toString(),
      cvSoftThreshold: config.cvSoftThreshold.toString(),
      cvHardThreshold: config.cvHardThreshold.toString(),
      softPenaltyMinutes: config.softPenaltyMinutes.toString(),
      hardPenaltyMinutes: config.hardPenaltyMinutes.toString(),
      maxPenaltyMinutes: config.maxPenaltyMinutes.toString(),
      enabled: config.enabled.toString(),
      hardLimitScore: config.hardLimitScore.toString(),
      softLimitScore: config.softLimitScore.toString(),
      warningScore: config.warningScore.toString(),
      minSamplesAnonymous: config.minSamplesAnonymous.toString(),
      minSamplesUser: config.minSamplesUser.toString(),
      instantDetectionIntervalMs: config.instantDetectionIntervalMs.toString(),
      instantDetectionCV: config.instantDetectionCV.toString(),
      measurementMode: config.measurementMode.toString(),
      useCompositeScore: config.useCompositeScore.toString(),
      noInteractionEnabled: config.noInteractionEnabled.toString(),
      noInteractionThresholdMultiplier: config.noInteractionThresholdMultiplier.toString(),
    });
    await this.redis.expire(CONFIG_CACHE_KEY, CONFIG_CACHE_TTL);
  }

  /**
   * Parse config from Redis hash
   */
  private parseConfigFromRedis(hash: Record<string, string>): RateLimitConfig {
    return {
      windowSeconds: parseInt(hash.windowSeconds) || 60,
      softLimitPerWindow: parseInt(hash.softLimitPerWindow) || 6,
      hardLimitPerWindow: parseInt(hash.hardLimitPerWindow) || 10,
      softLimitPerHour: parseInt(hash.softLimitPerHour) || 120,
      hardLimitPerHour: parseInt(hash.hardLimitPerHour) || 200,
      cvSoftThreshold: parseFloat(hash.cvSoftThreshold) || 0.15,
      cvHardThreshold: parseFloat(hash.cvHardThreshold) || 0.08,
      softPenaltyMinutes: parseInt(hash.softPenaltyMinutes) || 5,
      hardPenaltyMinutes: parseInt(hash.hardPenaltyMinutes) || 30,
      maxPenaltyMinutes: parseInt(hash.maxPenaltyMinutes) || 120,
      enabled: hash.enabled === 'true',
      hardLimitScore: parseFloat(hash.hardLimitScore) || 90,
      softLimitScore: parseFloat(hash.softLimitScore) || 50,
      warningScore: parseFloat(hash.warningScore) || 35,
      minSamplesAnonymous: parseInt(hash.minSamplesAnonymous) || 15,
      minSamplesUser: parseInt(hash.minSamplesUser) || 20,
      instantDetectionIntervalMs: parseInt(hash.instantDetectionIntervalMs) || 3000,
      instantDetectionCV: parseFloat(hash.instantDetectionCV) || 1.0,
      measurementMode: hash.measurementMode === 'true',
      useCompositeScore: hash.useCompositeScore === 'true',
      noInteractionEnabled: hash.noInteractionEnabled === 'true',
      noInteractionThresholdMultiplier: parseFloat(hash.noInteractionThresholdMultiplier) || 1.0,
    };
  }

  // ============================================
  // Admin API Methods
  // ============================================

  async getLogs(query: RateLimitLogQueryDto) {
    const { page = 1, limit = 20, tier, ipAddress, userId, action, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tier) where.tier = tier;
    if (ipAddress) where.ipAddress = { contains: ipAddress };
    if (userId) where.userId = userId;
    if (action) where.action = action;

    const [data, total] = await Promise.all([
      this.prisma.rateLimitLog.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rateLimitLog.count({ where }),
    ]);

    return {
      data: data.map((log) => ({
        ...log,
        username: log.user?.username || null,
        user: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPenalties(query: RateLimitPenaltyQueryDto) {
    const { page = 1, limit = 20, tier, ipAddress, userId, activeOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (tier) where.tier = tier;
    if (ipAddress) where.ipAddress = { contains: ipAddress };
    if (userId) where.userId = userId;
    if (activeOnly === 'true') {
      where.expiresAt = { gt: new Date() };
    }

    const [data, total] = await Promise.all([
      this.prisma.rateLimitPenalty.findMany({
        where,
        include: { user: { select: { username: true } } },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rateLimitPenalty.count({ where }),
    ]);

    const now = new Date();
    return {
      data: data.map((penalty) => ({
        ...penalty,
        username: penalty.user?.username || null,
        isActive: penalty.expiresAt > now,
        user: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deletePenalty(id: string): Promise<void> {
    const penalty = await this.prisma.rateLimitPenalty.findUnique({
      where: { id },
    });

    if (penalty) {
      // Remove from Redis cache
      if (penalty.userId) {
        await this.redis.del(`ratelimit:penalty:user:${penalty.userId}`);
      }
      await this.redis.del(`ratelimit:penalty:ip:${penalty.ipAddress}`);

      // Delete from database
      await this.prisma.rateLimitPenalty.delete({ where: { id } });
    }
  }

  async getStats(): Promise<RateLimitStats> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalLogs,
      logsByTier,
      activePenalties,
      uniqueIPs,
      uniqueUsers,
      logsLast24h,
      penaltiesLast24h,
    ] = await Promise.all([
      this.prisma.rateLimitLog.count(),
      this.prisma.rateLimitLog.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
      this.prisma.rateLimitPenalty.count({
        where: { expiresAt: { gt: now } },
      }),
      this.prisma.rateLimitLog.findMany({
        distinct: ['ipAddress'],
        select: { ipAddress: true },
      }),
      this.prisma.rateLimitLog.findMany({
        distinct: ['userId'],
        where: { userId: { not: null } },
        select: { userId: true },
      }),
      this.prisma.rateLimitLog.count({
        where: { createdAt: { gte: last24Hours } },
      }),
      this.prisma.rateLimitPenalty.count({
        where: { startedAt: { gte: last24Hours } },
      }),
    ]);

    const tierCounts = {
      NORMAL: 0,
      WARNING: 0,
      SOFT_LIMIT: 0,
      HARD_LIMIT: 0,
    };
    logsByTier.forEach((item) => {
      tierCounts[item.tier] = item._count.id;
    });

    return {
      totalLogs,
      logsByTier: tierCounts,
      activePenalties,
      uniqueIPs: uniqueIPs.length,
      uniqueUsers: uniqueUsers.length,
      last24Hours: {
        logs: logsLast24h,
        penalties: penaltiesLast24h,
      },
    };
  }
}
