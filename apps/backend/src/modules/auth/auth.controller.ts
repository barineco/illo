import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Req,
} from '@nestjs/common'
import { Request } from 'express'
import { AuthService } from './auth.service'
import { TwoFactorService } from './two-factor.service'
import { LocalAuthGuard } from './guards/local-auth.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import {
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  ChangePasswordDto,
} from './dto'

interface LoginDto {
  email: string
  password: string
  rememberMe?: boolean
}

interface RegisterDto {
  username: string
  email: string
  password: string
  displayName?: string
}

interface RefreshTokenDto {
  refreshToken: string
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    const rememberMe = loginDto.rememberMe ?? false

    return this.authService.login(loginDto, ipAddress, userAgent, rememberMe)
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto)
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id)
  }

  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query() query: VerifyEmailDto) {
    return this.authService.verifyEmail(query.token)
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email)
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email)
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword)
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setup2FA(@CurrentUser() user: any) {
    const { secret, otpauth } = this.twoFactorService.generateSecret(
      user.username,
    )
    const qrCode = await this.twoFactorService.generateQRCode(otpauth)

    return {
      secret,
      qrCode,
      message:
        'Scan the QR code with your authenticator app and verify with a code',
    }
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enable2FA(
    @CurrentUser() user: any,
    @Body('secret') secret: string,
    @Body('token') token: string,
  ) {
    const { backupCodes } = await this.twoFactorService.enable2FA(
      user.id,
      secret,
      token,
    )

    return {
      message: '2FA enabled successfully',
      backupCodes,
      warning: 'Save these backup codes in a safe place. They can only be used once.',
    }
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disable2FA(
    @CurrentUser() user: any,
    @Body('code') code: string,
  ) {
    await this.twoFactorService.disable2FA(user.id, code)

    return { message: '2FA disabled successfully' }
  }

  @Public()
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verify2FA(
    @Body('userId') userId: string,
    @Body('code') code: string,
    @Body('rememberMe') rememberMe: boolean = false,
    @Req() req: Request,
  ) {
    const result = await this.twoFactorService.verify2FACode(userId, code)

    if (!result.success) {
      throw new UnauthorizedException('Invalid 2FA code')
    }

    const ipAddress = req.ip || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    const tokens = await this.authService.generateTokens(
      userId,
      ipAddress,
      userAgent,
      rememberMe ?? false,
    )

    const userProfile = await this.authService.getProfile(userId)

    return {
      ...tokens,
      user: userProfile,
      usedBackupCode: result.usedBackupCode,
      message: result.usedBackupCode
        ? 'Logged in with backup code. Please regenerate backup codes.'
        : 'Login successful',
    }
  }

  @Get('2fa/backup-codes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getBackupCodes(@CurrentUser() user: any) {
    const status = await this.twoFactorService.getBackupCodesStatus(user.id)
    return status
  }

  @Post('2fa/regenerate-backup-codes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(@CurrentUser() user: any) {
    const { backupCodes } =
      await this.twoFactorService.regenerateBackupCodes(user.id)

    return {
      backupCodes,
      message: 'Backup codes regenerated successfully',
      warning: 'Old backup codes are now invalid. Save these new codes in a safe place.',
    }
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async get2FAStatus(@CurrentUser() user: any) {
    const dbUser = await this.authService.findUserById(user.id)
    const remainingBackupCodes =
      await this.twoFactorService.getRemainingBackupCodesCount(user.id)

    return {
      enabled: dbUser.twoFactorEnabled,
      remainingBackupCodes: dbUser.twoFactorEnabled ? remainingBackupCodes : 0,
    }
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const currentRefreshToken = req.headers['x-refresh-token'] as string | undefined

    const result = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      dto.revokeOtherSessions ?? false,
      currentRefreshToken,
    )

    return result
  }
}
