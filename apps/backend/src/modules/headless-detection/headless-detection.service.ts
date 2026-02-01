import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  HeadlessBotScore,
  UserAgentSignal,
  ClientHintsSignal,
  HeaderConsistencySignal,
  RateLimitSignal,
  UserInteractionSignal,
  HeadlessDetectionConfig,
  HeadlessDetectionAction,
} from './interfaces/headless-detection.interface';
import { Request } from 'express';
import { RateLimitTier } from '@prisma/client';

@Injectable()
export class HeadlessDetectionService {
  private readonly logger = new Logger(HeadlessDetectionService.name);
  private config: HeadlessDetectionConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.loadConfig();
  }

  private loadConfig(): void {
    this.config = {
      enabled: this.configService.get<boolean>(
        'HEADLESS_DETECTION_ENABLED',
        true,
      ),
      measurementMode: this.configService.get<boolean>(
        'HEADLESS_DETECTION_MEASUREMENT_MODE',
        true,
      ),
      suspiciousThreshold: this.configService.get<number>(
        'HEADLESS_DETECTION_SUSPICIOUS_THRESHOLD',
        31,
      ),
      likelyBotThreshold: this.configService.get<number>(
        'HEADLESS_DETECTION_LIKELY_BOT_THRESHOLD',
        51,
      ),
      definiteBotThreshold: this.configService.get<number>(
        'HEADLESS_DETECTION_DEFINITE_BOT_THRESHOLD',
        76,
      ),
      userAgentWeight: 1.0,
      clientHintsWeight: 1.0,
      headerWeight: 1.0,
      rateLimitWeight: 1.0,
      userInteractionWeight: 1.0,
      suspiciousAction: HeadlessDetectionAction.LOG_ONLY,
      likelyBotAction: HeadlessDetectionAction.DEGRADE_QUALITY,
      definiteBotAction: HeadlessDetectionAction.BLOCK,
      allowedUserAgents: [],
      allowedIpRanges: [],
    };
  }

  async analyze(req: Request): Promise<HeadlessBotScore> {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = this.getIpAddress(req);

    // 各シグナルを分析
    const userAgentSignal = this.analyzeUserAgent(userAgent);
    const clientHintsSignal = this.analyzeClientHints(req);
    const headerConsistencySignal = this.analyzeHeaderConsistency(req);
    const rateLimitSignal = this.analyzeRateLimit(req);
    const userInteractionSignal = this.analyzeUserInteraction(req);

    // 複合スコア計算
    const totalScore =
      userAgentSignal.score * this.config.userAgentWeight +
      clientHintsSignal.score * this.config.clientHintsWeight +
      headerConsistencySignal.score * this.config.headerWeight +
      rateLimitSignal.score * this.config.rateLimitWeight +
      userInteractionSignal.score * this.config.userInteractionWeight;

    // 判定
    const verdict = this.determineVerdict(totalScore);
    const confidence = this.calculateConfidence(totalScore, verdict);

    const result: HeadlessBotScore = {
      totalScore: Math.round(totalScore),
      signals: {
        userAgent: userAgentSignal,
        clientHints: clientHintsSignal,
        headerConsistency: headerConsistencySignal,
        rateLimit: rateLimitSignal,
        userInteraction: userInteractionSignal,
      },
      verdict,
      confidence,
    };

    // ログ記録
    await this.logDetection(ipAddress, userAgent, req.headers, result);

    return result;
  }

  private analyzeUserAgent(userAgent: string): UserAgentSignal {
    const details: string[] = [];
    let score = 0;

    // 空のUA
    const isEmpty = !userAgent || userAgent.trim().length === 0;
    if (isEmpty) {
      score += 30;
      details.push('Empty User-Agent');
    }

    // 短すぎるUA
    if (!isEmpty && userAgent.length < 20) {
      score += 20;
      details.push('Suspiciously short User-Agent');
    }

    // ヘッドレスブラウザパターン
    const headlessPatterns = [
      /HeadlessChrome/i,
      /Puppeteer/i,
      /PhantomJS/i,
      /playwright/i,
    ];
    const isHeadless = headlessPatterns.some((pattern) =>
      pattern.test(userAgent),
    );
    if (isHeadless) {
      score = Math.min(score + 30, 30);
      details.push('Headless browser detected in User-Agent');
    }

    // 自動化ツールパターン
    const automationPatterns = [
      /Selenium/i,
      /WebDriver/i,
      /chromedriver/i,
      /automation/i,
    ];
    const isSuspicious = automationPatterns.some((pattern) =>
      pattern.test(userAgent),
    );
    if (isSuspicious) {
      score = Math.min(score + 25, 30);
      details.push('Automation tool detected in User-Agent');
    }

    // 既知のbotパターン
    const botPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i];
    const knownBotPattern = botPatterns.some((pattern) =>
      pattern.test(userAgent),
    );
    if (knownBotPattern) {
      score = Math.min(score + 20, 30);
      details.push('Known bot pattern detected');
    }

    return {
      isHeadless,
      isEmpty,
      isSuspicious,
      knownBotPattern,
      score: Math.min(score, 30),
      details,
    };
  }

  private analyzeClientHints(req: Request): ClientHintsSignal {
    const details: string[] = [];
    let score = 0;

    const secChUa = req.headers['sec-ch-ua'];
    const secChUaMobile = req.headers['sec-ch-ua-mobile'];
    const secChUaPlatform = req.headers['sec-ch-ua-platform'];
    const userAgent = req.headers['user-agent'] || '';

    const hasSecChUa = !!secChUa;
    const hasSecChUaMobile = !!secChUaMobile;
    const hasSecChUaPlatform = !!secChUaPlatform;

    // Puppeteer/Playwright特有のパターン検出
    if (hasSecChUa) {
      const secChUaStr = String(secChUa).toLowerCase();
      // "HeadlessChrome" パターン（確実な検出）
      if (secChUaStr.includes('headlesschrome')) {
        score += 25;
        details.push('HeadlessChrome detected in Client Hints');
      }
    }

    // Chromeを名乗っているがClient Hintsがない
    if (userAgent.includes('Chrome') && !hasSecChUa) {
      score += 25;
      details.push('Chrome User-Agent without Client Hints');
    }

    // Client Hintsが部分的に欠落
    if (hasSecChUa && (!hasSecChUaMobile || !hasSecChUaPlatform)) {
      score += 15;
      details.push('Incomplete Client Hints');
    }

    // 整合性チェック（UAとClient Hintsの整合性）
    let consistency = true;
    if (hasSecChUa && userAgent) {
      // 簡易的な整合性チェック
      if (
        userAgent.includes('Chrome') &&
        secChUa &&
        !String(secChUa).includes('Chromium')
      ) {
        consistency = false;
        score += 10;
        details.push('Client Hints inconsistent with User-Agent');
      }
    }

    return {
      hasSecChUa,
      hasSecChUaMobile,
      hasSecChUaPlatform,
      consistency,
      score: Math.min(score, 25),
      details,
    };
  }

  private analyzeHeaderConsistency(req: Request): HeaderConsistencySignal {
    const details: string[] = [];
    let score = 0;

    const acceptLanguage = req.headers['accept-language'];
    const acceptEncoding = req.headers['accept-encoding'];
    const connection = req.headers['connection'];

    const hasAcceptLanguage = !!acceptLanguage;
    const hasAcceptEncoding = !!acceptEncoding;

    // Accept-Languageが欠落
    if (!hasAcceptLanguage) {
      score += 15;
      details.push('Missing Accept-Language header');
    }

    // Accept-Encodingが欠落
    if (!hasAcceptEncoding) {
      score += 15;
      details.push('Missing Accept-Encoding header');
    }

    // Accept-Encodingの妥当性チェック
    let acceptEncodingValid = true;
    if (hasAcceptEncoding) {
      const encoding = String(acceptEncoding).toLowerCase();
      const hasGzip = encoding.includes('gzip');
      const hasDeflate = encoding.includes('deflate');

      if (!hasGzip && !hasDeflate) {
        acceptEncodingValid = false;
        score += 10;
        details.push('Invalid Accept-Encoding header');
      }
    }

    // Connectionヘッダーの異常
    let connectionHeaderNormal = true;
    if (connection) {
      const connValue = String(connection).toLowerCase();
      if (connValue !== 'keep-alive' && connValue !== 'close') {
        connectionHeaderNormal = false;
        score += 5;
        details.push('Unusual Connection header');
      }
    }

    return {
      hasAcceptLanguage,
      hasAcceptEncoding,
      acceptEncodingValid,
      connectionHeaderNormal,
      score: Math.min(score, 25),
      details,
    };
  }

  private analyzeRateLimit(req: Request): RateLimitSignal {
    // リクエストにrate-limit情報が付与されている場合は利用
    const rateLimitStatus = (req as any).rateLimitStatus;

    if (!rateLimitStatus) {
      return {
        currentTier: 'NORMAL',
        recentViolations: 0,
        patternScore: 0,
        score: 0,
      };
    }

    let score = 0;
    const tier = rateLimitStatus.tier || 'NORMAL';

    // ティアに基づくスコア
    switch (tier) {
      case RateLimitTier.HARD_LIMIT:
        score += 20;
        break;
      case RateLimitTier.SOFT_LIMIT:
        score += 15;
        break;
      case RateLimitTier.WARNING:
        score += 10;
        break;
      default:
        score += 0;
    }

    // リスクスコアがある場合は加味
    if (rateLimitStatus.riskScore) {
      const riskScore = rateLimitStatus.riskScore.score;
      if (riskScore > 80) {
        score += 5;
      }
    }

    return {
      currentTier: tier,
      recentViolations: 0,
      patternScore: rateLimitStatus.riskScore?.score || 0,
      score: Math.min(score, 20),
    };
  }

  private analyzeUserInteraction(req: Request): UserInteractionSignal {
    const details: string[] = [];
    let score = 0;

    const interactionToken = req.headers['x-user-interaction-token'] as
      | string
      | undefined;
    const realInteractionHeader = req.headers['x-real-user-interaction'] as
      | string
      | undefined;

    const hasToken = !!interactionToken;
    const hasRealInteraction = realInteractionHeader === 'true';
    let tokenValid = false;
    let tokenAge = 0;
    let tokenExpired = false;

    if (!hasToken) {
      score += 30;
      details.push('No user interaction token');
      if (hasRealInteraction) {
        details.push('Real interaction detected (anomaly)');
      }
      return {
        hasToken: false,
        tokenValid: false,
        tokenAge: 0,
        tokenExpired: false,
        hasRealInteraction,
        score: Math.min(score, 30),
        details,
      };
    }

    try {
      const [timestampStr, signature] = interactionToken.split(':');
      if (!timestampStr || !signature) {
        score += 25;
        details.push('Invalid token format');
        return {
          hasToken: true,
          tokenValid: false,
          tokenAge: 0,
          tokenExpired: false,
          hasRealInteraction,
          score: Math.min(score, 30),
          details,
        };
      }

      const timestamp = parseInt(timestampStr, 10);
      const now = Math.floor(Date.now() / 1000);
      tokenAge = now - timestamp;

      // トークンの有効期限（5分 = 300秒）
      const maxTokenAge = 300;
      if (tokenAge > maxTokenAge) {
        tokenExpired = true;
        score += 15;
        details.push(`Token expired (age: ${tokenAge}s)`);
      } else if (tokenAge < 0) {
        score += 25;
        details.push('Token timestamp in future');
      } else {
        // シグネチャ検証
        const crypto = require('crypto');
        const secret = this.configService.get<string>(
          'HEADLESS_DETECTION_INTERACTION_SECRET',
          'default-secret-change-me',
        );
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(timestampStr)
          .digest('hex');

        if (signature === expectedSignature) {
          tokenValid = true;

          // Token is valid, now check real interaction
          if (hasRealInteraction) {
            // Normal user with real interaction
            score += 0;
            details.push('Valid token with real user interaction');
          } else {
            // Token valid but no real interaction (Puppeteer visiting page)
            score += 15;
            details.push('Valid token but no real user interaction detected');
          }
        } else {
          score += 25;
          details.push('Invalid token signature');
        }
      }
    } catch (error) {
      score += 25;
      details.push('Token validation error');
    }

    return {
      hasToken,
      tokenValid,
      tokenAge,
      tokenExpired,
      hasRealInteraction,
      score: Math.min(score, 30),
      details,
    };
  }

  private determineVerdict(
    score: number,
  ): 'normal' | 'suspicious' | 'likely_bot' | 'definite_bot' {
    if (score >= this.config.definiteBotThreshold) {
      return 'definite_bot';
    }
    if (score >= this.config.likelyBotThreshold) {
      return 'likely_bot';
    }
    if (score >= this.config.suspiciousThreshold) {
      return 'suspicious';
    }
    return 'normal';
  }

  private calculateConfidence(
    score: number,
    verdict: 'normal' | 'suspicious' | 'likely_bot' | 'definite_bot',
  ): number {
    // スコアと閾値の距離に基づいて信頼度を計算
    switch (verdict) {
      case 'definite_bot':
        return Math.min(
          (score - this.config.definiteBotThreshold) / 20 + 0.8,
          1.0,
        );
      case 'likely_bot':
        return (
          (score - this.config.likelyBotThreshold) /
            (this.config.definiteBotThreshold - this.config.likelyBotThreshold) *
            0.3 +
          0.5
        );
      case 'suspicious':
        return (
          (score - this.config.suspiciousThreshold) /
            (this.config.likelyBotThreshold - this.config.suspiciousThreshold) *
            0.3 +
          0.3
        );
      default:
        return Math.max(
          1.0 - score / this.config.suspiciousThreshold,
          0.1,
        );
    }
  }

  private async logDetection(
    ipAddress: string,
    userAgent: string,
    headers: any,
    result: HeadlessBotScore,
  ): Promise<void> {
    try {
      const detectionReasons = [
        ...result.signals.userAgent.details,
        ...result.signals.clientHints.details,
        ...result.signals.headerConsistency.details,
        ...result.signals.userInteraction.details,
      ];

      const action = this.config.measurementMode
        ? 'log_only'
        : this.getActionForVerdict(result.verdict);

      await this.prisma.headlessDetectionLog.create({
        data: {
          ipAddress,
          totalScore: result.totalScore,
          verdict: result.verdict,
          confidence: result.confidence,
          userAgentScore: result.signals.userAgent.score,
          clientHintsScore: result.signals.clientHints.score,
          headerScore: result.signals.headerConsistency.score,
          rateLimitScore: result.signals.rateLimit.score,
          userInteractionScore: result.signals.userInteraction.score,
          hasRealInteraction: result.signals.userInteraction.hasRealInteraction,
          userAgent: userAgent || null,
          rawHeaders: headers,
          detectionReasons,
          actionTaken: action,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log headless detection', error);
    }
  }

  private getActionForVerdict(
    verdict: 'normal' | 'suspicious' | 'likely_bot' | 'definite_bot',
  ): string {
    switch (verdict) {
      case 'definite_bot':
        return this.config.definiteBotAction;
      case 'likely_bot':
        return this.config.likelyBotAction;
      case 'suspicious':
        return this.config.suspiciousAction;
      default:
        return HeadlessDetectionAction.ALLOW;
    }
  }

  private getIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = String(forwarded).split(',');
      return ips[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  getConfig(): HeadlessDetectionConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}
