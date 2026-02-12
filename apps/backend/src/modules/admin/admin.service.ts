import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UserRole, Prisma } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { UserFilterDto } from './dto/user-filter.dto'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verify admin password for sensitive operations
   */
  async verifyAdminPassword(
    adminId: string,
    password: string,
  ): Promise<boolean> {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      select: { passwordHash: true, role: true },
    })

    if (!admin || admin.role !== UserRole.ADMIN) {
      // Log failed attempt
      await this.createAuditLog(
        'ADMIN_PASSWORD_FAILED',
        adminId,
        null,
        'Admin password verification failed: user not admin',
        { timestamp: new Date() },
      )
      throw new ForbiddenException('Admin access required')
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash)

    if (!isValid) {
      // Log failed password attempt
      await this.createAuditLog(
        'ADMIN_PASSWORD_FAILED',
        adminId,
        null,
        'Failed password verification',
        { timestamp: new Date() },
      )
      return false
    }

    return true
  }

  /**
   * Get all users with filtering
   */
  async getAllUsers(filters: UserFilterDto) {
    const { status, location, search, page = 1, limit = 20 } = filters

    const where: Prisma.UserWhereInput = {}

    // Apply status filter
    if (status === 'pending') {
      where.isActive = false
      where.rejectedAt = null
      where.approvedAt = null
    } else if (status === 'active') {
      where.isActive = true
      where.suspendedAt = null
    } else if (status === 'suspended') {
      where.suspendedAt = { not: null }
    } else if (status === 'rejected') {
      where.rejectedAt = { not: null }
    }

    // Apply location filter (local vs remote)
    if (location === 'local') {
      where.domain = ''
    } else if (location === 'remote') {
      where.domain = { not: '' }
    }

    // Apply search filter
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total, stats] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          domain: true,
          email: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          isVerified: true,
          approvedAt: true,
          approvedBy: true,
          rejectedAt: true,
          rejectionReason: true,
          suspendedAt: true,
          suspensionReason: true,
          deactivatedAt: true,
          deactivationReason: true,
          supporterTier: true,
          createdAt: true,
          artworks: {
            take: 4,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              images: {
                take: 1,
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  thumbnailUrl: true,
                },
              },
            },
            where: {
              images: {
                some: {},
              },
            },
          },
          _count: {
            select: {
              artworks: true,
              followers: true,
              following: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
      // Get overall stats (not affected by filters)
      Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { domain: '' } }),
        this.prisma.user.count({ where: { domain: { not: '' } } }),
        this.prisma.user.count({
          where: { isActive: false, rejectedAt: null, approvedAt: null },
        }),
        this.prisma.user.count({
          where: { isActive: true, suspendedAt: null },
        }),
        this.prisma.user.count({ where: { suspendedAt: { not: null } } }),
        this.prisma.user.count({ where: { rejectedAt: { not: null } } }),
      ]).then(([total, local, remote, pending, active, suspended, rejected]) => ({
        total,
        local,
        remote,
        pending,
        active,
        suspended,
        rejected,
      })),
    ])

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats,
    }
  }

  /**
   * Approve a pending user
   */
  async approveUser(adminId: string, targetUserId: string, password: string) {
    // Verify admin password
    const isPasswordValid = await this.verifyAdminPassword(adminId, password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password')
    }

    // Get target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, isActive: true, rejectedAt: true },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (targetUser.rejectedAt) {
      throw new BadRequestException(
        'Cannot approve rejected user (ActivityPub ID permanence)',
      )
    }

    if (targetUser.isActive) {
      throw new BadRequestException('User is already active')
    }

    // Update user (select specific fields to avoid BigInt serialization issues)
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isActive: true,
        approvedAt: new Date(),
        approvedBy: adminId,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        isVerified: true,
        approvedAt: true,
        createdAt: true,
      },
    })

    // Create audit log
    await this.createAuditLog('USER_APPROVED', adminId, targetUserId)

    return user
  }

  /**
   * Reject a user (permanent tombstone per ActivityPub)
   */
  async rejectUser(
    adminId: string,
    targetUserId: string,
    reason: string,
    password: string,
  ) {
    // Verify admin password
    const isPasswordValid = await this.verifyAdminPassword(adminId, password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password')
    }

    // Prevent self-rejection
    if (adminId === targetUserId) {
      throw new BadRequestException('Cannot reject your own account')
    }

    // Get target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, role: true, rejectedAt: true },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (targetUser.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot reject admin accounts')
    }

    if (targetUser.rejectedAt) {
      throw new BadRequestException('User is already rejected')
    }

    // Update user (permanent tombstone, select specific fields to avoid BigInt serialization issues)
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        isActive: false,
        rejectedAt: new Date(),
        rejectionReason: reason,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        rejectedAt: true,
        rejectionReason: true,
        createdAt: true,
      },
    })

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId: targetUserId },
    })

    // Create audit log
    await this.createAuditLog('USER_REJECTED', adminId, targetUserId, reason)

    return user
  }

  /**
   * Suspend an active user
   */
  async suspendUser(
    adminId: string,
    targetUserId: string,
    reason: string,
    password: string,
  ) {
    // Verify admin password
    const isPasswordValid = await this.verifyAdminPassword(adminId, password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password')
    }

    // Prevent self-suspension
    if (adminId === targetUserId) {
      throw new BadRequestException('Cannot suspend your own account')
    }

    // Get target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        role: true,
        suspendedAt: true,
        rejectedAt: true,
      },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (targetUser.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot suspend admin accounts')
    }

    if (targetUser.rejectedAt) {
      throw new BadRequestException('Cannot suspend rejected user')
    }

    if (targetUser.suspendedAt) {
      throw new BadRequestException('User is already suspended')
    }

    // Update user (select specific fields to avoid BigInt serialization issues)
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        suspendedAt: new Date(),
        suspensionReason: reason,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        suspendedAt: true,
        suspensionReason: true,
        createdAt: true,
      },
    })

    // Revoke all sessions
    await this.prisma.session.deleteMany({
      where: { userId: targetUserId },
    })

    // Create audit log
    await this.createAuditLog('USER_SUSPENDED', adminId, targetUserId, reason)

    return user
  }

  /**
   * Activate a suspended user (cannot activate rejected users)
   */
  async activateUser(adminId: string, targetUserId: string, password: string) {
    // Verify admin password
    const isPasswordValid = await this.verifyAdminPassword(adminId, password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password')
    }

    // Get target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        suspendedAt: true,
        rejectedAt: true,
      },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (targetUser.rejectedAt) {
      throw new BadRequestException(
        'Cannot activate rejected user (ActivityPub ID permanence)',
      )
    }

    if (!targetUser.suspendedAt) {
      throw new BadRequestException('User is not suspended')
    }

    // Update user (select specific fields to avoid BigInt serialization issues)
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        suspendedAt: null,
        suspensionReason: null,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        suspendedAt: true,
        createdAt: true,
      },
    })

    // Create audit log
    await this.createAuditLog('USER_ACTIVATED', adminId, targetUserId)

    return user
  }

  /**
   * Set user supporter tier (manual assignment for testing/rewards)
   */
  async setUserTier(
    adminId: string,
    targetUserId: string,
    tier: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3',
    password: string,
  ) {
    // Verify admin password
    const isPasswordValid = await this.verifyAdminPassword(adminId, password)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password')
    }

    // Validate tier
    const validTiers = ['NONE', 'TIER_1', 'TIER_2', 'TIER_3']
    if (!validTiers.includes(tier)) {
      throw new BadRequestException('Invalid tier')
    }

    // Get target user
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        supporterTier: true,
      },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    // Update user tier
    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        supporterTier: tier,
        supporterSince: tier !== 'NONE' ? new Date() : null,
        supporterExpiresAt: null, // Manual assignment doesn't expire
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        supporterTier: true,
        supporterSince: true,
        createdAt: true,
      },
    })

    // Create audit log
    await this.createAuditLog(
      'USER_TIER_CHANGED',
      adminId,
      targetUserId,
      `Changed tier from ${targetUser.supporterTier} to ${tier}`,
    )

    return user
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    action: string,
    adminId: string,
    targetUserId: string | null = null,
    reason: string | null = null,
    metadata: any = null,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          adminId,
          targetUserId,
          reason,
          metadata,
        },
      })
    } catch (error) {
      // Log but don't fail the operation if audit log creation fails
      console.error('Failed to create audit log:', error)
    }
  }
}
