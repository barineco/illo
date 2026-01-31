import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateReportDto, UpdateReportDto, ReportQueryDto } from './dto'
import { ReportType, ReportStatus } from '@prisma/client'

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name)

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new report
   */
  async createReport(reporterId: string, dto: CreateReportDto) {
    // Validate target based on type
    if (dto.type === ReportType.ARTWORK) {
      if (!dto.artworkId) {
        throw new BadRequestException('artworkId is required for artwork reports')
      }
      const artwork = await this.prisma.artwork.findUnique({
        where: { id: dto.artworkId },
      })
      if (!artwork) {
        throw new NotFoundException('Artwork not found')
      }
      // Cannot report own artwork
      if (artwork.authorId === reporterId) {
        throw new BadRequestException('Cannot report your own artwork')
      }
    } else if (dto.type === ReportType.USER) {
      if (!dto.targetUserId) {
        throw new BadRequestException('targetUserId is required for user reports')
      }
      const user = await this.prisma.user.findUnique({
        where: { id: dto.targetUserId },
      })
      if (!user) {
        throw new NotFoundException('User not found')
      }
      // Cannot report self
      if (dto.targetUserId === reporterId) {
        throw new BadRequestException('Cannot report yourself')
      }
    } else if (dto.type === ReportType.COMMENT) {
      if (!dto.commentId) {
        throw new BadRequestException('commentId is required for comment reports')
      }
      const comment = await this.prisma.comment.findUnique({
        where: { id: dto.commentId },
      })
      if (!comment) {
        throw new NotFoundException('Comment not found')
      }
      // Cannot report own comment
      if (comment.userId === reporterId) {
        throw new BadRequestException('Cannot report your own comment')
      }
    }

    // Check for duplicate report (same reporter, same target, pending status)
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        type: dto.type,
        status: ReportStatus.PENDING,
        ...(dto.artworkId && { artworkId: dto.artworkId }),
        ...(dto.targetUserId && { targetUserId: dto.targetUserId }),
        ...(dto.commentId && { commentId: dto.commentId }),
      },
    })

    if (existingReport) {
      throw new BadRequestException('You have already reported this item')
    }

    const report = await this.prisma.report.create({
      data: {
        type: dto.type,
        reason: dto.reason,
        description: dto.description,
        reporterId,
        artworkId: dto.artworkId,
        targetUserId: dto.targetUserId,
        commentId: dto.commentId,
      },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    })

    this.logger.log(`Report created: ${report.id} by user ${reporterId}, type: ${dto.type}`)
    return report
  }

  /**
   * Get reports filed by current user
   */
  async getMyReports(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { reporterId: userId },
        include: {
          artwork: {
            select: {
              id: true,
              title: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.report.count({ where: { reporterId: userId } }),
    ])

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get all reports (admin only)
   */
  async getAllReports(query: ReportQueryDto) {
    const page = parseInt(query.page || '1', 10)
    const limit = Math.min(parseInt(query.limit || '20', 10), 50)
    const skip = (page - 1) * limit

    const where: any = {}
    if (query.type) where.type = query.type
    if (query.status) where.status = query.status

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          artwork: {
            select: {
              id: true,
              title: true,
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          targetUser: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          reviewer: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ])

    return {
      reports,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get report by ID (admin only)
   */
  async getReportById(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        artwork: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
            images: {
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        },
        targetUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
          },
        },
        comment: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
            artwork: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    })

    if (!report) {
      throw new NotFoundException('Report not found')
    }

    return report
  }

  /**
   * Update report status (admin only)
   */
  async updateReport(reportId: string, adminId: string, dto: UpdateReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    })

    if (!report) {
      throw new NotFoundException('Report not found')
    }

    const updateData: any = {
      ...dto,
      reviewedBy: adminId,
      reviewedAt: new Date(),
    }

    // Set resolvedAt if status is being changed to RESOLVED or DISMISSED
    if (dto.status === ReportStatus.RESOLVED || dto.status === ReportStatus.DISMISSED) {
      updateData.resolvedAt = new Date()
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: updateData,
      include: {
        reporter: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    })

    this.logger.log(`Report ${reportId} updated by admin ${adminId}: status=${dto.status}`)
    return updatedReport
  }

  /**
   * Get report statistics (admin only)
   */
  async getReportStats() {
    const [pending, investigating, resolved, dismissed, total] = await Promise.all([
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.report.count({ where: { status: ReportStatus.INVESTIGATING } }),
      this.prisma.report.count({ where: { status: ReportStatus.RESOLVED } }),
      this.prisma.report.count({ where: { status: ReportStatus.DISMISSED } }),
      this.prisma.report.count(),
    ])

    const byType = await this.prisma.report.groupBy({
      by: ['type'],
      _count: { type: true },
    })

    const byReason = await this.prisma.report.groupBy({
      by: ['reason'],
      _count: { reason: true },
    })

    return {
      byStatus: { pending, investigating, resolved, dismissed },
      total,
      byType: byType.map(t => ({ type: t.type, count: t._count.type })),
      byReason: byReason.map(r => ({ reason: r.reason, count: r._count.reason })),
    }
  }
}
