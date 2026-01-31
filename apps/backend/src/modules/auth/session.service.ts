import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { UAParser } from 'ua-parser-js'

interface CreateSessionParams {
  userId: string
  refreshToken: string
  ipAddress?: string
  userAgent?: string
  rememberMe?: boolean
}

export interface SessionInfo {
  id: string
  deviceName: string
  deviceType: string
  ipAddress: string | null
  location: string | null
  createdAt: Date
  lastUsedAt: Date
  expiresAt: Date
  isCurrent: boolean
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name)

  constructor(private prisma: PrismaService) {}

  /**
   * Create new session
   * @param rememberMe If true, session expires in 30 days; otherwise 1 hour
   */
  async createSession(params: CreateSessionParams): Promise<void> {
    const { userId, refreshToken, ipAddress, userAgent, rememberMe } = params

    // Parse user agent
    const deviceInfo = this.parseUserAgent(userAgent)

    // Calculate expiration based on rememberMe flag
    // Remember Me ON: 30 days, OFF: 1 hour
    const expiresAt = new Date()
    if (rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + 30)
    } else {
      expiresAt.setHours(expiresAt.getHours() + 1)
    }

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        expiresAt,
      },
    })
  }

  /**
   * Validate session by refresh token
   * Returns true if session exists and is not expired
   */
  async validateSession(refreshToken: string): Promise<boolean> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    })

    // Session must exist and not be expired
    if (!session || session.expiresAt < new Date()) {
      return false
    }

    return true
  }

  /**
   * Update session's last used timestamp
   */
  async updateSessionLastUsed(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshToken },
      data: { lastUsedAt: new Date() },
    })
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() }, // Only active sessions
      },
      orderBy: { lastUsedAt: 'desc' },
    })

    const mapped = sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName || 'Unknown Device',
      deviceType: session.deviceType || 'unknown',
      ipAddress: session.ipAddress,
      location: session.location,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
      isCurrent: session.refreshToken === currentRefreshToken,
    }))

    // Sort to put current session first, then by lastUsedAt
    return mapped.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1
      if (!a.isCurrent && b.isCurrent) return 1
      return 0 // Keep original order (lastUsedAt desc) for non-current sessions
    })
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId, // Ensure user owns this session
      },
    })
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        userId,
        refreshToken: currentRefreshToken
          ? { not: currentRefreshToken }
          : undefined,
      },
    })

    return result.count
  }

  /**
   * Revoke all sessions including current
   */
  async revokeAllSessionsIncludingCurrent(userId: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { userId },
    })

    return result.count
  }

  /**
   * Clean up expired sessions (runs every hour automatically)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired sessions`)
    }

    return result.count
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(params: {
    userId?: string
    email: string
    ipAddress: string
    userAgent?: string
    success: boolean
    failureReason?: string
  }): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        userId: params.userId || null,
        email: params.email,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent || null,
        success: params.success,
        failureReason: params.failureReason || null,
      },
    })
  }

  /**
   * Get recent login attempts for a user
   */
  async getLoginAttempts(
    email: string,
    limit: number = 10,
  ): Promise<
    Array<{
      ipAddress: string
      userAgent: string | null
      success: boolean
      failureReason: string | null
      createdAt: Date
    }>
  > {
    const attempts = await this.prisma.loginAttempt.findMany({
      where: { email },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return attempts
  }

  /**
   * Check for suspicious login attempts
   * Returns true if there are too many failed attempts recently
   */
  async checkSuspiciousActivity(
    email: string,
    ipAddress: string,
  ): Promise<{ suspicious: boolean; failedAttempts: number }> {
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)

    const recentFailedAttempts = await this.prisma.loginAttempt.count({
      where: {
        email,
        ipAddress,
        success: false,
        createdAt: { gte: fifteenMinutesAgo },
      },
    })

    // More than 5 failed attempts in 15 minutes is suspicious
    return {
      suspicious: recentFailedAttempts >= 5,
      failedAttempts: recentFailedAttempts,
    }
  }

  /**
   * Parse user agent string to extract device information
   */
  private parseUserAgent(userAgent?: string): {
    deviceName: string
    deviceType: string
  } {
    if (!userAgent) {
      return { deviceName: 'Unknown Device', deviceType: 'unknown' }
    }

    const parser = new UAParser(userAgent)
    const result = parser.getResult()

    // Determine device type
    let deviceType = 'desktop'
    if (result.device.type === 'mobile') {
      deviceType = 'mobile'
    } else if (result.device.type === 'tablet') {
      deviceType = 'tablet'
    }

    // Create device name
    const browser = result.browser.name || 'Unknown Browser'
    const os = result.os.name || 'Unknown OS'
    const deviceModel = result.device.model || ''

    let deviceName = `${browser} on ${os}`
    if (deviceModel) {
      deviceName = `${browser} on ${deviceModel}`
    }

    return { deviceName, deviceType }
  }
}
