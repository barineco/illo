import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Headers,
  Res,
  Inject,
  forwardRef,
} from '@nestjs/common'
import { Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  UsersService,
  UpdateProfileDto,
  UpdateBirthdayDto,
  UpdateContentFiltersDto,
} from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { ActorService } from '../federation/services/actor.service'
import { OCsService } from '../ocs/ocs.service'
import { OCQueryDto } from '../ocs/dto/oc-query.dto'

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    @Inject(forwardRef(() => ActorService))
    private actorService: ActorService,
    private ocsService: OCsService,
  ) {}

  /**
   * Get user profile by username (public) with content negotiation
   * GET /users/:username (excluded from /api prefix in main.ts)
   * Supports both local users ("username") and remote users ("username@domain")
   * Content negotiation based on Accept header:
   * - Accept: application/activity+json → ActivityPub Actor JSON
   * - Accept: application/json → User profile JSON (API)
   * - Accept: text/html → Redirect to frontend
   */
  @Public()
  @Get(':username')
  async getUserProfile(
    @Param('username') username: string,
    @Headers('accept') acceptHeader: string,
    @Res() res: Response,
  ) {
    // Debug: Log the Accept header
    console.log(`[UsersController] GET /users/${username} - Accept: ${acceptHeader}`)

    // 1. Check for ActivityPub request
    const wantsActivityPub =
      acceptHeader?.includes('application/activity+json') ||
      acceptHeader?.includes('application/ld+json')

    if (wantsActivityPub) {
      // Return ActivityPub Actor JSON (local users only)
      // Parse handle to check if it's a local user
      const parts = username.split('@')
      const isLocalUser = parts.length === 1

      if (!isLocalUser) {
        // Remote users don't have Actor objects on this instance
        return res.status(404).json({ error: 'Remote user Actor not available on this instance' })
      }

      const actor = await this.actorService.getLocalActorByUsername(username)
      res.setHeader('Vary', 'Accept')
      return res
        .setHeader('Content-Type', 'application/activity+json; charset=utf-8')
        .json(actor)
    }

    // 2. Check for JSON API request (from frontend axios)
    const wantsJson = acceptHeader?.includes('application/json')

    if (wantsJson) {
      // Return standard user profile JSON (supports both local and remote users)
      const user = await this.usersService.getUserByUsername(username, false)
      res.setHeader('Vary', 'Accept')
      return res.json(user)
    }

    // 3. Browser request (text/html) - should be handled by nginx routing to frontend
    // If it reaches here, return 404 to avoid redirect loops
    return res.status(404).json({
      error: 'Not Found',
      message: 'HTML requests should be routed to frontend via nginx'
    })
  }

  /**
   * Update current user's profile (authenticated)
   * PUT /api/users/:username
   */
  @Put(':username')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Param('username') username: string,
    @Body() updateData: UpdateProfileDto,
    @CurrentUser() currentUser: any,
  ) {
    // Check if user is updating their own profile
    if (currentUser.username !== username) {
      throw new ForbiddenException('You can only update your own profile')
    }

    return this.usersService.updateProfile(currentUser.id, updateData)
  }

  /**
   * Get current user's own profile with email (authenticated)
   * GET /api/users/:username/me
   */
  @Get(':username/me')
  @UseGuards(JwtAuthGuard)
  async getOwnProfile(
    @Param('username') username: string,
    @CurrentUser() currentUser: any,
  ) {
    // Check if user is requesting their own profile
    if (currentUser.username !== username) {
      throw new ForbiddenException('You can only access your own detailed profile')
    }

    return this.usersService.getUserById(currentUser.id, true)
  }

  /**
   * Upload avatar image (authenticated)
   * POST /api/users/:username/avatar
   */
  @Post(':username/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Param('username') username: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser() currentUser: any,
  ) {
    // Check if user is updating their own profile
    if (currentUser.username !== username) {
      throw new ForbiddenException('You can only update your own profile')
    }

    if (!file) {
      throw new BadRequestException('No file provided')
    }

    // Parse crop coordinates if provided
    let cropRegion: { x: number; y: number; width: number; height: number } | undefined
    if (body.cropX !== undefined && body.cropY !== undefined &&
        body.cropWidth !== undefined && body.cropHeight !== undefined) {
      cropRegion = {
        x: parseInt(body.cropX, 10),
        y: parseInt(body.cropY, 10),
        width: parseInt(body.cropWidth, 10),
        height: parseInt(body.cropHeight, 10),
      }
    }

    return this.usersService.uploadAvatar(currentUser.id, file, cropRegion)
  }

  /**
   * Upload cover image (authenticated)
   * POST /api/users/:username/cover
   */
  @Post(':username/cover')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('cover'))
  async uploadCover(
    @Param('username') username: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser() currentUser: any,
  ) {
    // Check if user is updating their own profile
    if (currentUser.username !== username) {
      throw new ForbiddenException('You can only update your own profile')
    }

    if (!file) {
      throw new BadRequestException('No file provided')
    }

    // Parse crop coordinates if provided
    let cropRegion: { x: number; y: number; width: number; height: number } | undefined
    if (body.cropX !== undefined && body.cropY !== undefined &&
        body.cropWidth !== undefined && body.cropHeight !== undefined) {
      cropRegion = {
        x: parseInt(body.cropX, 10),
        y: parseInt(body.cropY, 10),
        width: parseInt(body.cropWidth, 10),
        height: parseInt(body.cropHeight, 10),
      }
    }

    return this.usersService.uploadCoverImage(currentUser.id, file, cropRegion)
  }

  /**
   * Get user by Bluesky handle (public)
   * GET /api/users/by-bluesky/:handle
   */
  @Public()
  @Get('by-bluesky/:handle')
  async getUserByBlueskyHandle(@Param('handle') handle: string) {
    const user = await this.usersService.getUserByBlueskyHandle(handle)
    if (!user) {
      throw new NotFoundException(`No user found with Bluesky handle: ${handle}`)
    }
    return user
  }

  /**
   * Get current user's dashboard stats (authenticated)
   * GET /api/users/me/stats
   */
  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  async getDashboardStats(@CurrentUser() currentUser: any) {
    return this.usersService.getDashboardStats(currentUser.id)
  }

  /**
   * Get current user's artworks with stats (authenticated)
   * GET /api/users/me/artworks
   */
  @Get('me/artworks')
  @UseGuards(JwtAuthGuard)
  async getMyArtworks(@CurrentUser() currentUser: any) {
    return this.usersService.getMyArtworks(currentUser.id)
  }

  // ========================================
  // Birthday & Content Filters
  // ========================================

  /**
   * Get all content settings (birthday + filters) for settings page (authenticated)
   * GET /api/users/me/content-settings
   */
  @Get('me/content-settings')
  @UseGuards(JwtAuthGuard)
  async getContentSettings(@CurrentUser() currentUser: any) {
    return this.usersService.getContentSettings(currentUser.id)
  }

  /**
   * Update current user's birthday and display setting (authenticated)
   * PUT /api/users/me/birthday
   */
  @Put('me/birthday')
  @UseGuards(JwtAuthGuard)
  async updateBirthday(
    @Body() dto: UpdateBirthdayDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.updateBirthday(currentUser.id, dto)
  }

  /**
   * Get current user's content filters (authenticated)
   * GET /api/users/me/content-filters
   */
  @Get('me/content-filters')
  @UseGuards(JwtAuthGuard)
  async getContentFilters(@CurrentUser() currentUser: any) {
    return this.usersService.getContentFilters(currentUser.id)
  }

  /**
   * Update current user's content filters (authenticated)
   * PUT /api/users/me/content-filters
   */
  @Put('me/content-filters')
  @UseGuards(JwtAuthGuard)
  async updateContentFilters(
    @Body() dto: UpdateContentFiltersDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.usersService.updateContentFilters(currentUser.id, dto)
  }

  // ========================================
  // Portfolio Tools
  // ========================================

  /**
   * Get current user's portfolio tools and settings (authenticated)
   * GET /api/users/me/tools
   */
  @Get('me/tools')
  @UseGuards(JwtAuthGuard)
  async getMyTools(@CurrentUser() currentUser: any) {
    const settings = await this.usersService.getToolsSettings(currentUser.id)
    return settings
  }

  /**
   * Update current user's portfolio tools and/or settings (authenticated)
   * PUT /api/users/me/tools
   */
  @Put('me/tools')
  @UseGuards(JwtAuthGuard)
  async updateMyTools(
    @Body() dto: { tools?: string[]; useProfileToolsAsDefault?: boolean },
    @CurrentUser() currentUser: any,
  ) {
    if (dto.tools !== undefined && !Array.isArray(dto.tools)) {
      throw new BadRequestException('tools must be an array')
    }
    if (dto.useProfileToolsAsDefault !== undefined && typeof dto.useProfileToolsAsDefault !== 'boolean') {
      throw new BadRequestException('useProfileToolsAsDefault must be a boolean')
    }
    const settings = await this.usersService.updateToolsSettings(currentUser.id, dto)
    return settings
  }

  /**
   * Add a tool to current user's portfolio tools (authenticated)
   * POST /api/users/me/tools
   */
  @Post('me/tools')
  @UseGuards(JwtAuthGuard)
  async addTool(
    @Body() dto: { tool: string },
    @CurrentUser() currentUser: any,
  ) {
    if (!dto.tool || typeof dto.tool !== 'string') {
      throw new BadRequestException('tool must be a non-empty string')
    }
    const tools = await this.usersService.addTool(currentUser.id, dto.tool)
    return { tools }
  }

  /**
   * Get user's portfolio tools by username (public)
   * GET /api/users/:username/tools
   */
  @Public()
  @Get(':username/tools')
  async getUserTools(@Param('username') username: string) {
    const tools = await this.usersService.getToolsUsedByUsername(username)
    return { tools }
  }

  /**
   * Get user's top tags (most frequently used tags in their artworks)
   * GET /api/users/:username/top-tags
   */
  @Public()
  @Get(':username/top-tags')
  async getUserTopTags(
    @Param('username') username: string,
    @Query('limit') limit?: string,
  ) {
    const tags = await this.usersService.getUserTopTags(
      username,
      limit ? parseInt(limit, 10) : 10,
    )
    return { tags }
  }

  /**
   * Get user's original characters
   * GET /api/users/:username/characters
   */
  @Public()
  @Get(':username/characters')
  async getUserCharacters(
    @Param('username') username: string,
    @Query() query: OCQueryDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.ocsService.findByUser(username, query, currentUserId)
  }
}
