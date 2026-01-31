import { Controller, Get, Query, NotFoundException } from '@nestjs/common'
import { Public } from '../../auth/decorators/public.decorator'
import { WebFingerService } from '../services/webfinger.service'

/**
 * WebFinger Controller
 * Handles /.well-known/webfinger endpoint
 */
@Controller('.well-known')
export class WebFingerController {
  constructor(private readonly webFingerService: WebFingerService) {}

  /**
   * WebFinger endpoint
   * GET /.well-known/webfinger?resource=acct:username@domain
   */
  @Public()
  @Get('webfinger')
  async webfinger(@Query('resource') resource: string) {
    if (!resource) {
      throw new NotFoundException('Resource parameter required')
    }

    // Parse acct: URI
    const parsed = this.webFingerService.parseAcctUri(resource)

    // Check if this is a request for a local user
    if (parsed.domain) {
      const localDomain = await this.webFingerService.getLocalDomain()

      // If domain doesn't match our local domain, it's a remote user
      if (parsed.domain !== localDomain) {
        throw new NotFoundException('Remote users not available via WebFinger on this instance')
      }
    }

    // Return WebFinger response for local user
    return this.webFingerService.createLocalWebFingerResponse(parsed.username)
  }
}
