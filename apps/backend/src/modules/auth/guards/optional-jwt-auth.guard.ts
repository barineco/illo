import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Optional JWT Auth Guard
 * Unlike JwtAuthGuard, this guard does NOT throw an error if no token is provided.
 * It will attempt to authenticate if a token is present, but will allow the request
 * to proceed even without authentication. The user will be available in req.user
 * if authenticated, or undefined if not.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Don't throw an error if no user is found
    // Just return the user (which may be undefined/false)
    return user || null
  }
}
