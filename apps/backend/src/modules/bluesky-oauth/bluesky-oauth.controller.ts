import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common'
import { Response, Request } from 'express'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { BlueskyOAuthService } from './bluesky-oauth.service'
import { AuthService } from '../auth/auth.service'
import { ConfigService } from '@nestjs/config'

interface AuthorizeDto {
  handle: string
  mode?: 'login' | 'register' | 'link'
}

interface CompleteRegistrationDto {
  token: string
  username: string
  tosAccepted?: boolean
}

@Controller('bluesky')
export class BlueskyOAuthController {
  private readonly logger = new Logger(BlueskyOAuthController.name)

  constructor(
    private blueskyOAuthService: BlueskyOAuthService,
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  /**
   * OAuth client metadata endpoint (required by AT Protocol OAuth)
   * This must be publicly accessible at /api/bluesky/client-metadata.json
   */
  @Public()
  @Get('client-metadata.json')
  getClientMetadata(@Res() res: Response) {
    const metadata = this.blueskyOAuthService.getClientMetadata()

    if (!metadata) {
      throw new HttpException(
        'Bluesky OAuth is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    // Allow any origin to access client metadata (required by Bluesky OAuth spec)
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.json(metadata)
  }

  /**
   * Check if Bluesky OAuth is enabled
   */
  @Public()
  @Get('status')
  getStatus() {
    return {
      enabled: this.blueskyOAuthService.isEnabled(),
    }
  }

  /**
   * Start the OAuth authorization flow
   */
  @Public()
  @Post('authorize')
  async authorize(
    @Body() body: AuthorizeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.blueskyOAuthService.isEnabled()) {
      throw new HttpException(
        'Bluesky OAuth is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    const { handle, mode = 'login' } = body

    this.logger.log(`Authorize request: handle=${handle}, mode=${mode}`)

    if (!handle) {
      throw new HttpException(
        'Bluesky handle is required',
        HttpStatus.BAD_REQUEST,
      )
    }

    try {
      // Get current user ID if linking
      let linkToUserId: string | undefined

      // Check for existing JWT token in authorization header for link mode
      const authHeader = req.headers.authorization
      this.logger.log(`Authorization header present: ${!!authHeader}, mode=${mode}`)
      if (mode === 'link' && authHeader?.startsWith('Bearer ')) {
        try {
          const user = await this.authService.validateToken(
            authHeader.slice(7),
          )
          linkToUserId = user?.id
          this.logger.log(`Link mode: validated user ID=${linkToUserId}`)
        } catch (e) {
          // Token validation failed, continue without linking
          this.logger.warn(`Link mode: token validation failed: ${e}`)
        }
      }

      // Pass mode and linkToUserId to authorize - they will be stored in OAuth state
      const { url, state } = await this.blueskyOAuthService.authorize(
        handle,
        mode,
        linkToUserId,
      )

      if (mode === 'link' && !linkToUserId) {
        this.logger.warn(`Link mode but no linkToUserId - authorization header missing or invalid`)
      }

      return res.json({ url, state })
    } catch (error) {
      this.logger.error('Authorization failed:', error)
      throw new HttpException(
        error instanceof Error ? error.message : 'Authorization failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * OAuth callback endpoint
   */
  @Public()
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || ''

    if (!this.blueskyOAuthService.isEnabled()) {
      return res.redirect(`${frontendUrl}/login?error=bluesky_not_configured`)
    }

    try {
      // Reconstruct the callback URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol
      const host = req.headers['x-forwarded-host'] || req.get('host')
      const callbackUrl = new URL(`${protocol}://${host}${req.url}`)

      // Process the OAuth callback - mode and linkToUserId come from state parameter
      const { did, handle, mode, linkToUserId } = await this.blueskyOAuthService.callback(callbackUrl)

      this.logger.log(`Callback: mode=${mode}, linkToUserId=${linkToUserId}, did=${did}, handle=${handle}`)

      // Handle based on mode (from state parameter)
      if (mode === 'link' && linkToUserId) {
        // Link Bluesky account to existing user
        await this.blueskyOAuthService.linkBlueskyAccount(
          linkToUserId,
          did,
          handle,
        )
        return res.redirect(`${frontendUrl}/settings?tab=bluesky&linked=true`)
      }

      // Check if user with this DID already exists
      const user = await this.blueskyOAuthService.findUserByBlueskyDid(did)

      if (user) {
        // Existing user - login
        if (!user.isActive) {
          // User account is not active (pending approval or suspended)
          return res.redirect(
            `${frontendUrl}/auth/pending-approval?via=bluesky`,
          )
        }
        const tokens = await this.authService.loginUser(user, undefined, undefined, true)
        return this.redirectWithTokens(res, frontendUrl, tokens, 'login')
      }

      // New user - redirect to username selection page
      // Generate a registration token that contains the DID and handle
      this.logger.log(`New user from Bluesky OAuth: ${handle}, redirecting to username selection`)
      const registrationToken =
        this.blueskyOAuthService.generateRegistrationToken(did, handle)

      // Redirect to username selection page
      const completeUrl = new URL(`${frontendUrl}/auth/bluesky-complete`)
      completeUrl.searchParams.set('token', registrationToken)
      return res.redirect(completeUrl.toString())
    } catch (error) {
      this.logger.error('OAuth callback failed:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Authentication failed'
      return res.redirect(
        `${frontendUrl}/login?error=bluesky_auth_failed&message=${encodeURIComponent(errorMessage)}`,
      )
    }
  }

  /**
   * Unlink Bluesky account (requires authentication)
   */
  @UseGuards(JwtAuthGuard)
  @Delete('link')
  async unlinkAccount(@CurrentUser() currentUser: { id: string }) {
    await this.blueskyOAuthService.unlinkBlueskyAccount(currentUser.id)
    return { success: true }
  }

  /**
   * Get current user's Bluesky link status
   * Note: This endpoint is a placeholder - link status should be fetched from user profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('link')
  async getLinkStatus(@CurrentUser() _currentUser: { id: string }) {
    return {
      linked: false,
    }
  }

  /**
   * Complete Bluesky OAuth registration with username selection
   */
  @Public()
  @Post('complete-registration')
  async completeRegistration(
    @Body() body: CompleteRegistrationDto,
    @Res() res: Response,
  ) {
    // Validate registration token
    const { did, handle } =
      this.blueskyOAuthService.validateRegistrationToken(body.token)

    // Validate username
    const username = body.username.trim().toLowerCase()
    if (!this.isValidUsername(username)) {
      throw new BadRequestException(
        'Invalid username. Use 3-30 characters, letters, numbers, and underscores only.',
      )
    }

    // Check if username is already taken
    const existingUser = await this.authService.findByUsername(username)
    if (existingUser) {
      throw new BadRequestException('Username is already taken')
    }

    // Check if DID is already linked to another user
    const existingBlueskyUser =
      await this.blueskyOAuthService.findUserByBlueskyDid(did)
    if (existingBlueskyUser) {
      throw new BadRequestException(
        'This Bluesky account is already linked to another user',
      )
    }

    // Create user with Bluesky account linked
    this.logger.log(
      `Creating user from Bluesky OAuth: username=${username}, handle=${handle}`,
    )
    const user = await this.authService.createUserWithBluesky({
      username,
      displayName: handle,
      blueskyDid: did,
      blueskyHandle: handle,
      tosAccepted: body.tosAccepted,
    })

    // Check if user needs approval
    if (!user.isActive) {
      return res.json({
        pendingApproval: true,
        message:
          'Your account has been created and is pending approval by an administrator.',
      })
    }

    // User is active, generate tokens
    const tokens = await this.authService.loginUser(user, undefined, undefined, true)
    return res.json({
      pendingApproval: false,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  }

  /**
   * Validate username format
   */
  private isValidUsername(username: string): boolean {
    // 3-30 characters, lowercase letters, numbers, and underscores
    // Must start with a letter
    const usernameRegex = /^[a-z][a-z0-9_]{2,29}$/
    return usernameRegex.test(username)
  }

  /**
   * Redirect with authentication tokens
   */
  private redirectWithTokens(
    res: Response,
    frontendUrl: string,
    tokens: { accessToken: string; refreshToken: string },
    action: 'login' | 'register',
  ) {
    // Set refresh token as HTTP-only cookie
    const instanceId = this.configService.get<string>('INSTANCE_ID') || 'default'
    res.cookie(`refresh_token_${instanceId}`, tokens.refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    })

    // Redirect with access token in URL (will be stored in localStorage by frontend)
    const redirectUrl = new URL(`${frontendUrl}/auth/bluesky-callback`)
    redirectUrl.searchParams.set('access_token', tokens.accessToken)
    redirectUrl.searchParams.set('action', action)

    return res.redirect(redirectUrl.toString())
  }
}
