import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common'
import { Request } from 'express'
import { SessionService } from './session.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private sessionService: SessionService) {}

  /**
   * Get all active sessions for current user
   * GET /api/sessions
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getSessions(@CurrentUser() user: any, @Req() req: Request) {
    // Extract refresh token from Authorization header if present
    // In practice, you might store this in a cookie or separate header
    const refreshToken = req.headers['x-refresh-token'] as string | undefined

    const sessions = await this.sessionService.getUserSessions(
      user.id,
      refreshToken,
    )

    return { sessions }
  }

  /**
   * Revoke a specific session
   * DELETE /api/sessions/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(@Param('id') sessionId: string, @CurrentUser() user: any) {
    await this.sessionService.revokeSession(sessionId, user.id)

    return { message: 'Session revoked successfully' }
  }

  /**
   * Revoke all sessions except current
   * POST /api/sessions/revoke-all
   */
  @Post('revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAllSessions(@CurrentUser() user: any, @Req() req: Request) {
    const refreshToken = req.headers['x-refresh-token'] as string | undefined

    const count = await this.sessionService.revokeAllSessions(
      user.id,
      refreshToken,
    )

    return {
      message: `${count} session(s) revoked successfully`,
      count,
    }
  }

  /**
   * Revoke all sessions including current
   * POST /api/sessions/revoke-all-including-current
   */
  @Post('revoke-all-including-current')
  @HttpCode(HttpStatus.OK)
  async revokeAllSessionsIncludingCurrent(@CurrentUser() user: any) {
    const count =
      await this.sessionService.revokeAllSessionsIncludingCurrent(user.id)

    return {
      message: `All ${count} session(s) revoked successfully. Please login again.`,
      count,
    }
  }

  /**
   * Get recent login attempts
   * GET /api/sessions/login-attempts
   */
  @Get('login-attempts')
  @HttpCode(HttpStatus.OK)
  async getLoginAttempts(@CurrentUser() user: any) {
    // Get user email first
    const dbUser = await this.sessionService['prisma'].user.findUnique({
      where: { id: user.id },
      select: { email: true },
    })

    if (!dbUser) {
      return { attempts: [] }
    }

    const attempts = await this.sessionService.getLoginAttempts(
      dbUser.email,
      20,
    )

    return { attempts }
  }
}
