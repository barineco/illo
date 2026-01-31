import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { SetupService } from '../setup.service'

/**
 * Middleware to redirect browser requests to setup page if setup is incomplete
 * API requests (federation, REST API) are allowed to pass through
 */
@Injectable()
export class SetupRedirectMiddleware implements NestMiddleware {
  constructor(private setupService: SetupService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Allow setup-related endpoints to pass through
    if (req.path.startsWith('/api/setup') || req.path.startsWith('/setup')) {
      return next()
    }

    // Check if this is a browser request (not API request)
    const acceptHeader = req.headers.accept || ''
    const isBrowserRequest = acceptHeader.includes('text/html')

    // If not a browser request, allow it (federation endpoints, API calls)
    if (!isBrowserRequest) {
      return next()
    }

    // For browser requests, check if setup is complete
    const isSetupComplete = await this.setupService.isSetupComplete()

    if (!isSetupComplete) {
      // Redirect browser to setup page
      return res.redirect('/setup')
    }

    next()
  }
}
