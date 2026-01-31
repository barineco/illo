import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { authenticator } from 'otplib'
import * as QRCode from 'qrcode'
import * as crypto from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { EncryptionService } from './services/encryption.service'

@Injectable()
export class TwoFactorService {
  private readonly instanceName: string

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {
    this.instanceName = this.configService.get<string>('INSTANCE_NAME', 'illo')
    // Configure TOTP settings
    authenticator.options = {
      window: 1, // Allow 1 step before/after for time drift
    }
  }

  /**
   * Generate TOTP secret for user
   */
  generateSecret(username: string): { secret: string; otpauth: string } {
    const secret = authenticator.generateSecret()
    const otpauth = authenticator.keyuri(
      username,
      this.instanceName,
      secret,
    )

    return { secret, otpauth }
  }

  /**
   * Generate QR code as Data URL
   */
  async generateQRCode(otpauth: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauth)
      return qrCodeDataURL
    } catch (error) {
      throw new Error('Failed to generate QR code')
    }
  }

  /**
   * Verify TOTP code
   */
  verifyTOTP(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret })
    } catch (error) {
      return false
    }
  }

  /**
   * Generate backup codes (10 codes, 8 digits each)
   */
  generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      // Generate 8-digit code
      const code = crypto.randomInt(10000000, 99999999).toString()
      codes.push(code)
    }
    return codes
  }

  /**
   * Enable 2FA for user
   */
  async enable2FA(
    userId: string,
    secret: string,
    verificationToken: string,
  ): Promise<{ backupCodes: string[] }> {
    // Verify the TOTP token first
    if (!this.verifyTOTP(secret, verificationToken)) {
      throw new UnauthorizedException('Invalid verification code')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    if (user.twoFactorEnabled) {
      throw new ConflictException('2FA is already enabled')
    }

    // Encrypt the secret before saving
    const encryptedSecret = this.encryptionService.encrypt(secret)

    // Generate backup codes
    const backupCodes = this.generateBackupCodes()

    // Start transaction to update user and create backup codes
    await this.prisma.$transaction(async (tx) => {
      // Enable 2FA and save encrypted secret
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      })

      // Create backup codes
      const backupCodeRecords = backupCodes.map((code) => ({
        userId,
        code,
      }))

      await tx.twoFactorBackupCode.createMany({
        data: backupCodeRecords,
      })
    })

    return { backupCodes }
  }

  /**
   * Disable 2FA for user
   */
  async disable2FA(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new ConflictException('2FA is not enabled')
    }

    // Verify the TOTP code or backup code before disabling
    const verificationResult = await this.verify2FACode(userId, code)
    if (!verificationResult.success) {
      throw new UnauthorizedException('Invalid verification code')
    }

    // In a transaction, remove secret and delete backup codes
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      })

      await tx.twoFactorBackupCode.deleteMany({
        where: { userId },
      })
    })
  }

  /**
   * Verify 2FA code or backup code during login
   */
  async verify2FACode(
    userId: string,
    code: string,
  ): Promise<{ success: boolean; usedBackupCode: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA is not enabled for this user')
    }

    // First try TOTP (decrypt secret first)
    try {
      const decryptedSecret = this.encryptionService.decrypt(user.twoFactorSecret)

      if (this.verifyTOTP(decryptedSecret, code)) {
        return { success: true, usedBackupCode: false }
      }
    } catch (error) {
      // Decryption failed - log error and continue to backup codes
      console.error('Failed to decrypt 2FA secret:', error.message)
    }

    // If TOTP fails, try backup codes
    const backupCode = await this.prisma.twoFactorBackupCode.findFirst({
      where: {
        userId,
        code,
        isUsed: false,
      },
    })

    if (backupCode) {
      // Mark backup code as used
      await this.prisma.twoFactorBackupCode.update({
        where: { id: backupCode.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      })

      return { success: true, usedBackupCode: true }
    }

    return { success: false, usedBackupCode: false }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException('2FA is not enabled')
    }

    const newBackupCodes = this.generateBackupCodes()

    await this.prisma.$transaction(async (tx) => {
      // Delete old backup codes
      await tx.twoFactorBackupCode.deleteMany({
        where: { userId },
      })

      // Create new backup codes
      const backupCodeRecords = newBackupCodes.map((code) => ({
        userId,
        code,
      }))

      await tx.twoFactorBackupCode.createMany({
        data: backupCodeRecords,
      })
    })

    return { backupCodes: newBackupCodes }
  }

  /**
   * Get remaining backup codes count
   */
  async getRemainingBackupCodesCount(userId: string): Promise<number> {
    const count = await this.prisma.twoFactorBackupCode.count({
      where: {
        userId,
        isUsed: false,
      },
    })

    return count
  }

  /**
   * Get backup codes status (masked for security)
   * Returns codes with last 4 digits visible and usage status
   */
  async getBackupCodesStatus(userId: string): Promise<{
    codes: Array<{ masked: string; isUsed: boolean; usedAt: Date | null }>
    totalCount: number
    remainingCount: number
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException('2FA is not enabled')
    }

    const backupCodes = await this.prisma.twoFactorBackupCode.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })

    const codes = backupCodes.map((code) => ({
      masked: `****${code.code.slice(-4)}`,
      isUsed: code.isUsed,
      usedAt: code.usedAt,
    }))

    const remainingCount = backupCodes.filter((code) => !code.isUsed).length

    return {
      codes,
      totalCount: backupCodes.length,
      remainingCount,
    }
  }
}
