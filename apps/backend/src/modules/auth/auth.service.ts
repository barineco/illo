import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { SetupService } from '../setup/setup.service'
import { MailService } from '../mail/mail.service'
import { SessionService } from './session.service'
import { HttpSignatureService } from '../federation/services/http-signature.service'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'
import { UserRole } from '@prisma/client'

export interface LoginDto {
  email: string
  password: string
}

export interface RegisterDto {
  username: string
  email: string
  password: string
  displayName?: string
  tosAccepted?: boolean
}

export interface AuthResponse {
  user: {
    id: string
    username: string
    email: string
    displayName: string | null
    role: string
    avatarUrl: string | null
    coverImageUrl: string | null
  }
  accessToken?: string
  refreshToken?: string
  message?: string
  rememberMe?: boolean
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private setupService: SetupService,
    private mailService: MailService,
    private sessionService: SessionService,
    private httpSignatureService: HttpSignatureService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return null
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
      return null
    }

    const { passwordHash, ...result } = user
    return result
  }

  async login(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
    rememberMe: boolean = false,
  ): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password)

    if (!user) {
      throw new UnauthorizedException('Invalid email or password')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled')
    }

    // Email verification check (skip for Bluesky OAuth users who have no email)
    if (user.email && !user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in')
    }

    if (user.twoFactorEnabled) {
      return {
        requiresTwoFactor: true,
        userId: user.id,
        rememberMe,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          avatarUrl: user.avatarUrl,
          coverImageUrl: user.coverImageUrl,
        },
      } as any
    }

    const tokens = await this.generateTokens(
      user.id,
      ipAddress,
      userAgent,
      rememberMe,
    )

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        coverImageUrl: user.coverImageUrl,
      },
      rememberMe,
      ...tokens,
    }
  }

  /**
   * Register new user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Check if setup is complete
    const isSetupComplete = await this.setupService.isSetupComplete()
    if (!isSetupComplete) {
      throw new ForbiddenException(
        'Cannot register users before initial setup is complete',
      )
    }

    const instanceInfo = await this.setupService.getPublicInstanceInfo()
    if (!instanceInfo?.allowRegistration) {
      throw new ForbiddenException('User registration is not allowed')
    }

    if (!registerDto.tosAccepted) {
      throw new ForbiddenException('Terms of Service must be accepted')
    }

    const instanceSettings = await this.prisma.instanceSettings.findFirst()
    const tosVersion = instanceSettings?.tosVersion ?? 1

    const existingUsername = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username: registerDto.username,
          domain: '', // Local users only
        },
      },
    })

    if (existingUsername) {
      throw new ConflictException('Username already exists')
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    })

    if (existingEmail) {
      throw new ConflictException('Email already exists')
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10)

    const emailVerifyToken = crypto.randomBytes(32).toString('hex')
    const emailVerifyExpires = new Date()
    emailVerifyExpires.setHours(emailVerifyExpires.getHours() + 24)

    const { publicKey, privateKey } = await this.httpSignatureService.generateKeyPair()

    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:11104')
    const actorUrl = `${baseUrl}/users/${registerDto.username}`
    const inbox = `${actorUrl}/inbox`
    const outbox = `${actorUrl}/outbox`
    const followersUrl = `${actorUrl}/followers`
    const followingUrl = `${actorUrl}/following`

    const user = await this.prisma.user.create({
      data: {
        username: registerDto.username,
        email: registerDto.email,
        passwordHash,
        displayName: registerDto.displayName || registerDto.username,
        role: UserRole.USER,
        isActive: !instanceInfo.requireApproval, // Auto-activate if approval not required
        isVerified: false,
        isEmailVerified: false,
        emailVerifyToken,
        emailVerifyExpires,
        tosAcceptedAt: new Date(),
        tosAcceptedVersion: tosVersion,
        publicKey,
        privateKey,
        actorUrl,
        inbox,
        outbox,
        followersUrl,
        followingUrl,
      },
    })

    try {
      await this.mailService.sendVerificationEmail(
        user.email,
        user.username,
        emailVerifyToken,
      )
    } catch (error) {
      console.error('Failed to send verification email:', error)
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
        coverImageUrl: user.coverImageUrl,
      },
      message: instanceInfo.requireApproval
        ? 'Registration successful. Please check your email to verify your account. Your account is also pending approval by an administrator.'
        : 'Registration successful. Please check your email to verify your account before logging in.',
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      })

      const isValidSession =
        await this.sessionService.validateSession(refreshToken)
      if (!isValidSession) {
        throw new UnauthorizedException('Session expired or revoked')
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token')
      }

      await this.sessionService.updateSessionLastUsed(refreshToken)

      const accessToken = await this.generateAccessToken(user)

      return { accessToken }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error
      }
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async generateTokens(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    rememberMe: boolean = false,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const accessToken = await this.generateAccessToken(user)
    const refreshToken = await this.generateRefreshToken(user, rememberMe)

    await this.sessionService.createSession({
      userId,
      refreshToken,
      ipAddress,
      userAgent,
      rememberMe,
    })

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })

    return {
      accessToken,
      refreshToken,
    }
  }

  async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    return user
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    revokeOtherSessions: boolean = false,
    currentRefreshToken?: string,
  ): Promise<{ message: string; revokedSessions?: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect')
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)

    if (isSamePassword) {
      throw new ConflictException('New password must be different from current password')
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    })

    let revokedSessions = 0
    if (revokeOtherSessions) {
      revokedSessions = await this.sessionService.revokeAllSessions(
        userId,
        currentRefreshToken,
      )
    }

    return {
      message: 'Password changed successfully',
      ...(revokeOtherSessions && { revokedSessions }),
    }
  }

  private async generateAccessToken(user: any): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    }

    return this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    })
  }

  private async generateRefreshToken(
    user: any,
    rememberMe: boolean = false,
  ): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      rememberMe,
    }

    const expiresIn = rememberMe ? '30d' : '1h'

    return this.jwtService.signAsync(payload, {
      expiresIn,
    })
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
        isEmailVerified: true,
        birthday: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const isAdult = user.birthday ? this.calculateAge(user.birthday) >= 18 : false
    const { birthday, ...userWithoutBirthday } = user

    return {
      ...userWithoutBirthday,
      isAdult,
    }
  }

  private calculateAge(birthday: Date): number {
    const today = new Date()
    const birthDate = new Date(birthday)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerifyToken: token },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid verification token')
    }

    if (!user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
      throw new UnauthorizedException('Verification token has expired')
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified' }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    })

    return { message: 'Email verified successfully' }
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    if (user.isEmailVerified) {
      throw new ConflictException('Email already verified')
    }

    const emailVerifyToken = crypto.randomBytes(32).toString('hex')
    const emailVerifyExpires = new Date()
    emailVerifyExpires.setHours(emailVerifyExpires.getHours() + 24)

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken,
        emailVerifyExpires,
      },
    })

    await this.mailService.sendVerificationEmail(
      user.email,
      user.username,
      emailVerifyToken,
    )

    return { message: 'Verification email sent' }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return { message: 'If the email exists, a password reset link has been sent' }
    }

    const resetPasswordToken = crypto.randomBytes(32).toString('hex')
    const resetPasswordExpires = new Date()
    resetPasswordExpires.setHours(resetPasswordExpires.getHours() + 1) // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    })

    try {
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.username,
        resetPasswordToken,
      )
    } catch (error) {
      console.error('Failed to send password reset email:', error)
    }

    return { message: 'If the email exists, a password reset link has been sent' }
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { resetPasswordToken: token },
    })

    if (!user) {
      throw new UnauthorizedException('Invalid reset token')
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new UnauthorizedException('Reset token has expired')
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    })

    return { message: 'Password reset successfully' }
  }

  async loginUser(
    user: { id: string },
    ipAddress?: string,
    userAgent?: string,
    rememberMe: boolean = false,
  ) {
    return this.generateTokens(user.id, ipAddress, userAgent, rememberMe)
  }

  async findByUsername(username: string) {
    return this.prisma.user.findFirst({
      where: {
        username,
        domain: '', // Local users only
      },
    })
  }

  async createUserWithBluesky(data: {
    username: string
    displayName: string
    blueskyDid: string
    blueskyHandle: string
    tosAccepted?: boolean
  }) {
    const isSetupComplete = await this.setupService.isSetupComplete()
    if (!isSetupComplete) {
      throw new ForbiddenException(
        'Cannot register users before initial setup is complete',
      )
    }

    const instanceInfo = await this.setupService.getPublicInstanceInfo()
    if (!instanceInfo?.allowRegistration) {
      throw new ForbiddenException('User registration is not allowed')
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username: data.username,
          domain: '',
        },
      },
    })

    if (existingUsername) {
      throw new ConflictException('Username already exists')
    }

    const randomPassword = crypto.randomBytes(32).toString('hex')
    const passwordHash = await bcrypt.hash(randomPassword, 10)

    const { publicKey, privateKey } = await this.httpSignatureService.generateKeyPair()

    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:11104')
    const actorUrl = `${baseUrl}/users/${data.username}`
    const inbox = `${actorUrl}/inbox`
    const outbox = `${actorUrl}/outbox`
    const followersUrl = `${actorUrl}/followers`
    const followingUrl = `${actorUrl}/following`

    const existingBlueskyUser = await this.prisma.user.findUnique({
      where: { blueskyDid: data.blueskyDid },
    })

    if (existingBlueskyUser) {
      throw new ConflictException('This Bluesky account is already linked to another user')
    }

    if (!data.tosAccepted) {
      throw new ForbiddenException('Terms of Service must be accepted')
    }

    const instanceSettings = await this.prisma.instanceSettings.findFirst()
    const tosVersion = instanceSettings?.tosVersion ?? 1

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        email: undefined,
        passwordHash,
        displayName: data.displayName,
        role: UserRole.USER,
        isActive: !instanceInfo.requireApproval,
        isVerified: false,
        isEmailVerified: false,
        blueskyDid: data.blueskyDid,
        blueskyHandle: data.blueskyHandle,
        blueskyVerified: true,
        blueskyLinkedAt: new Date(),
        tosAcceptedAt: new Date(),
        tosAcceptedVersion: tosVersion,
        publicKey,
        privateKey,
        actorUrl,
        inbox,
        outbox,
        followersUrl,
        followingUrl,
      },
    })

    return user
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      })

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      })

      if (!user || !user.isActive) {
        return null
      }

      return user
    } catch {
      return null
    }
  }
}
