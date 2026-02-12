import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface InstanceContactInfo {
  contactInfo: string | null
  adminUsername: string | null
}

export interface PublicInstanceInfo {
  instanceName: string
  instanceMode: string
  description: string | null
  publicUrl: string | null
  contactInfo: string | null
  adminUsername: string | null
  allowRegistration: boolean
  requireApproval: boolean
  tosVersion: number
  tosUpdatedAt: Date | null
}

@Injectable()
export class InstanceService {
  constructor(private readonly prisma: PrismaService) {}

  getContactInfo(): InstanceContactInfo {
    return {
      contactInfo: process.env.INSTANCE_CONTACT_INFO || null,
      adminUsername: process.env.INSTANCE_ADMIN_USERNAME || null,
    }
  }

  async getPublicInstanceInfo(): Promise<PublicInstanceInfo> {
    const settings = await this.prisma.instanceSettings.findFirst()

    if (!settings) {
      // Return defaults if no settings exist
      return {
        instanceName: process.env.INSTANCE_NAME || 'illo',
        instanceMode: 'PERSONAL',
        description: null,
        publicUrl: process.env.BASE_URL || null,
        contactInfo: process.env.INSTANCE_CONTACT_INFO || null,
        adminUsername: process.env.INSTANCE_ADMIN_USERNAME || null,
        allowRegistration: false,
        requireApproval: true,
        tosVersion: 1,
        tosUpdatedAt: null,
      }
    }

    // Get admin username if adminUserId is set
    let adminUsername: string | null = process.env.INSTANCE_ADMIN_USERNAME || null
    if (settings.adminUserId) {
      const adminUser = await this.prisma.user.findUnique({
        where: { id: settings.adminUserId },
        select: { username: true },
      })
      if (adminUser) {
        adminUsername = adminUser.username
      }
    }

    return {
      instanceName: settings.instanceName,
      instanceMode: settings.instanceMode,
      description: settings.description,
      publicUrl: settings.publicUrl || process.env.BASE_URL || null,
      contactInfo: process.env.INSTANCE_CONTACT_INFO || null,
      adminUsername,
      allowRegistration: settings.allowRegistration,
      requireApproval: settings.requireApproval,
      tosVersion: settings.tosVersion,
      tosUpdatedAt: settings.tosUpdatedAt,
    }
  }
}
