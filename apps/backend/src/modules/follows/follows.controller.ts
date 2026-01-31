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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { Public } from '../auth/decorators/public.decorator'
import { FollowsService } from './follows.service'

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  /**
   * Toggle follow on a user
   * POST /api/follows/:username/toggle
   */
  @Post(':username/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleFollow(@Param('username') username: string, @Request() req) {
    return this.followsService.toggleFollow(req.user.id, username)
  }

  /**
   * Follow a user (idempotent)
   * POST /api/follows/:username
   */
  @Post(':username')
  @UseGuards(JwtAuthGuard)
  async followUser(@Param('username') username: string, @Request() req) {
    return this.followsService.followUser(req.user.id, username)
  }

  /**
   * Unfollow a user
   * DELETE /api/follows/:username
   */
  @Delete(':username')
  @UseGuards(JwtAuthGuard)
  async unfollowUser(@Param('username') username: string, @Request() req) {
    return this.followsService.unfollowUser(req.user.id, username)
  }

  /**
   * Check if following a user
   * GET /api/follows/:username/check
   */
  @Get(':username/check')
  @UseGuards(JwtAuthGuard)
  async checkFollow(@Param('username') username: string, @Request() req) {
    return this.followsService.isFollowing(req.user.id, username)
  }

  /**
   * Get followers of a user (public, but isFollowing only shown when authenticated)
   * GET /api/follows/:username/followers
   */
  @Get(':username/followers')
  @UseGuards(OptionalJwtAuthGuard)
  async getFollowers(
    @Param('username') username: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const requesterId = req.user?.id || null
    return this.followsService.getFollowers(username, requesterId, page, limit)
  }

  /**
   * Get users that a user is following (public, but isFollowing only shown when authenticated)
   * GET /api/follows/:username/following
   */
  @Get(':username/following')
  @UseGuards(OptionalJwtAuthGuard)
  async getFollowing(
    @Param('username') username: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Request() req,
  ) {
    const requesterId = req.user?.id || null
    return this.followsService.getFollowing(username, requesterId, page, limit)
  }

  /**
   * Get follow counts for a user (public)
   * GET /api/follows/:username/counts
   */
  @Get(':username/counts')
  @Public()
  async getFollowCounts(@Param('username') username: string) {
    return this.followsService.getFollowCounts(username)
  }
}
