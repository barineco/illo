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
import { BookmarksService } from './bookmarks.service'

@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  /**
   * Toggle bookmark on an artwork
   * POST /api/bookmarks/:artworkId/toggle
   */
  @Post(':artworkId/toggle')
  async toggleBookmark(@Param('artworkId') artworkId: string, @Request() req) {
    return this.bookmarksService.toggleBookmark(req.user.id, artworkId)
  }

  /**
   * Bookmark an artwork (idempotent)
   * POST /api/bookmarks/:artworkId
   */
  @Post(':artworkId')
  async bookmarkArtwork(
    @Param('artworkId') artworkId: string,
    @Request() req,
  ) {
    return this.bookmarksService.bookmarkArtwork(req.user.id, artworkId)
  }

  /**
   * Remove bookmark from an artwork
   * DELETE /api/bookmarks/:artworkId
   */
  @Delete(':artworkId')
  async unbookmarkArtwork(
    @Param('artworkId') artworkId: string,
    @Request() req,
  ) {
    return this.bookmarksService.unbookmarkArtwork(req.user.id, artworkId)
  }

  /**
   * Check if user bookmarked an artwork
   * GET /api/bookmarks/:artworkId/check
   */
  @Get(':artworkId/check')
  async checkBookmark(@Param('artworkId') artworkId: string, @Request() req) {
    const hasBookmarked = await this.bookmarksService.hasBookmarked(
      req.user.id,
      artworkId,
    )
    return { hasBookmarked }
  }

  /**
   * Get user's bookmarked artworks
   * GET /api/bookmarks/user/:username
   */
  @Get('user/:username')
  async getUserBookmarkedArtworks(
    @Param('username') username: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Request() req,
  ) {
    // For now, use the authenticated user's ID
    // Bookmarks are private, so only the owner can see them
    return this.bookmarksService.getUserBookmarkedArtworks(
      req.user.id,
      page,
      limit,
    )
  }
}
