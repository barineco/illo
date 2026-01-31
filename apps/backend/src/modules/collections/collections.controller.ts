import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common'
import { CollectionsService } from './collections.service'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { UpdateCollectionDto } from './dto/update-collection.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * Create a new collection
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async createCollection(
    @CurrentUser() user: any,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collectionsService.createCollection(user.id, dto)
  }

  /**
   * Get current user's collections (for adding artworks)
   */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyCollections(@CurrentUser() user: any) {
    return this.collectionsService.getMyCollections(user.id)
  }

  /**
   * Get collections for a user
   */
  @Public()
  @Get('user/:username')
  async getUserCollections(
    @Param('username') usernameWithDomain: string,
    @CurrentUser() currentUser: any,
  ) {
    // Parse username and domain
    let username: string
    let domain = ''

    if (usernameWithDomain.includes('@')) {
      const parts = usernameWithDomain.split('@')
      username = parts[0]
      domain = parts[1] || ''
    } else {
      username = usernameWithDomain
    }

    return this.collectionsService.getUserCollections(username, domain, currentUser?.id)
  }

  /**
   * Get collection by ID
   */
  @Public()
  @Get(':id')
  async getCollectionById(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    return this.collectionsService.getCollectionById(id, currentUser?.id)
  }

  /**
   * Update collection
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateCollection(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.updateCollection(id, user.id, dto)
  }

  /**
   * Delete collection
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteCollection(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.collectionsService.deleteCollection(id, user.id)
  }

  /**
   * Add artwork to collection
   */
  @Post(':id/artworks')
  @UseGuards(JwtAuthGuard)
  async addArtworkToCollection(
    @Param('id') id: string,
    @Body('artworkId') artworkId: string,
    @CurrentUser() user: any,
  ) {
    return this.collectionsService.addArtworkToCollection(id, artworkId, user.id)
  }

  /**
   * Remove artwork from collection
   */
  @Delete(':id/artworks/:artworkId')
  @UseGuards(JwtAuthGuard)
  async removeArtworkFromCollection(
    @Param('id') id: string,
    @Param('artworkId') artworkId: string,
    @CurrentUser() user: any,
  ) {
    return this.collectionsService.removeArtworkFromCollection(id, artworkId, user.id)
  }

  /**
   * Reorder artworks in collection
   */
  @Put(':id/artworks/order')
  @UseGuards(JwtAuthGuard)
  async reorderCollectionArtworks(
    @Param('id') id: string,
    @Body('artworkIds') artworkIds: string[],
    @CurrentUser() user: any,
  ) {
    return this.collectionsService.reorderCollectionArtworks(id, artworkIds, user.id)
  }
}
