import { Controller, Get, Header } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { ActorService } from '../services/actor.service'
import { Public } from '../../auth/decorators/public.decorator'

/**
 * NodeInfo Controller
 *
 * Implements NodeInfo 2.1 specification for instance discovery
 * https://nodeinfo.diaspora.software/protocol
 */
@Controller()
export class NodeInfoController {
  private readonly instanceName: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly actorService: ActorService,
    private readonly configService: ConfigService,
  ) {
    this.instanceName = this.configService.get<string>('INSTANCE_NAME', 'illo')
  }

  /**
   * GET /.well-known/nodeinfo
   * Returns links to NodeInfo endpoints
   */
  @Public()
  @Get('.well-known/nodeinfo')
  @Header('Content-Type', 'application/json')
  async getNodeInfoLinks() {
    const publicUrl = await this.actorService.getPublicUrl()

    return {
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.1',
          href: `${publicUrl}/nodeinfo/2.1`,
        },
      ],
    }
  }

  /**
   * GET /nodeinfo/2.1
   * Returns instance information following NodeInfo 2.1 schema
   */
  @Public()
  @Get('nodeinfo/2.1')
  @Header('Content-Type', 'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.1#"')
  async getNodeInfo() {
    const settings = await this.prisma.instanceSettings.findFirst()

    // Count local users (domain is empty string for local users)
    const userCount = await this.prisma.user.count({
      where: {
        domain: '',
        isActive: true,
      },
    })

    // Count public artworks
    const artworkCount = await this.prisma.artwork.count({
      where: {
        visibility: 'PUBLIC',
      },
    })

    return {
      version: '2.1',
      software: {
        name: 'open-illustboard',
        version: '0.1.0',
        repository: 'https://github.com/open-illustboard/open-illustboard',
      },
      protocols: ['activitypub'],
      services: {
        inbound: [],
        outbound: [],
      },
      openRegistrations: settings?.allowRegistration ?? false,
      usage: {
        users: {
          total: userCount,
          activeMonth: userCount,
          activeHalfyear: userCount,
        },
        localPosts: artworkCount,
      },
      metadata: {
        nodeName: settings?.instanceName ?? this.instanceName,
        nodeDescription: settings?.description ?? '',
        instanceMode: settings?.instanceMode ?? 'FEDERATION_ONLY',
        features: [
          'artwork_upload',
          'federation',
          'webfinger',
          'http_signatures',
          'dm_encryption',      // AES-256-GCM DB-level encryption
          'mls_over_activitypub', // MLS over ActivityPub (RFC 9420)
        ],
      },
    }
  }
}
