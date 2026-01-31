import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ActivityDeliveryService } from '../federation/services/activity-delivery.service'
import { NodeInfoCheckService } from '../federation/services/nodeinfo-check.service'
import { MessageEncryptionService } from './message-encryption.service'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { SendMessageDto } from './dto/send-message.dto'
import { ConversationQueryDto, MessageQueryDto } from './dto/conversation-query.dto'

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name)

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ActivityDeliveryService))
    private activityDelivery: ActivityDeliveryService,
    @Inject(forwardRef(() => NodeInfoCheckService))
    private nodeInfoCheck: NodeInfoCheckService,
    private messageEncryption: MessageEncryptionService,
  ) {}

  async getConversations(userId: string, query: ConversationQueryDto) {
    const { page = 1, limit = 20 } = query

    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            hasLeft: false,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                domain: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          where: { isDeleted: false },
          select: {
            id: true,
            content: true,
            contentIv: true,
            encryptionVersion: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const total = await this.prisma.conversation.count({
      where: {
        participants: {
          some: {
            userId,
            hasLeft: false,
          },
        },
      },
    })

    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const participant = conv.participants.find((p) => p.userId === userId)
        const unreadCount = await this.getConversationUnreadCount(
          conv.id,
          userId,
          participant?.lastReadAt,
        )

        const otherParticipant = conv.participants.find((p) => p.userId !== userId)

        const lastMessage = conv.messages[0]
          ? {
              id: conv.messages[0].id,
              content: this.messageEncryption.decryptMessage(conv.messages[0]),
              senderId: conv.messages[0].senderId,
              createdAt: conv.messages[0].createdAt,
            }
          : null

        return {
          id: conv.id,
          isGroup: conv.isGroup,
          title: conv.title,
          lastMessageAt: conv.lastMessageAt,
          lastMessage,
          unreadCount,
          participant: otherParticipant?.user || null,
          participants: conv.participants.map((p) => p.user),
        }
      }),
    )

    return {
      conversations: conversationsWithUnread,
      total,
      page,
      limit,
    }
  }

  async getConversation(conversationId: string, userId: string, query: MessageQueryDto) {
    const { page = 1, limit = 50 } = query

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    })

    if (!participant || participant.hasLeft) {
      throw new ForbiddenException('You are not a participant in this conversation')
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                domain: true,
              },
            },
          },
        },
      },
    })

    if (!conversation) {
      throw new NotFoundException('Conversation not found')
    }

    const messagesRaw = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            domain: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            contentIv: true,
            encryptionVersion: true,
            senderId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const messages = messagesRaw.map((msg) => ({
      ...msg,
      content: this.messageEncryption.decryptMessage(msg),
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            content: this.messageEncryption.decryptMessage(msg.replyTo),
            senderId: msg.replyTo.senderId,
          }
        : null,
    }))

    const totalMessages = await this.prisma.message.count({
      where: {
        conversationId,
        isDeleted: false,
      },
    })

    const otherParticipant = conversation.participants.find((p) => p.userId !== userId)

    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      title: conversation.title,
      participant: otherParticipant?.user || null,
      participants: conversation.participants.map((p) => p.user),
      messages: messages.reverse(), // Return in chronological order
      totalMessages,
      page,
      limit,
    }
  }

  async createConversation(senderId: string, dto: CreateConversationDto) {
    const { recipientId, initialMessage } = dto

    if (senderId === recipientId) {
      throw new BadRequestException('Cannot create conversation with yourself')
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, username: true, displayName: true, avatarUrl: true, domain: true },
    })

    if (!recipient) {
      throw new NotFoundException('Recipient not found')
    }

    const existingConversation = await this.findExistingConversation(senderId, recipientId)

    if (existingConversation) {
      if (initialMessage) {
        const message = await this.sendMessageToConversation(
          existingConversation.id,
          senderId,
          { content: initialMessage },
        )
        return {
          id: existingConversation.id,
          conversation: existingConversation,
          message,
          isNew: false,
        }
      }
      // Return existing conversation without sending a message
      return {
        id: existingConversation.id,
        conversation: existingConversation,
        message: null,
        isNew: false,
      }
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { userId: senderId },
            { userId: recipientId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                domain: true,
              },
            },
          },
        },
      },
    })

    let message = null
    if (initialMessage) {
      message = await this.sendMessageToConversation(
        conversation.id,
        senderId,
        { content: initialMessage },
      )
    }

    return {
      id: conversation.id,
      conversation: {
        id: conversation.id,
        isGroup: conversation.isGroup,
        participant: recipient,
        participants: conversation.participants.map((p) => p.user),
      },
      message,
      isNew: true,
    }
  }

  async sendMessage(conversationId: string, senderId: string, dto: SendMessageDto) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
    })

    if (!participant || participant.hasLeft) {
      throw new ForbiddenException('You are not a participant in this conversation')
    }

    return this.sendMessageToConversation(conversationId, senderId, dto)
  }

  private async sendMessageToConversation(
    conversationId: string,
    senderId: string,
    dto: SendMessageDto,
  ) {
    const { content, replyToId } = dto

    const encryptedData = this.messageEncryption.prepareForStorage(content)

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: encryptedData.content,
        contentIv: encryptedData.contentIv,
        encryptionVersion: encryptedData.encryptionVersion,
        replyToId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            domain: true,
          },
        },
        conversation: {
          include: {
            participants: {
              select: {
                userId: true,
                user: {
                  select: {
                    id: true,
                    domain: true,
                    inbox: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    })

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: senderId,
        },
      },
      data: { lastReadAt: new Date() },
    })

    const remoteRecipients = message.conversation.participants
      .filter((p) => p.userId !== senderId && p.user.domain !== '' && p.user.inbox)
      .map((p) => ({
        id: p.user.id,
        inbox: p.user.inbox,
        domain: p.user.domain,
        actorUrl: null as string | null, // Will be fetched
      }))

    if (remoteRecipients.length > 0) {
      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
      })

      if (sender && sender.domain === '') {
        const recipientUsers = await this.prisma.user.findMany({
          where: {
            id: { in: remoteRecipients.map((r) => r.id) },
          },
          select: { id: true, actorUrl: true, inbox: true, domain: true },
        })

        const recipientsWithActors = recipientUsers.map((u) => ({
          id: u.id,
          inbox: u.inbox,
          domain: u.domain,
          actorUrl: u.actorUrl,
        }))

        const fullMessage = await this.prisma.message.findUnique({
          where: { id: message.id },
        })

        if (fullMessage) {
          const messageForFederation = {
            ...fullMessage,
            content,
          }

          this.activityDelivery
            .sendDirectMessage(sender, messageForFederation, recipientsWithActors)
            .then((results) => {
              const successful = results.filter((r) => r.success).length
              const encrypted = results.filter((r) => r.encrypted).length
              this.logger.log(
                `Delivered DM to ${successful}/${results.length} remote recipients (${encrypted} encrypted)`,
              )
            })
            .catch((err) => {
              this.logger.error(`Failed to deliver DM: ${err.message}`)
            })
        }
      }
    }

    return {
      id: message.id,
      content,
      senderId: message.senderId,
      sender: message.sender,
      createdAt: message.createdAt,
      replyToId: message.replyToId,
    }
  }

  async markAsRead(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    })

    if (!participant) {
      throw new NotFoundException('Conversation not found')
    }

    await this.prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: new Date() },
    })

    return { success: true }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        userId,
        hasLeft: false,
      },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    })

    let totalUnread = 0

    for (const participant of participants) {
      const count = await this.getConversationUnreadCount(
        participant.conversationId,
        userId,
        participant.lastReadAt,
      )
      totalUnread += count
    }

    return totalUnread
  }

  private async getConversationUnreadCount(
    conversationId: string,
    userId: string,
    lastReadAt: Date | null,
  ): Promise<number> {
    const whereClause: any = {
      conversationId,
      senderId: { not: userId },
      isDeleted: false,
    }

    if (lastReadAt) {
      whereClause.createdAt = { gt: lastReadAt }
    }

    return this.prisma.message.count({ where: whereClause })
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages')
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    })

    return { success: true }
  }

  async findExistingConversation(userId1: string, userId2: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        isGroup: false,
        participants: {
          every: {
            userId: { in: [userId1, userId2] },
            hasLeft: false,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                domain: true,
              },
            },
          },
        },
        _count: {
          select: { participants: true },
        },
      },
    })

    const conversation = conversations.find((c) => c._count.participants === 2)

    if (!conversation) {
      return null
    }

    const otherParticipant = conversation.participants.find((p) => p.userId !== userId1)

    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      participant: otherParticipant?.user || null,
      participants: conversation.participants.map((p) => p.user),
    }
  }

  async findOrCreateConversationByActors(actorUrls: string[]): Promise<string | null> {
    const users = await this.prisma.user.findMany({
      where: {
        actorUrl: { in: actorUrls },
      },
      select: { id: true },
    })

    if (users.length !== actorUrls.length) {
      return null
    }

    const userIds = users.map((u) => u.id)

    if (userIds.length !== 2) {
      // Only support 1-on-1 for now
      return null
    }

    const existing = await this.findExistingConversation(userIds[0], userIds[1])
    if (existing) {
      return existing.id
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: userIds.map((userId) => ({ userId })),
        },
      },
    })

    return conversation.id
  }

  async handleIncomingDM(
    senderId: string,
    conversationId: string,
    content: string,
    apActivityId: string,
  ) {
    const existing = await this.prisma.message.findUnique({
      where: { apActivityId },
    })

    if (existing) {
      return existing
    }

    const encryptedData = this.messageEncryption.prepareForStorage(content)

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: encryptedData.content,
        contentIv: encryptedData.contentIv,
        encryptionVersion: encryptedData.encryptionVersion,
        apActivityId,
        federated: true,
      },
    })

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    })

    return message
  }

  async getEncryptionStatus(conversationId: string, userId: string): Promise<{
    encryptionSupported: boolean
    status: 'all_local' | 'all_supported' | 'partial' | 'none'
    supportedDomains: string[]
    unsupportedDomains: string[]
  }> {
    // Verify user is a participant
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    })

    if (!participant) {
      throw new NotFoundException('Conversation not found')
    }

    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: {
        user: {
          select: {
            id: true,
            domain: true,
          },
        },
      },
    })

    const remoteDomains = new Set<string>()
    let hasLocalOnly = true

    for (const p of participants) {
      if (p.user.domain && p.user.domain !== '') {
        remoteDomains.add(p.user.domain)
        hasLocalOnly = false
      }
    }

    if (hasLocalOnly) {
      return {
        encryptionSupported: true,
        status: 'all_local',
        supportedDomains: [],
        unsupportedDomains: [],
      }
    }

    this.logger.debug(`Checking encryption support for domains: ${Array.from(remoteDomains).join(', ')}`)
    const encryptionSupport = await this.nodeInfoCheck.checkEncryptionSupport(
      Array.from(remoteDomains),
    )
    this.logger.debug(`Encryption support result: supported=${encryptionSupport.supportedDomains.join(',')}, unsupported=${encryptionSupport.unsupportedDomains.join(',')}`)

    let status: 'all_local' | 'all_supported' | 'partial' | 'none'
    if (encryptionSupport.unsupportedDomains.length === 0) {
      status = 'all_supported'
    } else if (encryptionSupport.supportedDomains.length === 0) {
      status = 'none'
    } else {
      status = 'partial'
    }

    return {
      encryptionSupported: encryptionSupport.allSupported,
      status,
      supportedDomains: encryptionSupport.supportedDomains,
      unsupportedDomains: encryptionSupport.unsupportedDomains,
    }
  }
}
