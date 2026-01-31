import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { HttpSignatureService } from '../federation/services/http-signature.service'
import { InitialSetupDto, InstanceMode } from '@illo/shared'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcrypt'

@Injectable()
export class SetupService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private httpSignatureService: HttpSignatureService,
  ) {}

  /**
   * Check if initial setup has been completed
   */
  async isSetupComplete(): Promise<boolean> {
    const settings = await this.prisma.instanceSettings.findFirst()
    return settings?.isSetupComplete ?? false
  }

  /**
   * Get default values for initial setup from environment variables
   */
  getSetupDefaults() {
    return {
      instanceName: this.configService.get<string>('INSTANCE_NAME', ''),
      instanceTagline: this.configService.get<string>('INSTANCE_TAGLINE', ''),
    }
  }

  /**
   * Get public instance info (if setup is complete)
   */
  async getPublicInstanceInfo() {
    const settings = await this.prisma.instanceSettings.findFirst()
    if (!settings) {
      return null
    }

    return {
      instanceName: settings.instanceName,
      instanceMode: settings.instanceMode,
      description: settings.description,
      allowRegistration: settings.allowRegistration,
      requireApproval: settings.requireApproval,
      allowSearchEngineIndexing: settings.allowSearchEngineIndexing,
      isSetupComplete: settings.isSetupComplete,
    }
  }

  /**
   * Update instance mode (PERSONAL -> FEDERATION_ONLY only)
   * This is a one-way operation - cannot revert
   */
  async updateInstanceMode(adminUserId: string, newMode: InstanceMode) {
    // Get current settings
    const settings = await this.prisma.instanceSettings.findFirst()
    if (!settings) {
      throw new BadRequestException('Instance settings not found')
    }

    // Validate that the user is admin
    if (settings.adminUserId !== adminUserId) {
      throw new BadRequestException('Only admin can update instance mode')
    }

    // Validate mode transition (only PERSONAL -> FEDERATION_ONLY allowed)
    if (settings.instanceMode === InstanceMode.PERSONAL && newMode !== InstanceMode.FEDERATION_ONLY) {
      throw new BadRequestException('Invalid mode transition. Can only change from PERSONAL to FEDERATION_ONLY')
    }

    if (settings.instanceMode === InstanceMode.FEDERATION_ONLY) {
      throw new BadRequestException('Instance mode is already FEDERATION_ONLY and cannot be changed')
    }

    // Update instance settings
    const updatedSettings = await this.prisma.instanceSettings.update({
      where: { id: settings.id },
      data: {
        instanceMode: newMode,
        allowRegistration: true,
        requireApproval: true,
      },
    })

    return {
      message: 'Instance mode updated successfully',
      instanceMode: updatedSettings.instanceMode,
      allowRegistration: updatedSettings.allowRegistration,
      requireApproval: updatedSettings.requireApproval,
    }
  }

  /**
   * Perform initial setup: create admin user and instance settings
   */
  async performInitialSetup(dto: InitialSetupDto) {
    // Check if setup has already been completed
    const existingSettings = await this.prisma.instanceSettings.findFirst()
    if (existingSettings?.isSetupComplete) {
      throw new ConflictException('Initial setup has already been completed')
    }

    // Validate instance mode
    if (!Object.values(InstanceMode).includes(dto.instanceMode)) {
      throw new BadRequestException('Invalid instance mode')
    }

    // Check if username or email already exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.adminUsername }, { email: dto.adminEmail }],
      },
    })

    if (existingUser) {
      throw new ConflictException('Username or email already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.adminPassword, 10)

    // Generate Ed25519 key pair for ActivityPub
    const { publicKey, privateKey } = await this.httpSignatureService.generateKeyPair()

    // Build ActivityPub URLs
    const baseUrl = dto.publicUrl || this.configService.get<string>('BASE_URL', 'http://localhost:11104')
    const actorUrl = `${baseUrl}/users/${dto.adminUsername}`
    const inbox = `${actorUrl}/inbox`
    const outbox = `${actorUrl}/outbox`
    const followersUrl = `${actorUrl}/followers`
    const followingUrl = `${actorUrl}/following`

    // Create admin user and instance settings in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          username: dto.adminUsername,
          email: dto.adminEmail,
          passwordHash,
          displayName: dto.adminDisplayName || dto.adminUsername,
          role: UserRole.ADMIN,
          isActive: true,
          isVerified: true,
          // ActivityPub fields
          publicKey,
          privateKey,
          actorUrl,
          inbox,
          outbox,
          followersUrl,
          followingUrl,
        },
      })

      // Create or update instance settings
      const settings = await tx.instanceSettings.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          instanceName: dto.instanceName,
          instanceMode: dto.instanceMode,
          publicUrl: dto.publicUrl,
          adminUserId: adminUser.id,
          description: dto.description || null,
          isSetupComplete: true,
          allowRegistration:
            dto.instanceMode === InstanceMode.FEDERATION_ONLY,
          requireApproval: true,
        },
        update: {
          instanceName: dto.instanceName,
          instanceMode: dto.instanceMode,
          publicUrl: dto.publicUrl,
          adminUserId: adminUser.id,
          description: dto.description || null,
          isSetupComplete: true,
          allowRegistration:
            dto.instanceMode === InstanceMode.FEDERATION_ONLY,
          requireApproval: true,
        },
      })

      return { adminUser, settings }
    })

    // Return sanitized response (no password hash)
    return {
      message: 'Initial setup completed successfully',
      instanceSettings: {
        instanceName: result.settings.instanceName,
        instanceMode: result.settings.instanceMode,
        description: result.settings.description,
      },
      adminUser: {
        id: result.adminUser.id,
        username: result.adminUser.username,
        email: result.adminUser.email,
        displayName: result.adminUser.displayName,
        role: result.adminUser.role,
      },
    }
  }

  /**
   * Update registration settings (admin only)
   */
  async updateRegistrationSettings(
    userId: string,
    allowRegistration?: boolean,
    requireApproval?: boolean,
  ) {
    // Verify user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update registration settings')
    }

    // Prepare update data
    const updateData: any = {}
    if (allowRegistration !== undefined) {
      updateData.allowRegistration = allowRegistration
    }
    if (requireApproval !== undefined) {
      updateData.requireApproval = requireApproval
    }

    // Update settings
    const settings = await this.prisma.instanceSettings.update({
      where: { id: 'singleton' },
      data: updateData,
    })

    return {
      message: 'Registration settings updated successfully',
      allowRegistration: settings.allowRegistration,
      requireApproval: settings.requireApproval,
    }
  }

  /**
   * Update SEO settings (admin only)
   */
  async updateSeoSettings(
    userId: string,
    allowSearchEngineIndexing: boolean,
  ) {
    // Verify user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update SEO settings')
    }

    // Update settings
    const settings = await this.prisma.instanceSettings.update({
      where: { id: 'singleton' },
      data: { allowSearchEngineIndexing },
    })

    return {
      message: 'SEO settings updated successfully',
      allowSearchEngineIndexing: settings.allowSearchEngineIndexing,
    }
  }

  /**
   * Update instance branding (admin only)
   */
  async updateInstanceBranding(
    userId: string,
    instanceName?: string,
    description?: string,
  ) {
    // Verify user is admin
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update instance branding')
    }

    // Prepare update data
    const updateData: { instanceName?: string; description?: string | null } = {}
    if (instanceName !== undefined) {
      if (!instanceName.trim()) {
        throw new BadRequestException('Instance name cannot be empty')
      }
      updateData.instanceName = instanceName.trim()
    }
    if (description !== undefined) {
      updateData.description = description.trim() || null
    }

    // Update settings
    const settings = await this.prisma.instanceSettings.update({
      where: { id: 'singleton' },
      data: updateData,
    })

    return {
      message: 'Instance branding updated successfully',
      instanceName: settings.instanceName,
      description: settings.description,
    }
  }
}
