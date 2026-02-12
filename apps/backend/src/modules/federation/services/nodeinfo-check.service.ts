import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * NodeInfo Check Service
 *
 * Fetches and caches NodeInfo from remote instances to determine
 * software compatibility for features like E2E encrypted DMs.
 *
 * Uses the FederatedInstance table as a cache to avoid repeated
 * NodeInfo fetches for the same domain.
 */
@Injectable()
export class NodeInfoCheckService {
  private readonly logger = new Logger(NodeInfoCheckService.name)
  private readonly isDevelopment: boolean

  // In-memory cache with TTL (15 minutes)
  private readonly cache = new Map<string, { isOpenIllustboard: boolean; fetchedAt: number }>()
  private readonly CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production'
  }

  /**
   * Check if a domain is running illo software
   *
   * @param domain - The domain to check (e.g., "example.com")
   * @returns true if the instance is running illo
   */
  async isOpenIllustboard(domain: string): Promise<boolean> {
    this.logger.debug(`Checking if ${domain} is illo`)

    // Check in-memory cache first
    const cached = this.cache.get(domain)
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL_MS) {
      this.logger.debug(`Cache hit for ${domain}: isOpenIllustboard=${cached.isOpenIllustboard}`)
      return cached.isOpenIllustboard
    }

    // Check database cache (FederatedInstance table)
    const instance = await this.prisma.federatedInstance.findUnique({
      where: { domain },
    })

    if (instance) {
      const isOIB = instance.softwareName === 'illo' || instance.softwareName === 'open-illustboard'
      this.logger.debug(`DB cache for ${domain}: softwareName=${instance.softwareName}, isOpenIllustboard=${isOIB}`)

      // Update in-memory cache
      this.cache.set(domain, { isOpenIllustboard: isOIB, fetchedAt: Date.now() })

      // If lastSeen is recent (within 1 day), trust the cached value
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (instance.lastSeen > oneDayAgo) {
        this.logger.debug(`Using cached value for ${domain} (lastSeen: ${instance.lastSeen})`)
        return isOIB
      }
    }

    // Fetch fresh NodeInfo
    return this.fetchAndCacheNodeInfo(domain)
  }

  /**
   * Create fetch options with TLS handling for development
   */
  private getFetchOptions(): RequestInit {
    const options: RequestInit = {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    }

    // In development, skip TLS verification for self-signed certs
    if (this.isDevelopment) {
      // Node.js 18+ supports dispatcher option for undici
      // @ts-ignore - dispatcher is available in Node.js 18+
      options.dispatcher = new (require('undici').Agent)({
        connect: {
          rejectUnauthorized: false,
        },
      })
    }

    return options
  }

  /**
   * Fetch NodeInfo from a remote instance and cache the result
   */
  private async fetchAndCacheNodeInfo(domain: string): Promise<boolean> {
    try {
      const fetchOptions = this.getFetchOptions()

      // Step 1: Fetch .well-known/nodeinfo to get the actual nodeinfo URL
      const wellKnownUrl = `https://${domain}/.well-known/nodeinfo`
      this.logger.debug(`Fetching NodeInfo from ${wellKnownUrl}`)
      const wellKnownResponse = await fetch(wellKnownUrl, fetchOptions)

      if (!wellKnownResponse.ok) {
        this.logger.warn(`Failed to fetch NodeInfo well-known for ${domain}: ${wellKnownResponse.status}`)
        return this.cacheResult(domain, null, null)
      }

      const wellKnown = await wellKnownResponse.json()

      // Find NodeInfo 2.1 or 2.0 link
      const nodeInfoLink = wellKnown.links?.find(
        (link: any) =>
          link.rel === 'http://nodeinfo.diaspora.software/ns/schema/2.1' ||
          link.rel === 'http://nodeinfo.diaspora.software/ns/schema/2.0',
      )

      if (!nodeInfoLink?.href) {
        this.logger.warn(`No NodeInfo link found for ${domain}`)
        return this.cacheResult(domain, null, null)
      }

      // Step 2: Fetch the actual NodeInfo
      this.logger.debug(`Fetching NodeInfo detail from ${nodeInfoLink.href}`)
      const nodeInfoResponse = await fetch(nodeInfoLink.href, fetchOptions)

      if (!nodeInfoResponse.ok) {
        this.logger.warn(`Failed to fetch NodeInfo for ${domain}: ${nodeInfoResponse.status}`)
        return this.cacheResult(domain, null, null)
      }

      const nodeInfo = await nodeInfoResponse.json()
      const softwareName = nodeInfo.software?.name?.toLowerCase() || null
      const softwareVersion = nodeInfo.software?.version || null

      this.logger.log(`NodeInfo for ${domain}: ${softwareName} ${softwareVersion}`)

      return this.cacheResult(domain, softwareName, softwareVersion)
    } catch (error) {
      this.logger.error(`Error fetching NodeInfo for ${domain}: ${error.message}`)
      return this.cacheResult(domain, null, null)
    }
  }

  /**
   * Cache the NodeInfo result in database and memory
   */
  private async cacheResult(
    domain: string,
    softwareName: string | null,
    softwareVersion: string | null,
  ): Promise<boolean> {
    const isOpenIllustboard = softwareName === 'illo' || softwareName === 'open-illustboard'

    // Update in-memory cache
    this.cache.set(domain, { isOpenIllustboard, fetchedAt: Date.now() })

    // Update database cache
    try {
      await this.prisma.federatedInstance.upsert({
        where: { domain },
        update: {
          softwareName,
          softwareVersion,
          lastSeen: new Date(),
        },
        create: {
          domain,
          softwareName,
          softwareVersion,
          isBlocked: false,
          isTrusted: isOpenIllustboard,
        },
      })
    } catch (error) {
      this.logger.error(`Failed to cache NodeInfo for ${domain}: ${error.message}`)
    }

    return isOpenIllustboard
  }

  /**
   * Check if all participants in a list support E2E encryption
   * (i.e., are all running illo)
   *
   * @param domains - List of domains to check
   * @returns Object with encryption support status
   */
  async checkEncryptionSupport(domains: string[]): Promise<{
    allSupported: boolean
    supportedDomains: string[]
    unsupportedDomains: string[]
  }> {
    const supportedDomains: string[] = []
    const unsupportedDomains: string[] = []

    for (const domain of domains) {
      // Skip local users (empty domain)
      if (!domain) {
        supportedDomains.push(domain)
        continue
      }

      const isOIB = await this.isOpenIllustboard(domain)
      if (isOIB) {
        supportedDomains.push(domain)
      } else {
        unsupportedDomains.push(domain)
      }
    }

    return {
      allSupported: unsupportedDomains.length === 0,
      supportedDomains,
      unsupportedDomains,
    }
  }

  /**
   * Clear the in-memory cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear()
  }
}
