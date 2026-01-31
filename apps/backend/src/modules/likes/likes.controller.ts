import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { LikesService } from './likes.service'

@Controller('likes')
@UseGuards(JwtAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  /**
   * Toggle like on an artwork (recommended for UI)
   * POST /api/likes/:artworkId/toggle
   */
  @Post(':artworkId/toggle')
  async toggleLike(@Param('artworkId') artworkId: string, @Request() req) {
    return this.likesService.toggleLike(req.user.id, artworkId)
  }

  /**
   * Like an artwork (idempotent - safe to call multiple times)
   * POST /api/likes/:artworkId
   */
  @Post(':artworkId')
  async likeArtwork(@Param('artworkId') artworkId: string, @Request() req) {
    return this.likesService.likeArtwork(req.user.id, artworkId)
  }

  /**
   * Unlike an artwork (idempotent - safe to call multiple times)
   * DELETE /api/likes/:artworkId
   */
  @Delete(':artworkId')
  async unlikeArtwork(@Param('artworkId') artworkId: string, @Request() req) {
    return this.likesService.unlikeArtwork(req.user.id, artworkId)
  }

  /**
   * Check if user liked an artwork
   * GET /api/likes/:artworkId/check
   */
  @Get(':artworkId/check')
  async checkLike(@Param('artworkId') artworkId: string, @Request() req) {
    const hasLiked = await this.likesService.hasLiked(
      req.user.id,
      artworkId,
    )
    return { hasLiked }
  }

  /**
   * Get likes for an artwork
   * GET /api/likes/artwork/:artworkId
   */
  @Get('artwork/:artworkId')
  async getArtworkLikes(
    @Param('artworkId') artworkId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.likesService.getArtworkLikes(artworkId, page, limit)
  }

  /**
   * Get user's liked artworks
   * GET /api/likes/user/:username
   */
  @Get('user/:username')
  async getUserLikedArtworks(
    @Param('username') username: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.likesService.getUserLikedArtworksByUsername(
      username,
      page,
      limit,
    )
  }
}
