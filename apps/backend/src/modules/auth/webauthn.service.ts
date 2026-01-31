import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  WebAuthnCredential,
  Base64URLString,
} from '@simplewebauthn/server'

export interface PasskeyInfo {
  id: string
  name: string
  credentialDeviceType: string
  credentialBackedUp: boolean
  transports: string[]
  createdAt: Date
  lastUsedAt: Date | null
}

@Injectable()
export class WebAuthnService {
  private readonly rpName: string
  private readonly rpID: string
  private readonly origin: string

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Configure Relying Party settings from environment
    const baseUrl = this.configService.get<string>(
      'BASE_URL',
      'http://localhost:11103',
    )
    const url = new URL(baseUrl)

    this.rpName = this.configService.get<string>('INSTANCE_NAME', 'illo')
    this.rpID = url.hostname
    this.origin = url.origin
  }

  /**
   * Generate registration options for a new passkey
   */
  async generateRegistrationOptions(userId: string): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authenticators: true },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const excludeCredentials = user.authenticators.map((auth) => ({
      id: Buffer.from(auth.credentialId).toString('base64url') as Base64URLString,
      type: 'public-key' as const,
      transports: auth.transports as AuthenticatorTransportFuture[],
    }))

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email || user.username,
      userDisplayName: user.displayName || user.username,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await this.prisma.webAuthnChallenge.create({
      data: {
        userId,
        challenge: options.challenge,
        type: 'registration',
        expiresAt,
      },
    })

    return { options }
  }

  /**
   * Verify registration response and save the authenticator
   */
  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    name: string,
  ): Promise<PasskeyInfo> {
    // Find and validate challenge
    const storedChallenge = await this.prisma.webAuthnChallenge.findFirst({
      where: {
        userId,
        type: 'registration',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!storedChallenge) {
      throw new UnauthorizedException('Challenge expired or not found')
    }

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      })
    } catch (error) {
      throw new UnauthorizedException(
        `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Registration verification failed')
    }

    const { registrationInfo } = verification

    const credentialIdBuffer = Buffer.from(registrationInfo.credential.id, 'base64url')
    const existingAuth = await this.prisma.authenticator.findUnique({
      where: { credentialId: credentialIdBuffer },
    })

    if (existingAuth) {
      throw new ConflictException('This passkey is already registered')
    }

    // Save the authenticator
    const authenticator = await this.prisma.authenticator.create({
      data: {
        userId,
        credentialId: credentialIdBuffer,
        credentialPublicKey: Buffer.from(registrationInfo.credential.publicKey),
        counter: BigInt(registrationInfo.credential.counter),
        credentialDeviceType: registrationInfo.credentialDeviceType,
        credentialBackedUp: registrationInfo.credentialBackedUp,
        transports: (response.response.transports as string[]) || [],
        name,
      },
    })

    await this.prisma.webAuthnChallenge.delete({
      where: { id: storedChallenge.id },
    })

    return this.toPasskeyInfo(authenticator)
  }

  /**
   * Generate authentication options for passkey login
   */
  async generateAuthenticationOptions(email?: string): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON
  }> {
    let allowCredentials:
      | {
          id: Base64URLString
          type: 'public-key'
          transports?: AuthenticatorTransportFuture[]
        }[]
      | undefined = undefined

    // If email provided, get user's authenticators for hints
    if (email) {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: { authenticators: true },
      })

      if (user?.authenticators.length) {
        allowCredentials = user.authenticators.map((auth) => ({
          id: Buffer.from(auth.credentialId).toString('base64url') as Base64URLString,
          type: 'public-key' as const,
          transports: auth.transports as AuthenticatorTransportFuture[],
        }))
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: 'preferred',
      allowCredentials,
    })

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await this.prisma.webAuthnChallenge.create({
      data: {
        userId: null, // Authentication challenges are not user-specific
        challenge: options.challenge,
        type: 'authentication',
        expiresAt,
      },
    })

    return { options }
  }

  /**
   * Verify authentication response
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    challenge: string,
  ): Promise<{ userId: string; authenticatorId: string }> {
    // Find authenticator by credential ID
    const credentialIdBuffer = Buffer.from(response.id, 'base64url')
    const authenticator = await this.prisma.authenticator.findUnique({
      where: { credentialId: credentialIdBuffer },
      include: { user: true },
    })

    if (!authenticator) {
      throw new UnauthorizedException('Passkey not found')
    }

    if (!authenticator.user.isActive) {
      throw new UnauthorizedException('User account is disabled')
    }

    // Find and validate challenge
    const storedChallenge = await this.prisma.webAuthnChallenge.findFirst({
      where: {
        challenge,
        type: 'authentication',
        expiresAt: { gt: new Date() },
      },
    })

    if (!storedChallenge) {
      throw new UnauthorizedException('Challenge expired or not found')
    }

    let verification
    try {
      const credential: WebAuthnCredential = {
        id: Buffer.from(authenticator.credentialId).toString('base64url') as Base64URLString,
        publicKey: new Uint8Array(authenticator.credentialPublicKey),
        counter: Number(authenticator.counter),
        transports: authenticator.transports as AuthenticatorTransportFuture[],
      }
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential,
      })
    } catch (error) {
      throw new UnauthorizedException(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed')
    }

    await this.prisma.authenticator.update({
      where: { id: authenticator.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    })

    await this.prisma.webAuthnChallenge.delete({
      where: { id: storedChallenge.id },
    })

    return {
      userId: authenticator.userId,
      authenticatorId: authenticator.id,
    }
  }

  /**
   * Get all passkeys for a user
   */
  async getUserPasskeys(userId: string): Promise<PasskeyInfo[]> {
    const authenticators = await this.prisma.authenticator.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return authenticators.map((auth) => this.toPasskeyInfo(auth))
  }

  /**
   * Rename a passkey
   */
  async renamePasskey(
    userId: string,
    passkeyId: string,
    name: string,
  ): Promise<PasskeyInfo> {
    const authenticator = await this.prisma.authenticator.findFirst({
      where: { id: passkeyId, userId },
    })

    if (!authenticator) {
      throw new NotFoundException('Passkey not found')
    }

    const updated = await this.prisma.authenticator.update({
      where: { id: passkeyId },
      data: { name },
    })

    return this.toPasskeyInfo(updated)
  }

  /**
   * Delete a passkey
   */
  async deletePasskey(userId: string, passkeyId: string): Promise<void> {
    const authenticator = await this.prisma.authenticator.findFirst({
      where: { id: passkeyId, userId },
    })

    if (!authenticator) {
      throw new NotFoundException('Passkey not found')
    }

    await this.prisma.authenticator.delete({
      where: { id: passkeyId },
    })
  }

  /**
   * Check if user has any passkeys
   */
  async hasPasskeys(userId: string): Promise<boolean> {
    const count = await this.prisma.authenticator.count({
      where: { userId },
    })
    return count > 0
  }

  /**
   * Cleanup expired challenges (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredChallenges(): Promise<number> {
    const result = await this.prisma.webAuthnChallenge.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    if (result.count > 0) {
      console.log(`Cleaned up ${result.count} expired WebAuthn challenges`)
    }
    return result.count
  }

  /**
   * Convert Authenticator model to PasskeyInfo
   */
  private toPasskeyInfo(auth: {
    id: string
    name: string
    credentialDeviceType: string
    credentialBackedUp: boolean
    transports: string[]
    createdAt: Date
    lastUsedAt: Date | null
  }): PasskeyInfo {
    return {
      id: auth.id,
      name: auth.name,
      credentialDeviceType: auth.credentialDeviceType,
      credentialBackedUp: auth.credentialBackedUp,
      transports: auth.transports,
      createdAt: auth.createdAt,
      lastUsedAt: auth.lastUsedAt,
    }
  }
}
