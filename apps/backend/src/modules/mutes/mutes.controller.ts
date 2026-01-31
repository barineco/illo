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
  Request,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { MutesService } from './mutes.service'
import { CreateUserMuteDto, CreateWordMuteDto, UpdateWordMuteDto, CreateTagMuteDto } from './dto'

@Controller('mutes')
@UseGuards(JwtAuthGuard)
export class MutesController {
  constructor(private mutesService: MutesService) {}

  // ============================================
  // User Mutes
  // ============================================

  /**
   * POST /api/mutes/users/:username
   * Mute a user
   */
  @Post('users/:username')
  async muteUser(
    @Request() req,
    @Param('username') username: string,
    @Body() dto: CreateUserMuteDto,
  ) {
    // Parse username@domain format
    const { user, domain } = this.parseUsername(username)
    return this.mutesService.muteUser(req.user.id, user, domain, dto)
  }

  /**
   * DELETE /api/mutes/users/:username
   * Unmute a user
   */
  @Delete('users/:username')
  async unmuteUser(
    @Request() req,
    @Param('username') username: string,
  ) {
    const { user, domain } = this.parseUsername(username)
    return this.mutesService.unmuteUser(req.user.id, user, domain)
  }

  /**
   * GET /api/mutes/users/:username/check
   * Check if a user is muted
   */
  @Get('users/:username/check')
  async checkUserMute(
    @Request() req,
    @Param('username') username: string,
  ) {
    const { user, domain } = this.parseUsername(username)
    return this.mutesService.checkUserMuteStatus(req.user.id, user, domain)
  }

  /**
   * GET /api/mutes/users
   * Get list of muted users
   */
  @Get('users')
  async getMutedUsers(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.mutesService.getMutedUsers(
      req.user.id,
      parseInt(page, 10),
      Math.min(parseInt(limit, 10), 50),
    )
  }

  // ============================================
  // Word Mutes
  // ============================================

  /**
   * POST /api/mutes/words
   * Create a word mute
   */
  @Post('words')
  async createWordMute(
    @Request() req,
    @Body() dto: CreateWordMuteDto,
  ) {
    return this.mutesService.createWordMute(req.user.id, dto)
  }

  /**
   * GET /api/mutes/words
   * Get list of word mutes
   */
  @Get('words')
  async getWordMutes(@Request() req) {
    return this.mutesService.getWordMutes(req.user.id)
  }

  /**
   * PATCH /api/mutes/words/:id
   * Update a word mute
   */
  @Patch('words/:id')
  async updateWordMute(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateWordMuteDto,
  ) {
    return this.mutesService.updateWordMute(req.user.id, id, dto)
  }

  /**
   * DELETE /api/mutes/words/:id
   * Delete a word mute
   */
  @Delete('words/:id')
  async deleteWordMute(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.mutesService.deleteWordMute(req.user.id, id)
  }

  // ============================================
  // Tag Mutes
  // ============================================

  /**
   * POST /api/mutes/tags/:tagName
   * Mute a tag
   */
  @Post('tags/:tagName')
  async muteTag(
    @Request() req,
    @Param('tagName') tagName: string,
    @Body() dto: CreateTagMuteDto,
  ) {
    return this.mutesService.muteTag(req.user.id, tagName, dto)
  }

  /**
   * DELETE /api/mutes/tags/:tagName
   * Unmute a tag
   */
  @Delete('tags/:tagName')
  async unmuteTag(
    @Request() req,
    @Param('tagName') tagName: string,
  ) {
    return this.mutesService.unmuteTag(req.user.id, tagName)
  }

  /**
   * GET /api/mutes/tags
   * Get list of muted tags
   */
  @Get('tags')
  async getMutedTags(@Request() req) {
    return this.mutesService.getMutedTags(req.user.id)
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Parse username@domain format
   */
  private parseUsername(input: string): { user: string; domain: string } {
    const parts = input.split('@')
    if (parts.length === 1) {
      return { user: parts[0], domain: '' }
    }
    return { user: parts[0], domain: parts[1] }
  }
}
