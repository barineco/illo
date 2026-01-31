import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common'
import { Request } from 'express'
import { WebAuthnService } from './webauthn.service'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  IsObject,
  IsNotEmpty,
} from 'class-validator'

// DTOs
class RegisterPasskeyStartDto {}

class RegisterPasskeyFinishDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string

  @IsObject()
  @IsNotEmpty()
  response: any // RegistrationResponseJSON
}

class AuthenticateStartDto {
  @IsOptional()
  @IsString()
  email?: string
}

class AuthenticateFinishDto {
  @IsObject()
  @IsNotEmpty()
  response: any // AuthenticationResponseJSON

  @IsString()
  challenge: string

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean
}

class RenamePasskeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string
}

@Controller('auth/passkeys')
export class WebAuthnController {
  constructor(
    private webAuthnService: WebAuthnService,
    private authService: AuthService,
  ) {}

  // ==========================================
  // Registration (requires authentication)
  // ==========================================

  /**
   * Start passkey registration
   * POST /api/auth/passkeys/register/start
   */
  @Post('register/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startRegistration(@CurrentUser() user: any) {
    const { options } = await this.webAuthnService.generateRegistrationOptions(
      user.id,
    )
    return { options }
  }

  /**
   * Finish passkey registration
   * POST /api/auth/passkeys/register/finish
   */
  @Post('register/finish')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async finishRegistration(
    @CurrentUser() user: any,
    @Body() dto: RegisterPasskeyFinishDto,
  ) {
    const passkey = await this.webAuthnService.verifyRegistration(
      user.id,
      dto.response,
      dto.name,
    )
    return {
      passkey,
      message: 'Passkey registered successfully',
    }
  }

  // ==========================================
  // Authentication (public endpoints)
  // ==========================================

  /**
   * Start passkey authentication
   * POST /api/auth/passkeys/authenticate/start
   */
  @Public()
  @Post('authenticate/start')
  @HttpCode(HttpStatus.OK)
  async startAuthentication(@Body() dto: AuthenticateStartDto) {
    const { options } =
      await this.webAuthnService.generateAuthenticationOptions(dto.email)
    return { options }
  }

  /**
   * Finish passkey authentication
   * POST /api/auth/passkeys/authenticate/finish
   */
  @Public()
  @Post('authenticate/finish')
  @HttpCode(HttpStatus.OK)
  async finishAuthentication(
    @Body() dto: AuthenticateFinishDto,
    @Req() req: Request,
  ) {
    const { userId } = await this.webAuthnService.verifyAuthentication(
      dto.response,
      dto.challenge,
    )

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    const rememberMe = dto.rememberMe ?? false

    // Generate tokens (same as password login)
    const tokens = await this.authService.generateTokens(
      userId,
      ipAddress,
      userAgent,
      rememberMe,
    )

    // Get user profile
    const userProfile = await this.authService.getProfile(userId)

    return {
      ...tokens,
      user: userProfile,
      message: 'Login successful',
    }
  }

  // ==========================================
  // Management (requires authentication)
  // ==========================================

  /**
   * List user's passkeys
   * GET /api/auth/passkeys
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async listPasskeys(@CurrentUser() user: any) {
    const passkeys = await this.webAuthnService.getUserPasskeys(user.id)
    return { passkeys }
  }

  /**
   * Rename a passkey
   * PATCH /api/auth/passkeys/:id
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async renamePasskey(
    @CurrentUser() user: any,
    @Param('id') passkeyId: string,
    @Body() dto: RenamePasskeyDto,
  ) {
    const passkey = await this.webAuthnService.renamePasskey(
      user.id,
      passkeyId,
      dto.name,
    )
    return {
      passkey,
      message: 'Passkey renamed successfully',
    }
  }

  /**
   * Delete a passkey
   * DELETE /api/auth/passkeys/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deletePasskey(
    @CurrentUser() user: any,
    @Param('id') passkeyId: string,
  ) {
    await this.webAuthnService.deletePasskey(user.id, passkeyId)
    return { message: 'Passkey deleted successfully' }
  }

  /**
   * Check if user has passkeys
   * GET /api/auth/passkeys/status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getPasskeyStatus(@CurrentUser() user: any) {
    const hasPasskeys = await this.webAuthnService.hasPasskeys(user.id)
    const passkeys = await this.webAuthnService.getUserPasskeys(user.id)
    return {
      hasPasskeys,
      count: passkeys.length,
    }
  }
}
