import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { OCsService } from './ocs.service'
import { CreateOCDto } from './dto/create-oc.dto'
import { UpdateOCDto } from './dto/update-oc.dto'
import { OCQueryDto } from './dto/oc-query.dto'

@Controller('ocs')
export class OCsController {
  constructor(private readonly ocsService: OCsService) {}

  /**
   * Create a new original character
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateOCDto) {
    return this.ocsService.create(userId, dto)
  }

  /**
   * Get all original characters (with filtering)
   */
  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(
    @Query() query: OCQueryDto,
    @CurrentUser('id') userId?: string
  ) {
    return this.ocsService.findAll(query, userId)
  }

  /**
   * Get fan art welcome characters for home page
   */
  @Get('fan-art-welcome')
  @Public()
  async findFanArtWelcome(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 8
    return this.ocsService.findFanArtWelcome(parsedLimit)
  }

  /**
   * Get a single original character
   */
  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.ocsService.findOne(id, userId)
  }

  /**
   * Update an original character
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOCDto
  ) {
    return this.ocsService.update(id, userId, dto)
  }

  /**
   * Delete an original character
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.ocsService.remove(id, userId)
  }

  /**
   * Set representative artwork for character
   */
  @Put(':id/representative')
  @UseGuards(JwtAuthGuard)
  async setRepresentativeArtwork(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('artworkId') artworkId: string | null
  ) {
    return this.ocsService.setRepresentativeArtwork(id, userId, artworkId)
  }

  /**
   * Add reference artwork
   */
  @Post(':id/references')
  @UseGuards(JwtAuthGuard)
  async addReferenceArtwork(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('artworkId') artworkId: string,
    @Body('caption') caption?: string
  ) {
    return this.ocsService.addReferenceArtwork(id, userId, artworkId, caption)
  }

  /**
   * Remove reference artwork
   */
  @Delete(':id/references/:artworkId')
  @UseGuards(JwtAuthGuard)
  async removeReferenceArtwork(
    @Param('id') id: string,
    @Param('artworkId') artworkId: string,
    @CurrentUser('id') userId: string
  ) {
    return this.ocsService.removeReferenceArtwork(id, artworkId, userId)
  }

  /**
   * Reorder reference artworks
   */
  @Put(':id/references/reorder')
  @UseGuards(JwtAuthGuard)
  async reorderReferenceArtworks(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('artworkIds') artworkIds: string[]
  ) {
    return this.ocsService.reorderReferenceArtworks(id, userId, artworkIds)
  }

  /**
   * Get fan arts for a character
   */
  @Get(':id/fan-arts')
  @Public()
  async getFanArts(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1
    const parsedLimit = limit ? parseInt(limit, 10) : 20
    return this.ocsService.getFanArts(id, parsedPage, parsedLimit)
  }

  /**
   * Get creator's artworks (for empty fan art state)
   */
  @Get(':id/creator-artworks')
  @Public()
  async getCreatorArtworks(
    @Param('id') id: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 4
    return this.ocsService.getCreatorArtworks(id, parsedLimit)
  }
}
