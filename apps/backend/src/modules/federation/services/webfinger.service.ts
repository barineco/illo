import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import {
  WebFingerResponse,
  WebFingerLink,
  ParsedHandle,
} from '../dto/webfinger.dto'

@Injectable()
export class WebFingerService {
  private readonly logger = new Logger(WebFingerService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Parse handle in format @username@domain or @username
   */
  parseHandle(handle: string): ParsedHandle {
    // Remove leading @ if present
    const normalized = handle.startsWith('@') ? handle.substring(1) : handle

    // Check if it contains @domain part
    const parts = normalized.split('@')

    if (parts.length === 1) {
      // Local user (e.g., @username or username)
      return {
        username: parts[0],
        domain: null,
      }
    } else if (parts.length === 2) {
      // Remote user (e.g., @username@domain or username@domain)
      return {
        username: parts[0],
        domain: parts[1],
      }
    }

    throw new Error(`Invalid handle format: ${handle}`)
  }

  /**
   * Parse acct: URI (e.g., acct:alice@example.com)
   */
  parseAcctUri(resource: string): ParsedHandle {
    if (resource.startsWith('acct:')) {
      const handle = resource.substring(5) // Remove 'acct:' prefix
      return this.parseHandle(handle)
    }

    throw new Error(`Invalid acct URI: ${resource}`)
  }

  /**
   * Get public URL from instance settings or fallback to BASE_URL env var
   */
  async getPublicUrl(): Promise<string> {
    // Try to get from database first
    const settings = await this.prisma.instanceSettings.findFirst()
    if (settings?.publicUrl) {
      return settings.publicUrl
    }

    // Fallback to BASE_URL environment variable
    const baseUrl = this.configService.get<string>('BASE_URL')
    if (!baseUrl) {
      throw new Error('Public URL not configured in database or BASE_URL environment variable')
    }

    return baseUrl
  }

  /**
   * Get local domain from public URL
   */
  async getLocalDomain(): Promise<string> {
    const publicUrl = await this.getPublicUrl()

    try {
      const url = new URL(publicUrl)
      return url.hostname
    } catch (error) {
      this.logger.error(`Failed to parse public URL: ${publicUrl}`, error)
      throw new Error('Invalid public URL configuration')
    }
  }

  /**
   * Create WebFinger response for a local user
   */
  async createLocalWebFingerResponse(
    username: string,
  ): Promise<WebFingerResponse> {
    // Find user by username (local users only, domain = '')
    const user = await this.prisma.user.findFirst({
      where: {
        username,
        domain: '',
      },
    })

    if (!user) {
      throw new NotFoundException(`User not found: ${username}`)
    }

    const publicUrl = await this.getPublicUrl()
    const localDomain = await this.getLocalDomain()
    const actorUrl = `${publicUrl}/users/${username}`

    const links: WebFingerLink[] = [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl,
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: actorUrl,
      },
    ]

    return {
      subject: `acct:${username}@${localDomain}`,
      aliases: [actorUrl],
      links,
    }
  }

  /**
   * Perform WebFinger query to remote instance
   */
  async performWebFingerQuery(handle: string): Promise<WebFingerResponse> {
    const parsed = this.parseHandle(handle)

    if (!parsed.domain) {
      throw new Error('Cannot perform WebFinger query for local user')
    }

    const resource = `acct:${parsed.username}@${parsed.domain}`
    const webfingerUrl = `https://${parsed.domain}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`

    this.logger.debug(`Performing WebFinger query: ${webfingerUrl}`)

    try {
      const response = await fetch(webfingerUrl, {
        headers: {
          Accept: 'application/jrd+json, application/json',
        },
      })

      if (!response.ok) {
        throw new Error(
          `WebFinger query failed: ${response.status} ${response.statusText}`,
        )
      }

      const data = await response.json()
      return data as WebFingerResponse
    } catch (error) {
      this.logger.error(
        `WebFinger query failed for ${handle}`,
        error instanceof Error ? error.stack : error,
      )
      throw error
    }
  }

  /**
   * Extract Actor URL from WebFinger response
   */
  extractActorUrl(webfingerResponse: WebFingerResponse): string | null {
    // Look for 'self' link with type 'application/activity+json'
    const selfLink = webfingerResponse.links.find(
      (link) =>
        link.rel === 'self' && link.type === 'application/activity+json',
    )

    return selfLink?.href || null
  }
}
