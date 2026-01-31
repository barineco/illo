import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserMuteDto, CreateWordMuteDto, UpdateWordMuteDto, CreateTagMuteDto } from './dto'

@Injectable()
export class MutesService {
  private readonly logger = new Logger(MutesService.name)

  constructor(private prisma: PrismaService) {}

  async muteUser(muterId: string, username: string, domain: string = '', dto: CreateUserMuteDto) {
    const targetUser = await this.prisma.user.findFirst({
      where: { username, domain },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    if (targetUser.id === muterId) {
      throw new BadRequestException('Cannot mute yourself')
    }

    const expiresAt = dto.duration
      ? new Date(Date.now() + dto.duration * 1000)
      : null

    const mute = await this.prisma.userMute.upsert({
      where: {
        muterId_mutedId: {
          muterId,
          mutedId: targetUser.id,
        },
      },
      update: {
        muteNotifications: dto.muteNotifications ?? true,
        duration: dto.duration ?? null,
        expiresAt,
      },
      create: {
        muterId,
        mutedId: targetUser.id,
        muteNotifications: dto.muteNotifications ?? true,
        duration: dto.duration ?? null,
        expiresAt,
      },
      include: {
        muted: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            domain: true,
          },
        },
      },
    })

    this.logger.log(`User ${muterId} muted ${targetUser.username}@${domain || 'local'}`)
    return mute
  }

  async unmuteUser(muterId: string, username: string, domain: string = '') {
    const targetUser = await this.prisma.user.findFirst({
      where: { username, domain },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    const mute = await this.prisma.userMute.findUnique({
      where: {
        muterId_mutedId: {
          muterId,
          mutedId: targetUser.id,
        },
      },
    })

    if (!mute) {
      throw new NotFoundException('Mute not found')
    }

    await this.prisma.userMute.delete({
      where: { id: mute.id },
    })

    this.logger.log(`User ${muterId} unmuted ${targetUser.username}@${domain || 'local'}`)
    return { success: true }
  }

  async isUserMuted(muterId: string, mutedId: string): Promise<boolean> {
    const mute = await this.prisma.userMute.findUnique({
      where: {
        muterId_mutedId: {
          muterId,
          mutedId,
        },
      },
    })

    if (!mute) return false

    if (mute.expiresAt && mute.expiresAt < new Date()) {
      await this.prisma.userMute.delete({ where: { id: mute.id } })
      return false
    }

    return true
  }

  async checkUserMuteStatus(muterId: string, username: string, domain: string = '') {
    const targetUser = await this.prisma.user.findFirst({
      where: { username, domain },
    })

    if (!targetUser) {
      throw new NotFoundException('User not found')
    }

    const isMuted = await this.isUserMuted(muterId, targetUser.id)
    return { isMuted, userId: targetUser.id }
  }

  async getMutedUsers(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit
    const now = new Date()

    const [mutes, total] = await Promise.all([
      this.prisma.userMute.findMany({
        where: {
          muterId: userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        include: {
          muted: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              domain: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.userMute.count({
        where: {
          muterId: userId,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
      }),
    ])

    return {
      mutes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getMutedUserIds(userId: string): Promise<string[]> {
    const now = new Date()
    const mutes = await this.prisma.userMute.findMany({
      where: {
        muterId: userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: { mutedId: true },
    })
    return mutes.map(m => m.mutedId)
  }

  async createWordMute(userId: string, dto: CreateWordMuteDto) {
    if (dto.regex) {
      try {
        new RegExp(dto.keyword)
      } catch {
        throw new BadRequestException('Invalid regex pattern')
      }
    }

    const expiresAt = dto.duration
      ? new Date(Date.now() + dto.duration * 1000)
      : null

    const wordMute = await this.prisma.wordMute.create({
      data: {
        userId,
        keyword: dto.keyword,
        regex: dto.regex ?? false,
        wholeWord: dto.wholeWord ?? false,
        caseSensitive: dto.caseSensitive ?? false,
        duration: dto.duration ?? null,
        expiresAt,
      },
    })

    this.logger.log(`User ${userId} created word mute: "${dto.keyword}"`)
    return wordMute
  }

  async updateWordMute(userId: string, muteId: string, dto: UpdateWordMuteDto) {
    const mute = await this.prisma.wordMute.findFirst({
      where: { id: muteId, userId },
    })

    if (!mute) {
      throw new NotFoundException('Word mute not found')
    }

    const expiresAt = dto.duration !== undefined
      ? (dto.duration ? new Date(Date.now() + dto.duration * 1000) : null)
      : mute.expiresAt

    return this.prisma.wordMute.update({
      where: { id: muteId },
      data: {
        regex: dto.regex ?? mute.regex,
        wholeWord: dto.wholeWord ?? mute.wholeWord,
        caseSensitive: dto.caseSensitive ?? mute.caseSensitive,
        duration: dto.duration ?? mute.duration,
        expiresAt,
      },
    })
  }

  async deleteWordMute(userId: string, muteId: string) {
    const mute = await this.prisma.wordMute.findFirst({
      where: { id: muteId, userId },
    })

    if (!mute) {
      throw new NotFoundException('Word mute not found')
    }

    await this.prisma.wordMute.delete({ where: { id: muteId } })
    this.logger.log(`User ${userId} deleted word mute: "${mute.keyword}"`)
    return { success: true }
  }

  async getWordMutes(userId: string) {
    const now = new Date()
    return this.prisma.wordMute.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async matchesWordMute(userId: string, text: string): Promise<boolean> {
    const wordMutes = await this.getWordMutes(userId)

    for (const mute of wordMutes) {
      if (this.textMatchesWordMute(text, mute)) {
        return true
      }
    }

    return false
  }

  private textMatchesWordMute(
    text: string,
    mute: { keyword: string; regex: boolean; wholeWord: boolean; caseSensitive: boolean }
  ): boolean {
    const searchText = mute.caseSensitive ? text : text.toLowerCase()
    const keyword = mute.caseSensitive ? mute.keyword : mute.keyword.toLowerCase()

    if (mute.regex) {
      try {
        const flags = mute.caseSensitive ? '' : 'i'
        const regex = new RegExp(mute.keyword, flags)
        return regex.test(text)
      } catch {
        return false
      }
    }

    if (mute.wholeWord) {
      const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, mute.caseSensitive ? '' : 'i')
      return regex.test(text)
    }

    return searchText.includes(keyword)
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  async muteTag(userId: string, tagName: string, dto: CreateTagMuteDto) {
    let tag = await this.prisma.tag.findUnique({
      where: { name: tagName.toLowerCase() },
    })

    if (!tag) {
      tag = await this.prisma.tag.create({
        data: { name: tagName.toLowerCase() },
      })
    }

    const expiresAt = dto.duration
      ? new Date(Date.now() + dto.duration * 1000)
      : null

    const tagMute = await this.prisma.tagMute.upsert({
      where: {
        userId_tagId: {
          userId,
          tagId: tag.id,
        },
      },
      update: {
        duration: dto.duration ?? null,
        expiresAt,
      },
      create: {
        userId,
        tagId: tag.id,
        duration: dto.duration ?? null,
        expiresAt,
      },
      include: {
        tag: true,
      },
    })

    this.logger.log(`User ${userId} muted tag: #${tagName}`)
    return tagMute
  }

  async unmuteTag(userId: string, tagName: string) {
    const tag = await this.prisma.tag.findUnique({
      where: { name: tagName.toLowerCase() },
    })

    if (!tag) {
      throw new NotFoundException('Tag not found')
    }

    const mute = await this.prisma.tagMute.findUnique({
      where: {
        userId_tagId: {
          userId,
          tagId: tag.id,
        },
      },
    })

    if (!mute) {
      throw new NotFoundException('Tag mute not found')
    }

    await this.prisma.tagMute.delete({ where: { id: mute.id } })
    this.logger.log(`User ${userId} unmuted tag: #${tagName}`)
    return { success: true }
  }

  async getMutedTags(userId: string) {
    const now = new Date()
    return this.prisma.tagMute.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      include: {
        tag: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getMutedTagIds(userId: string): Promise<string[]> {
    const now = new Date()
    const mutes = await this.prisma.tagMute.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      select: { tagId: true },
    })
    return mutes.map(m => m.tagId)
  }

  async cleanupExpiredMutes() {
    const now = new Date()

    const [userMutes, wordMutes, tagMutes] = await Promise.all([
      this.prisma.userMute.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      }),
      this.prisma.wordMute.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      }),
      this.prisma.tagMute.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      }),
    ])

    const total = userMutes.count + wordMutes.count + tagMutes.count
    if (total > 0) {
      this.logger.log(`Cleaned up ${total} expired mutes`)
    }
  }
}
