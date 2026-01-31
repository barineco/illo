import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { RateLimitService } from './rate-limit.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AdminGuard } from '../admin/guards/admin.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UpdateRateLimitConfigDto } from './dto/rate-limit-config.dto'
import {
  RateLimitLogQueryDto,
  RateLimitPenaltyQueryDto,
} from './dto/rate-limit-log-query.dto'

@Controller('admin/rate-limit')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RateLimitController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Get('config')
  async getConfig() {
    return this.rateLimitService.getConfig();
  }

  @Put('config')
  async updateConfig(
    @Body() dto: UpdateRateLimitConfigDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.rateLimitService.updateConfig(dto, user.id);
  }

  @Get('logs')
  async getLogs(@Query() query: RateLimitLogQueryDto) {
    return this.rateLimitService.getLogs(query);
  }

  @Get('penalties')
  async getPenalties(@Query() query: RateLimitPenaltyQueryDto) {
    return this.rateLimitService.getPenalties(query);
  }

  @Delete('penalties/:id')
  async deletePenalty(@Param('id') id: string) {
    await this.rateLimitService.deletePenalty(id);
    return { success: true };
  }

  @Get('stats')
  async getStats() {
    return this.rateLimitService.getStats();
  }
}
