import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { Request } from 'express'
import { PrismaService } from '../../prisma/prisma.service'

export interface JwtPayload {
  sub: string // user id
  email: string
  username: string
  role: string
}

/**
 * Extract JWT from either Authorization header or cookie
 * This allows image requests (which can't set Authorization header) to use cookie auth
 */
function extractJwtFromHeaderOrCookie(req: Request): string | null {
  // First try Authorization header
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Fall back to cookie for image requests
  // Get instance ID for cookie namespacing (matches frontend useAuth.ts naming: ${instanceId}_accessToken)
  const instanceId = process.env.INSTANCE_ID || `port${process.env.FRONTEND_PORT || '11103'}`
  const cookieName = `${instanceId}_accessToken`

  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName]
  }

  return null
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractJwtFromHeaderOrCookie,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: false,
    })
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        coverImageUrl: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled')
    }

    return user
  }
}
