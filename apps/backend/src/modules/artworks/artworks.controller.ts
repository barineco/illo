import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common'
import { Request } from 'express'
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express'
import { ArtworksService, CreateArtworkDto, UpdateArtworkDto, ImageOperation, GenerateOgCardDto } from './artworks.service'
import { UploadLinkCardDto } from './dto/upload-link-card.dto'
import { UsersService } from '../users/users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { RateLimit } from '../rate-limit/decorators/rate-limit.decorator'
import { RateLimitGuard } from '../rate-limit/rate-limit.guard'
import { RateLimitInterceptor } from '../rate-limit/rate-limit.interceptor'
import { ArtworkType, AgeRating, Visibility, RateLimitTier, CreationPeriodUnit, ArtworkMedium } from '@prisma/client'

@Controller('artworks')
export class ArtworksController {
  constructor(
    private artworksService: ArtworksService,
    private usersService: UsersService,
  ) {}

  /**
   * Create new artwork
   * POST /api/artworks
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 100)) // Max 100 images
  async createArtwork(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    // Parse toolsUsed from JSON string if provided
    let toolsUsed: string[] | undefined
    if (body.toolsUsed) {
      try {
        toolsUsed = typeof body.toolsUsed === 'string' ? JSON.parse(body.toolsUsed) : body.toolsUsed
      } catch {
        toolsUsed = Array.isArray(body.toolsUsed) ? body.toolsUsed : [body.toolsUsed]
      }
    }

    // Parse OG card crop coordinates
    let ogCardCrop: { x: number; y: number; width: number; height: number } | undefined
    if (body.ogCardCropX !== undefined && body.ogCardCropY !== undefined &&
        body.ogCardCropWidth !== undefined && body.ogCardCropHeight !== undefined) {
      ogCardCrop = {
        x: parseInt(body.ogCardCropX, 10),
        y: parseInt(body.ogCardCropY, 10),
        width: parseInt(body.ogCardCropWidth, 10),
        height: parseInt(body.ogCardCropHeight, 10),
      }
    }

    // Parse OG card blur
    const ogCardBlur = body.ogCardBlur === 'true' || body.ogCardBlur === true

    // Parse form data
    const createDto: CreateArtworkDto = {
      title: body.title,
      description: body.description,
      type: body.type as ArtworkType,
      ageRating: body.ageRating as AgeRating,
      visibility: body.visibility as Visibility | undefined,
      tags: body.tags ? (Array.isArray(body.tags) ? body.tags : [body.tags]) : [],
      disableRightClick: body.disableRightClick !== 'false' && body.disableRightClick !== false,
      license: body.license,
      customLicenseUrl: body.customLicenseUrl,
      customLicenseText: body.customLicenseText,
      // Creation metadata (portfolio fields)
      creationDate: body.creationDate || undefined,
      creationPeriodValue: body.creationPeriodValue ? parseInt(body.creationPeriodValue, 10) : undefined,
      creationPeriodUnit: body.creationPeriodUnit as CreationPeriodUnit | undefined,
      isCommission: body.isCommission === 'true' || body.isCommission === true,
      clientName: body.clientName || undefined,
      projectName: body.projectName || undefined,
      medium: body.medium as ArtworkMedium | undefined,
      externalUrl: body.externalUrl || undefined,
      toolsUsed,
      // OG card crop coordinates
      ogCardCrop,
      ogCardBlur,
    }

    // Validate required fields
    if (!createDto.title) {
      throw new BadRequestException('Title is required')
    }
    if (!createDto.type) {
      throw new BadRequestException('Type is required')
    }
    if (!createDto.ageRating) {
      throw new BadRequestException('Age rating is required')
    }

    return this.artworksService.createArtwork(user.id, createDto, files)
  }

  /**
   * Get artworks from following users
   * GET /api/artworks/following
   */
  @UseGuards(JwtAuthGuard)
  @Get('following')
  async getFollowingArtworks(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Get user's content filters
    const contentFilters = await this.usersService.getContentFilters(user.id)

    return this.artworksService.getFollowingArtworks(
      user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      contentFilters,
    )
  }

  /**
   * Get artworks list with filters
   * GET /api/artworks
   */
  @Public()
  @Get()
  async getArtworks(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('type') type?: ArtworkType,
    @Query('ageRating') ageRating?: AgeRating,
    @Query('tags') tags?: string | string[],
    @Query('sort') sort?: 'latest' | 'popular' | 'views' | 'creationDateDesc' | 'creationDateAsc',
    @Query('federation') federation?: 'local' | 'remote' | 'all',
  ) {
    const tagsArray = tags
      ? Array.isArray(tags)
        ? tags
        : tags.split(',')
      : undefined

    // Get user's content filters if authenticated
    const contentFilters = user?.id
      ? await this.usersService.getContentFilters(user.id)
      : undefined

    return this.artworksService.getArtworks({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      q,
      type,
      ageRating,
      tags: tagsArray,
      sort: sort || 'latest',
      federation,
      currentUserId: user?.id,
      contentFilters,
    })
  }

  /**
   * Get artwork by ID
   * GET /api/artworks/:id
   */
  @Public()
  @Get(':id')
  @UseGuards(RateLimitGuard)
  @UseInterceptors(RateLimitInterceptor)
  @RateLimit({ action: 'artwork_view' })
  async getArtworkById(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() request: Request,
  ) {
    // Get user's content filters if authenticated
    const contentFilters = user?.id
      ? await this.usersService.getContentFilters(user.id)
      : undefined

    const artwork = await this.artworksService.getArtworkById(id, user?.id, contentFilters)

    // Check if rate limited and degrade quality
    const rateLimitStatus = request.rateLimitStatus
    if (
      rateLimitStatus &&
      (rateLimitStatus.tier === RateLimitTier.SOFT_LIMIT ||
        rateLimitStatus.tier === RateLimitTier.HARD_LIMIT)
    ) {
      // Replace full URLs with thumbnail URLs
      if (artwork.images) {
        artwork.images = artwork.images.map((img: any) => ({
          ...img,
          url: img.thumbnailUrl, // Use thumbnail instead of full image
          originalUrl: img.url, // Keep original for reference
          degraded: true,
        }))
      }
    }

    return artwork
  }

  /**
   * Update artwork with optional image changes
   * PUT /api/artworks/:id
   * Supports both JSON and multipart/form-data
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('newImages', 100))
  async updateArtwork(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    // Parse imageOperations from JSON string if provided
    let imageOperations: ImageOperation[] | undefined
    if (body.imageOperations) {
      try {
        imageOperations =
          typeof body.imageOperations === 'string'
            ? JSON.parse(body.imageOperations)
            : body.imageOperations
      } catch {
        throw new BadRequestException('Invalid imageOperations format')
      }
    }

    // Parse tags
    let tags: string[] | undefined
    if (body.tags) {
      tags = Array.isArray(body.tags) ? body.tags : typeof body.tags === 'string' ? JSON.parse(body.tags) : undefined
    }

    // Parse disableRightClick
    let disableRightClick: boolean | undefined
    if (body.disableRightClick !== undefined) {
      disableRightClick = body.disableRightClick !== 'false' && body.disableRightClick !== false
    }

    // Parse toolsUsed from JSON string if provided
    let toolsUsed: string[] | null | undefined
    if (body.toolsUsed !== undefined) {
      if (body.toolsUsed === '' || body.toolsUsed === null) {
        toolsUsed = null
      } else {
        try {
          toolsUsed = typeof body.toolsUsed === 'string' ? JSON.parse(body.toolsUsed) : body.toolsUsed
        } catch {
          toolsUsed = Array.isArray(body.toolsUsed) ? body.toolsUsed : [body.toolsUsed]
        }
      }
    }

    // Parse OG card crop coordinates
    let ogCardCrop: { x: number; y: number; width: number; height: number } | null | undefined
    if (body.ogCardCropX !== undefined && body.ogCardCropY !== undefined &&
        body.ogCardCropWidth !== undefined && body.ogCardCropHeight !== undefined) {
      ogCardCrop = {
        x: parseInt(body.ogCardCropX, 10),
        y: parseInt(body.ogCardCropY, 10),
        width: parseInt(body.ogCardCropWidth, 10),
        height: parseInt(body.ogCardCropHeight, 10),
      }
    }

    // Parse OG card blur
    const ogCardBlur = body.ogCardBlur !== undefined
      ? (body.ogCardBlur === 'true' || body.ogCardBlur === true)
      : undefined

    const updateDto: UpdateArtworkDto = {
      title: body.title,
      description: body.description,
      type: body.type as ArtworkType | undefined,
      ageRating: body.ageRating as AgeRating | undefined,
      visibility: body.visibility as Visibility | undefined,
      tags,
      imageOperations,
      disableRightClick,
      license: body.license,
      customLicenseUrl: body.customLicenseUrl,
      customLicenseText: body.customLicenseText,
      // Creation metadata (portfolio fields)
      creationDate: body.creationDate !== undefined
        ? (body.creationDate === '' || body.creationDate === null ? null : body.creationDate)
        : undefined,
      creationPeriodValue: body.creationPeriodValue !== undefined
        ? (body.creationPeriodValue === '' || body.creationPeriodValue === null ? null : parseInt(body.creationPeriodValue, 10))
        : undefined,
      creationPeriodUnit: body.creationPeriodUnit !== undefined
        ? (body.creationPeriodUnit === '' || body.creationPeriodUnit === null ? null : body.creationPeriodUnit as CreationPeriodUnit)
        : undefined,
      isCommission: body.isCommission !== undefined
        ? (body.isCommission === 'true' || body.isCommission === true)
        : undefined,
      clientName: body.clientName !== undefined
        ? (body.clientName === '' ? null : body.clientName)
        : undefined,
      projectName: body.projectName !== undefined
        ? (body.projectName === '' ? null : body.projectName)
        : undefined,
      medium: body.medium !== undefined
        ? (body.medium === '' || body.medium === null ? null : body.medium as ArtworkMedium)
        : undefined,
      externalUrl: body.externalUrl !== undefined
        ? (body.externalUrl === '' ? null : body.externalUrl)
        : undefined,
      toolsUsed,
      // OG card crop coordinates and blur
      ogCardCrop,
      ogCardBlur,
    }

    return this.artworksService.updateArtworkWithImages(id, user.id, updateDto, files)
  }

  /**
   * Delete artwork
   * DELETE /api/artworks/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteArtwork(@Param('id') id: string, @CurrentUser() user: any) {
    return this.artworksService.deleteArtwork(id, user.id)
  }

  /**
   * Get artworks by username
   * GET /api/artworks/user/:username
   */
  @Public()
  @Get('user/:username')
  async getArtworksByUsername(
    @Param('username') username: string,
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: 'latest' | 'popular' | 'views' | 'creationDateDesc' | 'creationDateAsc',
  ) {
    // Get user's content filters if authenticated
    const contentFilters = user?.id
      ? await this.usersService.getContentFilters(user.id)
      : undefined

    return this.artworksService.getArtworksByUsername(
      username,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      user?.id,
      contentFilters,
      sort,
    )
  }

  /**
   * POST /api/artworks/:id/refresh
   * Refresh remote artwork data from origin server
   * This fetches the latest data from the remote server for remote artworks
   */
  @Post(':id/refresh')
  @Public()
  async refreshRemoteArtwork(@Param('id') id: string) {
    return this.artworksService.refreshRemoteArtwork(id)
  }

  /**
   * POST /api/artworks/:id/og-card
   * Generate OG card for artwork
   */
  @Post(':id/og-card')
  @UseGuards(JwtAuthGuard)
  async generateOgCard(
    @Param('id') id: string,
    @Body() generateDto: GenerateOgCardDto,
    @CurrentUser() user: any,
  ) {
    return this.artworksService.generateOgCard(id, user.id, generateDto)
  }

  /**
   * DELETE /api/artworks/:id/og-card
   * Delete OG card for artwork
   */
  @Delete(':id/og-card')
  @UseGuards(JwtAuthGuard)
  async deleteOgCard(@Param('id') id: string, @CurrentUser() user: any) {
    await this.artworksService.deleteOgCard(id, user.id)
    return { message: 'OG card deleted successfully' }
  }

  /**
   * POST /api/artworks/:id/link-card
   * Upload Link Card image for artwork (replaces OG card generation)
   */
  @Post(':id/link-card')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadLinkCard(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadLinkCardDto,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No image file provided')
    }
    return this.artworksService.uploadLinkCard(id, user.id, file, uploadDto)
  }
}
