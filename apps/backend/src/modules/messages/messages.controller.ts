import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { MessagesService } from './messages.service'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { SendMessageDto } from './dto/send-message.dto'
import { ConversationQueryDto, MessageQueryDto } from './dto/conversation-query.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('conversations')
  async getConversations(
    @CurrentUser('id') userId: string,
    @Query() query: ConversationQueryDto,
  ) {
    return this.messagesService.getConversations(userId, query)
  }

  @Get('conversations/:id')
  async getConversation(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Query() query: MessageQueryDto,
  ) {
    return this.messagesService.getConversation(conversationId, userId, query)
  }

  @Post('conversations')
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.messagesService.createConversation(userId, dto)
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(conversationId, userId, dto)
  }

  @Patch('conversations/:id/read')
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.markAsRead(conversationId, userId)
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.messagesService.getUnreadCount(userId)
    return { count }
  }

  @Delete(':messageId')
  async deleteMessage(
    @CurrentUser('id') userId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.deleteMessage(messageId, userId)
  }

  @Get('conversation-with/:userId')
  async getConversationWith(
    @CurrentUser('id') currentUserId: string,
    @Param('userId') otherUserId: string,
  ) {
    const conversation = await this.messagesService.findExistingConversation(
      currentUserId,
      otherUserId,
    )
    return { conversation }
  }

  @Get('conversations/:id/encryption-status')
  async getEncryptionStatus(
    @CurrentUser('id') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messagesService.getEncryptionStatus(conversationId, userId)
  }
}
