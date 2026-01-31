import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TosSettingsResponse, TosStatusResponse } from './dto/tos-settings.dto'

@Injectable()
export class TosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current ToS settings (version info only)
   */
  async getTosSettings(): Promise<TosSettingsResponse> {
    const settings = await this.prisma.instanceSettings.findFirst()

    return {
      tosVersion: settings?.tosVersion ?? 1,
      tosUpdatedAt: settings?.tosUpdatedAt ?? null,
    }
  }

  /**
   * Check if user needs to accept ToS
   */
  async getTosStatus(userId: string): Promise<TosStatusResponse> {
    const [settings, user] = await Promise.all([
      this.prisma.instanceSettings.findFirst(),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          tosAcceptedAt: true,
          tosAcceptedVersion: true,
        },
      }),
    ])

    const currentVersion = settings?.tosVersion ?? 1
    const acceptedVersion = user?.tosAcceptedVersion ?? null

    // User needs to accept if:
    // 1. Never accepted (tosAcceptedVersion is null)
    // 2. Accepted version is lower than current version
    const needsAcceptance =
      acceptedVersion === null || acceptedVersion < currentVersion

    return {
      needsAcceptance,
      currentVersion,
      acceptedVersion,
      acceptedAt: user?.tosAcceptedAt ?? null,
    }
  }

  /**
   * Record user's ToS acceptance
   */
  async acceptTos(userId: string, version: number): Promise<void> {
    const settings = await this.prisma.instanceSettings.findFirst()
    const currentVersion = settings?.tosVersion ?? 1

    // Only accept if the version matches current
    if (version !== currentVersion) {
      throw new Error(
        `ToS version mismatch. Expected ${currentVersion}, got ${version}`,
      )
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        tosAcceptedAt: new Date(),
        tosAcceptedVersion: version,
      },
    })
  }

  /**
   * Increment ToS version (admin only)
   * Used when ToS content is updated via source files
   */
  async incrementVersion(): Promise<TosSettingsResponse> {
    const settings = await this.prisma.instanceSettings.findFirst()

    if (!settings) {
      throw new Error('Instance settings not found')
    }

    const updated = await this.prisma.instanceSettings.update({
      where: { id: settings.id },
      data: {
        tosVersion: settings.tosVersion + 1,
        tosUpdatedAt: new Date(),
      },
    })

    return {
      tosVersion: updated.tosVersion,
      tosUpdatedAt: updated.tosUpdatedAt,
    }
  }

  /**
   * Get current ToS version
   */
  async getCurrentVersion(): Promise<number> {
    const settings = await this.prisma.instanceSettings.findFirst()
    return settings?.tosVersion ?? 1
  }
}
