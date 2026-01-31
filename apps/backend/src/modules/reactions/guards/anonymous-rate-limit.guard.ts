import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { createHash } from 'crypto'
import { Request } from 'express'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'

// Extend Express Request to include ipHash for anonymous reactions
declare global {
  namespace Express {
    interface Request {
      ipHash?: string
    }
  }
}

@Injectable()
export class AnonymousReactionRateLimitGuard implements CanActivate {
  private readonly ipSalt: string
  private readonly maxReactionsPerDay = 100
  private readonly windowMs = 24 * 60 * 60 * 1000 // 24 hours

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.ipSalt = this.configService.get<string>('REACTION_IP_SALT') || 'default-reaction-salt'
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>()
    const user = (request as any).user

    // Logged-in users are not rate limited by this guard
    if (user?.id) {
      return true
    }

    const ipAddress = this.getClientIp(request)
    const ipHash = this.hashIp(ipAddress)

    // Attach ipHash to request for use in service
    request.ipHash = ipHash

    // Check rate limit for anonymous user
    const now = new Date()
    const windowStart = new Date(now.getTime() - this.windowMs)

    // Find or create rate limit record
    let limitRecord = await this.prisma.anonymousReactionLimit.findUnique({
      where: { ipHash },
    })

    if (!limitRecord) {
      // First reaction from this IP
      return true
    }

    // Check if we need to reset the window
    if (limitRecord.windowStart < windowStart) {
      // Window expired, will reset on next reaction
      return true
    }

    // Check if limit exceeded
    if (limitRecord.reactionCount >= this.maxReactionsPerDay) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          error: 'Too Many Requests',
          retryAfter: Math.ceil((limitRecord.expiresAt.getTime() - now.getTime()) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    return true
  }

  private getClientIp(request: Request): string {
    // Handle proxies (X-Forwarded-For header)
    const forwarded = request.headers['x-forwarded-for']
    if (forwarded) {
      const ips = typeof forwarded === 'string' ? forwarded : forwarded[0]
      return ips.split(',')[0].trim()
    }

    // Handle X-Real-IP header (common with nginx)
    const realIp = request.headers['x-real-ip']
    if (realIp) {
      return typeof realIp === 'string' ? realIp : realIp[0]
    }

    // Fallback to connection IP
    return request.ip || request.socket?.remoteAddress || '0.0.0.0'
  }

  private hashIp(ip: string): string {
    return createHash('sha256')
      .update(ip + this.ipSalt)
      .digest('hex')
  }
}
