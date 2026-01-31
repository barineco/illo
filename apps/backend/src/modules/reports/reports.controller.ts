import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AdminGuard } from '../admin/guards/admin.guard'
import { ReportsService } from './reports.service'
import { CreateReportDto, UpdateReportDto, ReportQueryDto } from './dto'

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * POST /api/reports
   * Create a new report
   */
  @Post()
  async createReport(
    @Request() req,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.createReport(req.user.id, dto)
  }

  /**
   * GET /api/reports/mine
   * Get reports filed by current user
   */
  @Get('mine')
  async getMyReports(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.reportsService.getMyReports(
      req.user.id,
      parseInt(page, 10),
      Math.min(parseInt(limit, 10), 50),
    )
  }
}

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminReportsController {
  constructor(private reportsService: ReportsService) {}

  /**
   * GET /api/admin/reports
   * Get all reports (admin only)
   */
  @Get()
  async getAllReports(@Query() query: ReportQueryDto) {
    return this.reportsService.getAllReports(query)
  }

  /**
   * GET /api/admin/reports/stats
   * Get report statistics (admin only)
   */
  @Get('stats')
  async getReportStats() {
    return this.reportsService.getReportStats()
  }

  /**
   * GET /api/admin/reports/:id
   * Get report details (admin only)
   */
  @Get(':id')
  async getReportById(@Param('id') id: string) {
    return this.reportsService.getReportById(id)
  }

  /**
   * PATCH /api/admin/reports/:id
   * Update report status (admin only)
   */
  @Patch(':id')
  async updateReport(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.updateReport(id, req.user.id, dto)
  }
}
