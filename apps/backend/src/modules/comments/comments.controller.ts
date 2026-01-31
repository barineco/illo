import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { Public } from '../auth/decorators/public.decorator'
import { CommentsService } from './comments.service'
import { CreateCommentDto } from './dto/create-comment.dto'
import { UpdateCommentDto } from './dto/update-comment.dto'

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Create a comment on an artwork
   * POST /api/comments/artwork/:artworkId
   */
  @Post('artwork/:artworkId')
  @UseGuards(JwtAuthGuard)
  async createComment(
    @Param('artworkId') artworkId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req,
  ) {
    return this.commentsService.createComment(
      req.user.id,
      artworkId,
      createCommentDto,
    )
  }

  /**
   * Get comments for an artwork
   * GET /api/comments/artwork/:artworkId
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('artwork/:artworkId')
  async getArtworkComments(
    @Param('artworkId') artworkId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Request() req,
  ) {
    return this.commentsService.getArtworkComments(artworkId, page, limit, req.user?.id)
  }

  /**
   * Update a comment
   * PUT /api/comments/:commentId
   */
  @Put(':commentId')
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req,
  ) {
    return this.commentsService.updateComment(
      commentId,
      req.user.id,
      updateCommentDto,
    )
  }

  /**
   * Delete a comment
   * DELETE /api/comments/:commentId
   */
  @Delete(':commentId')
  @UseGuards(JwtAuthGuard)
  async deleteComment(@Param('commentId') commentId: string, @Request() req) {
    return this.commentsService.deleteComment(commentId, req.user.id)
  }
}
