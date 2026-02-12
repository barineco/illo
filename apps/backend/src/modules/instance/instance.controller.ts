import { Controller, Get } from '@nestjs/common'
import { InstanceService } from './instance.service'
import { Public } from '../auth/decorators/public.decorator'

@Controller('instance')
export class InstanceController {
  constructor(private readonly instanceService: InstanceService) {}

  @Public()
  @Get('contact')
  getContactInfo() {
    return this.instanceService.getContactInfo()
  }

  /**
   * GET /api/instance/info
   */
  @Public()
  @Get('info')
  async getPublicInstanceInfo() {
    return this.instanceService.getPublicInstanceInfo()
  }
}
