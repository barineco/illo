import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      // For public routes, still try to authenticate if token is present
      // but don't fail if token is missing or invalid
      return Promise.resolve(super.canActivate(context))
        .then(() => true)
        .catch(() => true) // Ignore authentication errors, user will be undefined
    }

    return super.canActivate(context) as Promise<boolean>
  }
}
