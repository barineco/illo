import { Controller, Get, Post, Delete, Query, Req, UseGuards, HttpCode } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PatreonService } from './patreon.service'

@Controller('patreon')
export class PatreonController {
  constructor(private patreonService: PatreonService) {}

  /**
   * Get Patreon OAuth authorization URL
   */
  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  getAuthUrl() {
    const url = this.patreonService.getAuthorizationUrl()
    return { url }
  }

  /**
   * OAuth callback - link Patreon account
   */
  @Post('callback')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async handleCallback(@Req() req, @Query('code') code: string) {
    await this.patreonService.linkPatreonAccount(req.user.id, code)
    return { message: 'Patreon account linked successfully' }
  }

  /**
   * Unlink Patreon account
   */
  @Delete('unlink')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async unlinkAccount(@Req() req) {
    await this.patreonService.unlinkPatreonAccount(req.user.id)
    return { message: 'Patreon account unlinked' }
  }

  /**
   * Manually sync supporter tier
   */
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async syncTier(@Req() req) {
    const tier = await this.patreonService.syncUserTier(req.user.id)
    return { tier, message: 'Tier synced successfully' }
  }
}
