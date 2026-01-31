import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common'
import { Request as ExpressRequest } from 'express'
import { Public } from '../auth/decorators/public.decorator'
import { AnonymousReactionRateLimitGuard } from './guards/anonymous-rate-limit.guard'
import { ReactionsService } from './reactions.service'
import { CreateReactionDto } from './dto/create-reaction.dto'

@Controller('reactions')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  /**
   * Add a reaction to an artwork (supports both logged-in and anonymous users)
   * POST /api/reactions/:artworkId
   */
  @Post(':artworkId')
  @Public()
  @UseGuards(AnonymousReactionRateLimitGuard)
  async addReaction(
    @Param('artworkId') artworkId: string,
    @Body() dto: CreateReactionDto,
    @Request() req: ExpressRequest,
  ) {
    const user = (req as any).user
    const ipHash = req.ipHash || this.getIpHash(req)

    return this.reactionsService.addReaction(
      artworkId,
      dto.emoji,
      user?.id,
      user?.id ? undefined : ipHash,
    )
  }

  /**
   * Remove a reaction from an artwork (supports both logged-in and anonymous users)
   * DELETE /api/reactions/:artworkId/:emoji
   */
  @Delete(':artworkId/:emoji')
  @Public()
  async removeReaction(
    @Param('artworkId') artworkId: string,
    @Param('emoji') emoji: string,
    @Request() req: ExpressRequest,
  ) {
    const user = (req as any).user
    const ipHash = req.ipHash || this.getIpHash(req)

    return this.reactionsService.removeReaction(
      artworkId,
      decodeURIComponent(emoji),
      user?.id,
      user?.id ? undefined : ipHash,
    )
  }

  /**
   * Toggle a reaction on an artwork (supports both logged-in and anonymous users)
   * POST /api/reactions/:artworkId/toggle
   */
  @Post(':artworkId/toggle')
  @Public()
  @UseGuards(AnonymousReactionRateLimitGuard)
  async toggleReaction(
    @Param('artworkId') artworkId: string,
    @Body() dto: CreateReactionDto,
    @Request() req: ExpressRequest,
  ) {
    const user = (req as any).user
    const ipHash = req.ipHash || this.getIpHash(req)

    return this.reactionsService.toggleReaction(
      artworkId,
      dto.emoji,
      user?.id,
      user?.id ? undefined : ipHash,
    )
  }

  /**
   * Get aggregated reactions for an artwork
   * GET /api/reactions/:artworkId
   */
  @Get(':artworkId')
  @Public()
  async getReactions(@Param('artworkId') artworkId: string) {
    return this.reactionsService.getArtworkReactions(artworkId)
  }

  /**
   * Check user's reactions for an artwork
   * GET /api/reactions/:artworkId/check
   */
  @Get(':artworkId/check')
  @Public()
  async checkReactions(
    @Param('artworkId') artworkId: string,
    @Request() req: ExpressRequest,
  ) {
    const user = (req as any).user
    const ipHash = req.ipHash || this.getIpHash(req)

    return this.reactionsService.getUserReactions(
      artworkId,
      user?.id,
      user?.id ? undefined : ipHash,
    )
  }

  /**
   * Get IP hash for anonymous users
   */
  private getIpHash(req: ExpressRequest): string {
    const ip = this.getClientIp(req)
    return this.reactionsService.hashIp(ip)
  }

  private getClientIp(request: ExpressRequest): string {
    const forwarded = request.headers['x-forwarded-for']
    if (forwarded) {
      const ips = typeof forwarded === 'string' ? forwarded : forwarded[0]
      return ips.split(',')[0].trim()
    }

    const realIp = request.headers['x-real-ip']
    if (realIp) {
      return typeof realIp === 'string' ? realIp : realIp[0]
    }

    return request.ip || request.socket?.remoteAddress || '0.0.0.0'
  }
}
