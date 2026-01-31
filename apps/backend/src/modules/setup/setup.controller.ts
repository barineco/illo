import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common'
import { SetupService } from './setup.service'
import { InitialSetupDto, InstanceMode } from '@illo/shared'
import { Public } from '../auth/decorators/public.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  /**
   * Check if initial setup is complete
   * GET /api/setup/status
   */
  @Public()
  @Get('status')
  async getSetupStatus() {
    const isComplete = await this.setupService.isSetupComplete()
    const publicInfo = await this.setupService.getPublicInstanceInfo()
    const defaults = this.setupService.getSetupDefaults()

    return {
      isSetupComplete: isComplete,
      instanceInfo: publicInfo,
      defaults,
    }
  }

  /**
   * Perform initial setup
   * POST /api/setup/init
   */
  @Public()
  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  async performInitialSetup(@Body() dto: InitialSetupDto) {
    return this.setupService.performInitialSetup(dto)
  }

  /**
   * Update instance mode (admin only)
   * PATCH /api/setup/mode
   */
  @UseGuards(JwtAuthGuard)
  @Patch('mode')
  @HttpCode(HttpStatus.OK)
  async updateInstanceMode(
    @Request() req,
    @Body() body: { instanceMode: InstanceMode },
  ) {
    return this.setupService.updateInstanceMode(req.user.id, body.instanceMode)
  }

  /**
   * Update registration settings (admin only)
   * PATCH /api/setup/registration
   */
  @UseGuards(JwtAuthGuard)
  @Patch('registration')
  @HttpCode(HttpStatus.OK)
  async updateRegistrationSettings(
    @Request() req,
    @Body() body: { allowRegistration?: boolean; requireApproval?: boolean },
  ) {
    return this.setupService.updateRegistrationSettings(
      req.user.id,
      body.allowRegistration,
      body.requireApproval,
    )
  }

  /**
   * Update SEO settings (admin only)
   * PATCH /api/setup/seo
   */
  @UseGuards(JwtAuthGuard)
  @Patch('seo')
  @HttpCode(HttpStatus.OK)
  async updateSeoSettings(
    @Request() req,
    @Body() body: { allowSearchEngineIndexing: boolean },
  ) {
    return this.setupService.updateSeoSettings(
      req.user.id,
      body.allowSearchEngineIndexing,
    )
  }

  /**
   * Update instance branding (admin only)
   * PATCH /api/setup/branding
   */
  @UseGuards(JwtAuthGuard)
  @Patch('branding')
  @HttpCode(HttpStatus.OK)
  async updateInstanceBranding(
    @Request() req,
    @Body() body: { instanceName?: string; description?: string },
  ) {
    return this.setupService.updateInstanceBranding(
      req.user.id,
      body.instanceName,
      body.description,
    )
  }
}
