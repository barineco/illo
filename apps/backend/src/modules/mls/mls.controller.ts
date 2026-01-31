import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Header,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { MlsService } from './mls.service'
import { PrismaService } from '../prisma/prisma.service'
import { ActorService } from '../federation/services/actor.service'
import { Public } from '../auth/decorators/public.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

/**
 * MLS Controller
 *
 * Provides endpoints for MLS KeyPackage management.
 * These endpoints are used both locally and for ActivityPub federation.
 *
 * Public endpoints (for ActivityPub):
 * - GET /users/:username/keypackages - List user's KeyPackages
 * - GET /users/:username/keypackages/:id - Get specific KeyPackage
 *
 * Authenticated endpoints:
 * - POST /api/mls/keypackages - Generate new KeyPackage
 * - DELETE /api/mls/keypackages/:id - Delete KeyPackage
 */
@Controller()
export class MlsController {
  constructor(
    private mlsService: MlsService,
    private prisma: PrismaService,
    private actorService: ActorService,
  ) {}

  /**
   * GET /users/:username/keypackages
   *
   * Public endpoint to list a user's KeyPackages.
   * Used by remote instances to fetch KeyPackages for encrypted DM setup.
   */
  @Public()
  @Get('users/:username/keypackages')
  @Header('Content-Type', 'application/activity+json')
  async getKeyPackagesCollection(@Param('username') username: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '',
        isActive: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${username}`

    const keyPackages = await this.mlsService.getKeyPackages(user.id)

    return {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://purl.archive.org/socialweb/mls',
      ],
      type: 'Collection',
      id: `${actorUrl}/keypackages`,
      totalItems: keyPackages.length,
      items: keyPackages.map((kp) => ({
        type: 'KeyPackage',
        id: `${actorUrl}/keypackages/${kp.id}`,
        mediaType: 'application/mls-keypackage',
        content: Buffer.from(kp.keyPackage).toString('base64'),
        published: kp.createdAt.toISOString(),
        expires: kp.expiresAt?.toISOString(),
      })),
    }
  }

  /**
   * GET /users/:username/keypackages/:id
   *
   * Public endpoint to get a specific KeyPackage.
   * Used by remote instances to fetch a single KeyPackage for group creation.
   */
  @Public()
  @Get('users/:username/keypackages/:id')
  @Header('Content-Type', 'application/activity+json')
  async getKeyPackage(@Param('username') username: string, @Param('id') id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '',
        isActive: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const keyPackage = await this.mlsService.getKeyPackage(id)

    if (keyPackage.userId !== user.id) {
      throw new NotFoundException('KeyPackage not found')
    }

    const publicUrl = await this.actorService.getPublicUrl()
    const actorUrl = `${publicUrl}/users/${username}`

    return {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://purl.archive.org/socialweb/mls',
      ],
      type: 'KeyPackage',
      id: `${actorUrl}/keypackages/${keyPackage.id}`,
      mediaType: 'application/mls-keypackage',
      content: Buffer.from(keyPackage.keyPackage).toString('base64'),
      published: keyPackage.createdAt.toISOString(),
      expires: keyPackage.expiresAt?.toISOString(),
    }
  }

  /**
   * POST /api/mls/keypackages
   *
   * Generate a new KeyPackage for the authenticated user.
   */
  @Post('api/mls/keypackages')
  async generateKeyPackage(@CurrentUser() user: { id: string }) {
    const keyPackage = await this.mlsService.generateKeyPackage(user.id)

    return {
      id: keyPackage.id,
      publicKey: keyPackage.publicKey,
      createdAt: keyPackage.createdAt,
      expiresAt: keyPackage.expiresAt,
    }
  }

  /**
   * GET /api/mls/keypackages
   *
   * List the authenticated user's KeyPackages.
   */
  @Get('api/mls/keypackages')
  async listMyKeyPackages(@CurrentUser() user: { id: string }) {
    const keyPackages = await this.mlsService.getKeyPackages(user.id)

    return keyPackages.map((kp) => ({
      id: kp.id,
      publicKey: kp.publicKey,
      createdAt: kp.createdAt,
      expiresAt: kp.expiresAt,
    }))
  }

  /**
   * DELETE /api/mls/keypackages/:id
   *
   * Delete a KeyPackage owned by the authenticated user.
   */
  @Delete('api/mls/keypackages/:id')
  async deleteKeyPackage(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.mlsService.deleteKeyPackage(user.id, id)

    return { success: true }
  }
}
