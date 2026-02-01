import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { HeadlessDetectionService } from './headless-detection.service';
import { HeadlessDetectionAction } from './interfaces/headless-detection.interface';
import { Request } from 'express';

@Injectable()
export class HeadlessDetectionGuard implements CanActivate {
  private readonly logger = new Logger(HeadlessDetectionGuard.name);

  constructor(
    private readonly headlessDetectionService: HeadlessDetectionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 検出が無効の場合はスキップ
    if (!this.headlessDetectionService.isEnabled()) {
      return true;
    }

    try {
      // ヘッドレスブラウザ検出を実行
      const result =
        await this.headlessDetectionService.analyze(request);

      // リクエストに検出結果を付与（後続処理で使用）
      (request as any).headlessDetectionResult = result;

      const config = this.headlessDetectionService.getConfig();

      // 計測モードの場合は常に許可（ログのみ）
      if (config.measurementMode) {
        if (result.verdict !== 'normal') {
          this.logger.log(
            `[MEASUREMENT] Detected ${result.verdict} (score: ${result.totalScore}) from ${this.getIpAddress(request)}`,
          );
        }
        return true;
      }

      // 判定に基づく処理
      switch (result.verdict) {
        case 'definite_bot':
          if (config.definiteBotAction === HeadlessDetectionAction.BLOCK) {
            this.logger.warn(
              `Blocking definite bot (score: ${result.totalScore}) from ${this.getIpAddress(request)}`,
            );
            throw new ForbiddenException(
              'Access denied: Headless browser detected',
            );
          }
          break;

        case 'likely_bot':
          if (config.likelyBotAction === HeadlessDetectionAction.BLOCK) {
            this.logger.warn(
              `Blocking likely bot (score: ${result.totalScore}) from ${this.getIpAddress(request)}`,
            );
            throw new ForbiddenException(
              'Access denied: Automated access detected',
            );
          }
          break;

        case 'suspicious':
          this.logger.log(
            `Suspicious request detected (score: ${result.totalScore}) from ${this.getIpAddress(request)}`,
          );
          break;

        default:
          // normal - 何もしない
          break;
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      // エラーが発生した場合は安全側に倒してログのみ
      this.logger.error('Error in headless detection guard', error);
      return true;
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
}
