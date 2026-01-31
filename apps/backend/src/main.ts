import { NestFactory } from '@nestjs/core'
import { ValidationPipe, RequestMethod, RawBodyRequest } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import type { Request, Response, NextFunction } from 'express'
import * as cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

/**
 * Custom BigInt serialization for JSON
 * Converts BigInt values to strings to avoid serialization errors
 */
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

/**
 * Custom middleware to parse ActivityPub content types as JSON
 */
function activityPubBodyParser(req: RawBodyRequest<Request>, res: Response, next: NextFunction) {
  const contentType = req.headers['content-type'] || ''
  if (
    contentType.includes('application/activity+json') ||
    contentType.includes('application/ld+json')
  ) {
    // Force content-type to application/json so NestJS parses it
    req.headers['content-type'] = 'application/json'
  }
  next()
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // Add middleware to handle ActivityPub content types before body parser runs
  app.use(activityPubBodyParser)

  // Enable cookie parsing for OAuth flows
  app.use(cookieParser())

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Set global prefix (exclude ONLY federation endpoints that need specific paths)
  // Note: ActivityPubController routes are excluded from /api prefix
  // UsersController routes will have /api prefix
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '.well-known/webfinger', method: RequestMethod.GET },
      // Exclude ALL ActivityPubController routes
      { path: 'users/:username', method: RequestMethod.GET },
      { path: 'users/:username/inbox', method: RequestMethod.GET },
      { path: 'users/:username/inbox', method: RequestMethod.POST },
      { path: 'users/:username/outbox', method: RequestMethod.GET },
    ],
  })

  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`🚀 Backend server running on http://localhost:${port}`)
}

bootstrap()
