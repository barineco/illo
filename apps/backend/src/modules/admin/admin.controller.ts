import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { AdminService } from './admin.service'
import { AdminActivityDeliveriesService } from './services/admin-activity-deliveries.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AdminGuard } from './guards/admin.guard'
import { UserFilterDto } from './dto/user-filter.dto'
import { VerifyAdminPasswordDto } from './dto/verify-admin-password.dto'
import { RejectUserDto } from './dto/reject-user.dto'
import { SuspendUserDto } from './dto/suspend-user.dto'
import { ActivityDeliveryStatus } from '@prisma/client'

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminActivityDeliveriesService: AdminActivityDeliveriesService,
  ) {}

  @Get('users')
  async getAllUsers(@Query() filters: UserFilterDto) {
    return this.adminService.getAllUsers(filters)
  }

  @Post('users/:userId/approve')
  async approveUser(
    @Param('userId') userId: string,
    @Body() dto: VerifyAdminPasswordDto,
    @Req() req,
  ) {
    return this.adminService.approveUser(req.user.id, userId, dto.password)
  }

  @Post('users/:userId/reject')
  async rejectUser(
    @Param('userId') userId: string,
    @Body() dto: RejectUserDto,
    @Req() req,
  ) {
    return this.adminService.rejectUser(
      req.user.id,
      userId,
      dto.reason,
      dto.password,
    )
  }

  @Post('users/:userId/suspend')
  async suspendUser(
    @Param('userId') userId: string,
    @Body() dto: SuspendUserDto,
    @Req() req,
  ) {
    return this.adminService.suspendUser(
      req.user.id,
      userId,
      dto.reason,
      dto.password,
    )
  }

  @Post('users/:userId/activate')
  async activateUser(
    @Param('userId') userId: string,
    @Body() dto: VerifyAdminPasswordDto,
    @Req() req,
  ) {
    return this.adminService.activateUser(req.user.id, userId, dto.password)
  }

  @Post('users/:userId/set-tier')
  async setUserTier(
    @Param('userId') userId: string,
    @Body() dto: { tier: string; password: string },
    @Req() req,
  ) {
    return this.adminService.setUserTier(
      req.user.id,
      userId,
      dto.tier as any,
      dto.password,
    )
  }

  // ============================================
  // Activity Delivery Management
  // ============================================

  @Get('activity-deliveries')
  async getActivityDeliveries(
    @Query('status') status?: ActivityDeliveryStatus,
    @Query('activityType') activityType?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminActivityDeliveriesService.getDeliveries({
      status,
      activityType,
      page: Number(page),
      limit: Number(limit),
    })
  }

  @Get('activity-deliveries/stats')
  async getActivityDeliveryStats() {
    return this.adminActivityDeliveriesService.getDeliveryStats()
  }

  @Get('activity-deliveries/:id')
  async getActivityDelivery(@Param('id') id: string) {
    return this.adminActivityDeliveriesService.getDeliveryById(id)
  }

  @Post('activity-deliveries/:id/retry')
  async retryActivityDelivery(@Param('id') id: string) {
    return this.adminActivityDeliveriesService.retryDelivery(id)
  }

  @Post('activity-deliveries/retry-all-failed')
  async retryAllFailedDeliveries() {
    return this.adminActivityDeliveriesService.retryAllFailed()
  }
}
