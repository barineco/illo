import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import { TosService } from './tos.service'
import { Public } from '../auth/decorators/public.decorator'
import { AdminGuard } from '../admin/guards/admin.guard'
import {
  AcceptTosDto,
  TosSettingsResponse,
  TosStatusResponse,
} from './dto/tos-settings.dto'

@Controller('tos')
export class TosController {
  constructor(private readonly tosService: TosService) {}

  /**
   * Get public ToS settings (version info only)
   * Public endpoint - no authentication required
   */
  @Public()
  @Get()
  async getTosSettings(): Promise<TosSettingsResponse> {
    return this.tosService.getTosSettings()
  }

  /**
   * Get user's ToS acceptance status
   * Requires authentication
   */
  @Get('status')
  async getTosStatus(@Request() req: any): Promise<TosStatusResponse> {
    const userId = req.user?.id
    if (!userId) {
      throw new ForbiddenException('Authentication required')
    }
    return this.tosService.getTosStatus(userId)
  }

  /**
   * Accept ToS
   * Requires authentication
   */
  @Post('accept')
  async acceptTos(
    @Request() req: any,
    @Body() dto: AcceptTosDto,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.id
    if (!userId) {
      throw new ForbiddenException('Authentication required')
    }

    if (!dto.version || typeof dto.version !== 'number') {
      throw new BadRequestException('Version is required')
    }

    try {
      await this.tosService.acceptTos(userId, dto.version)
      return { success: true }
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to accept ToS',
      )
    }
  }

  /**
   * Increment ToS version (admin only)
   * Used when ToS content is updated via source files
   */
  @UseGuards(AdminGuard)
  @Post('increment-version')
  async incrementVersion(): Promise<TosSettingsResponse> {
    return this.tosService.incrementVersion()
  }
}
