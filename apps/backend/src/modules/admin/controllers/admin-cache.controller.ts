import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { AdminGuard } from '../guards/admin.guard'
import { PrismaService } from '../../prisma/prisma.service'
import { RemoteImageCacheService, CacheStats, CleanupResult } from '../../federation/services/remote-image-cache.service'
import { UpdateCacheSettingsDto } from '../dto/cache-settings.dto'

export interface CacheSettingsResponse {
  remoteImageCacheEnabled: boolean
  remoteImageCacheTtlDays: number
  remoteImageAutoCache: boolean
  cachePriorityEnabled: boolean
  cachePriorityThreshold: number
  cacheTtlMultiplierTier1: number
  cacheTtlMultiplierTier2: number
  cacheTtlMultiplierTier3: number
  cacheLikeTier1: number
  cacheLikeTier2: number
  cacheLikeTier3: number
}

@Controller('admin/cache')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCacheController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly remoteImageCacheService: RemoteImageCacheService,
  ) {}

  /**
   * GET /api/admin/cache/stats
   * キャッシュ統計を取得
   */
  @Get('stats')
  async getCacheStats(): Promise<CacheStats> {
    return await this.remoteImageCacheService.getCacheStats()
  }

  /**
   * GET /api/admin/cache/settings
   * キャッシュ設定を取得
   */
  @Get('settings')
  async getCacheSettings(): Promise<CacheSettingsResponse> {
    const settings = await this.prisma.instanceSettings.findFirst()

    if (!settings) {
      // デフォルト値を返す
      return {
        remoteImageCacheEnabled: true,
        remoteImageCacheTtlDays: 30,
        remoteImageAutoCache: true,
        cachePriorityEnabled: true,
        cachePriorityThreshold: 100,
        cacheTtlMultiplierTier1: 1.5,
        cacheTtlMultiplierTier2: 2.0,
        cacheTtlMultiplierTier3: 3.0,
        cacheLikeTier1: 10,
        cacheLikeTier2: 50,
        cacheLikeTier3: 100,
      }
    }

    return {
      remoteImageCacheEnabled: settings.remoteImageCacheEnabled,
      remoteImageCacheTtlDays: settings.remoteImageCacheTtlDays,
      remoteImageAutoCache: settings.remoteImageAutoCache,
      cachePriorityEnabled: settings.cachePriorityEnabled,
      cachePriorityThreshold: settings.cachePriorityThreshold,
      cacheTtlMultiplierTier1: settings.cacheTtlMultiplierTier1,
      cacheTtlMultiplierTier2: settings.cacheTtlMultiplierTier2,
      cacheTtlMultiplierTier3: settings.cacheTtlMultiplierTier3,
      cacheLikeTier1: settings.cacheLikeTier1,
      cacheLikeTier2: settings.cacheLikeTier2,
      cacheLikeTier3: settings.cacheLikeTier3,
    }
  }

  /**
   * PATCH /api/admin/cache/settings
   * キャッシュ設定を更新
   */
  @Patch('settings')
  async updateCacheSettings(
    @Body() dto: UpdateCacheSettingsDto,
  ): Promise<CacheSettingsResponse> {
    const settings = await this.prisma.instanceSettings.findFirst()

    if (!settings) {
      throw new Error('Instance settings not found')
    }

    const updated = await this.prisma.instanceSettings.update({
      where: { id: settings.id },
      data: {
        ...(dto.remoteImageCacheEnabled !== undefined && {
          remoteImageCacheEnabled: dto.remoteImageCacheEnabled,
        }),
        ...(dto.remoteImageCacheTtlDays !== undefined && {
          remoteImageCacheTtlDays: dto.remoteImageCacheTtlDays,
        }),
        ...(dto.remoteImageAutoCache !== undefined && {
          remoteImageAutoCache: dto.remoteImageAutoCache,
        }),
        ...(dto.cachePriorityEnabled !== undefined && {
          cachePriorityEnabled: dto.cachePriorityEnabled,
        }),
        ...(dto.cachePriorityThreshold !== undefined && {
          cachePriorityThreshold: dto.cachePriorityThreshold,
        }),
        ...(dto.cacheTtlMultiplierTier1 !== undefined && {
          cacheTtlMultiplierTier1: dto.cacheTtlMultiplierTier1,
        }),
        ...(dto.cacheTtlMultiplierTier2 !== undefined && {
          cacheTtlMultiplierTier2: dto.cacheTtlMultiplierTier2,
        }),
        ...(dto.cacheTtlMultiplierTier3 !== undefined && {
          cacheTtlMultiplierTier3: dto.cacheTtlMultiplierTier3,
        }),
        ...(dto.cacheLikeTier1 !== undefined && {
          cacheLikeTier1: dto.cacheLikeTier1,
        }),
        ...(dto.cacheLikeTier2 !== undefined && {
          cacheLikeTier2: dto.cacheLikeTier2,
        }),
        ...(dto.cacheLikeTier3 !== undefined && {
          cacheLikeTier3: dto.cacheLikeTier3,
        }),
      },
    })

    return {
      remoteImageCacheEnabled: updated.remoteImageCacheEnabled,
      remoteImageCacheTtlDays: updated.remoteImageCacheTtlDays,
      remoteImageAutoCache: updated.remoteImageAutoCache,
      cachePriorityEnabled: updated.cachePriorityEnabled,
      cachePriorityThreshold: updated.cachePriorityThreshold,
      cacheTtlMultiplierTier1: updated.cacheTtlMultiplierTier1,
      cacheTtlMultiplierTier2: updated.cacheTtlMultiplierTier2,
      cacheTtlMultiplierTier3: updated.cacheTtlMultiplierTier3,
      cacheLikeTier1: updated.cacheLikeTier1,
      cacheLikeTier2: updated.cacheLikeTier2,
      cacheLikeTier3: updated.cacheLikeTier3,
    }
  }

  /**
   * POST /api/admin/cache/cleanup
   * 期限切れキャッシュを手動削除
   */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async runCacheCleanup(): Promise<CleanupResult> {
    return await this.remoteImageCacheService.cleanupExpiredCache()
  }

  /**
   * DELETE /api/admin/cache/instance/:domain
   * 特定インスタンスのキャッシュを削除
   */
  @Delete('instance/:domain')
  async clearInstanceCache(
    @Param('domain') domain: string,
  ): Promise<CleanupResult> {
    return await this.remoteImageCacheService.clearInstanceCache(domain)
  }
}
