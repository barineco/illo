import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import {
  NodeOAuthClient,
  NodeOAuthClientOptions,
  NodeSavedSession,
  NodeSavedState,
} from '@atproto/oauth-client-node'
import { JoseKey } from '@atproto/jwk-jose'

/**
 * OAuth metadata for tracking mode and linkToUserId
 */
interface OAuthMetadata {
  mode: 'login' | 'register' | 'link'
  linkToUserId?: string
}

/**
 * In-memory state store for OAuth flow with metadata support
 * Wraps ATProto's state store and adds our custom metadata
 */
class StateStoreWithMetadata {
  private store = new Map<string, NodeSavedState>()
  private metadata = new Map<string, OAuthMetadata>()
  private pendingMetadata: OAuthMetadata | null = null

  setPendingMetadata(metadata: OAuthMetadata): void {
    this.pendingMetadata = metadata
  }

  async get(key: string): Promise<NodeSavedState | undefined> {
    return this.store.get(key)
  }

  async set(key: string, value: NodeSavedState): Promise<void> {
    this.store.set(key, value)
    if (this.pendingMetadata) {
      this.metadata.set(key, this.pendingMetadata)
      this.pendingMetadata = null
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
    this.metadata.delete(key)
  }

  getMetadata(key: string): OAuthMetadata | undefined {
    return this.metadata.get(key)
  }

  delMetadata(key: string): void {
    this.metadata.delete(key)
  }
}

class SessionStore {
  private store = new Map<string, NodeSavedSession>()

  async get(sub: string): Promise<NodeSavedSession | undefined> {
    return this.store.get(sub)
  }

  async set(sub: string, session: NodeSavedSession): Promise<void> {
    this.store.set(sub, session)
  }

  async del(sub: string): Promise<void> {
    this.store.delete(sub)
  }
}

export interface BlueskyAuthResult {
  did: string
  handle: string
  linkToUserId?: string
  mode?: string
}

@Injectable()
export class BlueskyOAuthService implements OnModuleInit {
  private readonly logger = new Logger(BlueskyOAuthService.name)
  private oauthClient: NodeOAuthClient | null = null
  private stateStore: StateStoreWithMetadata
  private sessionStore: SessionStore
  private isConfigured = false
  private readonly instanceName: string

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.stateStore = new StateStoreWithMetadata()
    this.sessionStore = new SessionStore()
    this.instanceName = this.configService.get<string>('INSTANCE_NAME', 'illo')
  }

  async onModuleInit() {
    await this.initializeOAuthClient()
  }

  /**
   * Initialize the OAuth client with configuration
   */
  private async initializeOAuthClient() {
    const baseUrl = this.configService.get<string>('BASE_URL')
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || baseUrl

    if (!baseUrl) {
      this.logger.warn(
        'BASE_URL not configured, Bluesky OAuth will not be available',
      )
      return
    }

    try {
      // Load private JWK from environment variable
      const privateJwkString = this.configService.get<string>('BLUESKY_OAUTH_PRIVATE_JWK')

      if (!privateJwkString) {
        this.logger.warn(
          'BLUESKY_OAUTH_PRIVATE_JWK not configured, Bluesky OAuth will not be available',
        )
        this.logger.warn(
          'Run ./install.sh install to generate the required JWKS key pair',
        )
        return
      }

      let privateJwk: any
      try {
        privateJwk = JSON.parse(privateJwkString)
      } catch (parseError) {
        try {
          const decoded = Buffer.from(privateJwkString, 'base64').toString('utf-8')
          privateJwk = JSON.parse(decoded)
          this.logger.log('Successfully decoded Base64-encoded BLUESKY_OAUTH_PRIVATE_JWK')
        } catch (base64Error) {
          this.logger.error('Failed to parse BLUESKY_OAUTH_PRIVATE_JWK: invalid JSON or Base64 format')
          this.logger.error('Please check the BLUESKY_OAUTH_PRIVATE_JWK environment variable')
          return
        }
      }

      // Validate required JWK fields
      if (!privateJwk.kty || !privateJwk.kid || !privateJwk.d) {
        this.logger.error('Invalid BLUESKY_OAUTH_PRIVATE_JWK: missing required fields (kty, kid, d)')
        return
      }

      // Extract public JWK from private JWK (remove private key material)
      const { d, ...publicJwk } = privateJwk

      const clientMetadata = {
        client_id: `${baseUrl}/api/bluesky/client-metadata.json`,
        client_name: this.instanceName,
        client_uri: frontendUrl,
        redirect_uris: [`${baseUrl}/api/bluesky/callback`] as [string, ...string[]],
        grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
        response_types: ['code'] as ['code'],
        scope: 'atproto', // Minimal scope: authentication and DID/handle only
        token_endpoint_auth_method: 'private_key_jwt' as const,
        token_endpoint_auth_signing_alg: 'ES256' as const,
        dpop_bound_access_tokens: true,
        application_type: 'web' as const,
        jwks: {
          keys: [publicJwk],
        },
      }

      // Create JoseKey instance from the private JWK
      const keyWithKid = await JoseKey.fromImportable(privateJwk, privateJwk.kid)

      const options: NodeOAuthClientOptions = {
        clientMetadata,
        stateStore: this.stateStore,
        sessionStore: this.sessionStore,
        keyset: [keyWithKid],
      } as NodeOAuthClientOptions

      this.oauthClient = new NodeOAuthClient(options)
      this.isConfigured = true
      this.logger.log('Bluesky OAuth client initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize Bluesky OAuth client:', error)
    }
  }

  /**
   * Check if Bluesky OAuth is configured and available
   */
  isEnabled(): boolean {
    return this.isConfigured && this.oauthClient !== null
  }

  /**
   * Get the OAuth client metadata for public endpoint
   */
  getClientMetadata() {
    if (!this.oauthClient) {
      return null
    }

    const baseUrl = this.configService.get<string>('BASE_URL')
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || baseUrl

    // Load and parse the public JWK from private JWK
    const privateJwkString = this.configService.get<string>('BLUESKY_OAUTH_PRIVATE_JWK')
    let publicJwk = null

    if (privateJwkString) {
      try {
        let privateJwk: any
        try {
          privateJwk = JSON.parse(privateJwkString)
        } catch {
          const decoded = Buffer.from(privateJwkString, 'base64').toString('utf-8')
          privateJwk = JSON.parse(decoded)
        }
        const { d, ...pub } = privateJwk
        publicJwk = pub
      } catch (error) {
        this.logger.error('Failed to parse public JWK for client metadata:', error)
      }
    }

    return {
      client_id: `${baseUrl}/api/bluesky/client-metadata.json`,
      client_name: this.instanceName,
      client_uri: frontendUrl,
      redirect_uris: [`${baseUrl}/api/bluesky/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'atproto', // Minimal scope: authentication and DID/handle only
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'ES256',
      dpop_bound_access_tokens: true,
      application_type: 'web',
      ...(publicJwk && {
        jwks: {
          keys: [publicJwk],
        },
      }),
    }
  }

  /**
   * Start the OAuth authorization flow
   * @param handle Bluesky handle (e.g., "user.bsky.social")
   * @param mode OAuth mode: 'login', 'register', or 'link'
   * @param linkToUserId Optional user ID to link to (for account linking)
   * @returns Authorization URL to redirect the user to
   */
  async authorize(
    handle: string,
    mode: 'login' | 'register' | 'link' = 'login',
    linkToUserId?: string,
  ): Promise<{ url: string; state: string }> {
    if (!this.oauthClient) {
      throw new Error('Bluesky OAuth is not configured')
    }

    try {
      this.stateStore.setPendingMetadata({ mode, linkToUserId })
      this.logger.log(`Set pending OAuth metadata: mode=${mode}, linkToUserId=${linkToUserId}`)

      const url = await this.oauthClient.authorize(handle, {
        scope: 'atproto', // Minimal scope: authentication and DID/handle only
      })

      this.logger.log(`Authorization URL generated: ${url.toString().substring(0, 150)}...`)

      return { url: url.toString(), state: '' }
    } catch (error) {
      this.logger.error('Failed to start OAuth authorization:', error)
      throw error
    }
  }

  /**
   * Handle the OAuth callback
   * @param params URL search params from the callback
   * @returns The authenticated user's DID, handle, and optional mode/linkToUserId from state
   */
  async callback(callbackUrl: URL): Promise<BlueskyAuthResult> {
    if (!this.oauthClient) {
      throw new Error('Bluesky OAuth is not configured')
    }

    try {
      // Extract state from URL - this is the key for our metadata
      const stateParam = callbackUrl.searchParams.get('state')
      let mode: string | undefined
      let linkToUserId: string | undefined

      this.logger.log(`Callback URL: ${callbackUrl.toString().substring(0, 150)}...`)
      this.logger.log(`State param from callback: "${stateParam}" (length: ${stateParam?.length || 0})`)

      if (stateParam) {
        // Retrieve our metadata using the state key
        const metadata = this.stateStore.getMetadata(stateParam)
        this.logger.log(`Metadata lookup result: ${metadata ? JSON.stringify(metadata) : 'null'}`)
        if (metadata) {
          mode = metadata.mode
          linkToUserId = metadata.linkToUserId
          this.logger.log(`Retrieved OAuth metadata for state="${stateParam}": mode=${mode}, linkToUserId=${linkToUserId}`)
          // Clean up after use
          this.stateStore.delMetadata(stateParam)
        } else {
          this.logger.warn(`No metadata found for state="${stateParam}"`)
        }
      } else {
        this.logger.warn('No state parameter in callback URL!')
      }

      const { session } = await this.oauthClient.callback(
        callbackUrl.searchParams,
      )

      // Get user profile info
      const did = session.did
      const handle = await this.resolveHandleFromDid(did)

      return { did, handle, mode, linkToUserId }
    } catch (error) {
      this.logger.error('OAuth callback failed:', error)
      throw error
    }
  }

  /**
   * Resolve a handle from a DID
   * @param did The DID to resolve
   * @returns The handle associated with the DID
   */
  private async resolveHandleFromDid(did: string): Promise<string> {
    try {
      // Use atproto API to get the profile
      const { Agent } = await import('@atproto/api')
      const agent = new Agent('https://public.api.bsky.app')
      const profile = await agent.getProfile({ actor: did })
      return profile.data.handle
    } catch (error) {
      this.logger.warn(`Failed to resolve handle for DID ${did}:`, error)
      // Return DID as fallback
      return did
    }
  }

  /**
   * Link a Bluesky account to an existing user
   */
  async linkBlueskyAccount(
    userId: string,
    did: string,
    handle: string,
  ): Promise<void> {
    // Check if DID is already linked to another user
    const existingUser = await this.prisma.user.findUnique({
      where: { blueskyDid: did },
    })

    if (existingUser && existingUser.id !== userId) {
      throw new Error(
        'This Bluesky account is already linked to another user',
      )
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        blueskyDid: did,
        blueskyHandle: handle,
        blueskyVerified: true,
        blueskyLinkedAt: new Date(),
      },
    })

    this.logger.log(`Linked Bluesky account ${handle} to user ${userId}`)
  }

  /**
   * Unlink a Bluesky account from a user
   */
  async unlinkBlueskyAccount(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        blueskyDid: null,
        blueskyHandle: null,
        blueskyVerified: false,
        blueskyLinkedAt: null,
      },
    })

    this.logger.log(`Unlinked Bluesky account from user ${userId}`)
  }

  /**
   * Find a user by their Bluesky DID
   */
  async findUserByBlueskyDid(did: string) {
    return this.prisma.user.findUnique({
      where: { blueskyDid: did },
    })
  }

  /**
   * Find a user by their Bluesky handle
   */
  async findUserByBlueskyHandle(handle: string) {
    return this.prisma.user.findFirst({
      where: { blueskyHandle: handle },
    })
  }

  /**
   * Generate a registration token for username selection flow
   * @param did Bluesky DID
   * @param handle Bluesky handle
   * @returns JWT token containing DID and handle
   */
  generateRegistrationToken(did: string, handle: string): string {
    return this.jwtService.sign(
      { did, handle, type: 'bluesky_registration' },
      { expiresIn: '10m' },
    )
  }

  /**
   * Validate a registration token and extract DID and handle
   * @param token JWT token
   * @returns DID and handle from the token
   */
  validateRegistrationToken(token: string): { did: string; handle: string } {
    try {
      const payload = this.jwtService.verify(token)
      if (payload.type !== 'bluesky_registration') {
        throw new UnauthorizedException('Invalid token type')
      }
      return { did: payload.did, handle: payload.handle }
    } catch (error) {
      this.logger.error('Failed to validate registration token:', error)
      throw new UnauthorizedException('Invalid or expired registration token')
    }
  }
}
