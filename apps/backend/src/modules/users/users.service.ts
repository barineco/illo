import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { ActivityDeliveryService } from '../federation/services/activity-delivery.service'
import { FederationSearchService } from '../federation/services/federation-search.service'
import { UserRole, BirthdayDisplay, Prisma } from '@prisma/client'

export interface CustomLink {
  url: string
  title: string
}

export interface SocialLinks {
  bluesky?: string // handle.bsky.social (OAuth連携用)
  customLinks?: CustomLink[] // ユーザー定義のカスタムリンク（最大5件）
}

export interface UpdateProfileDto {
  displayName?: string
  bio?: string
  avatarUrl?: string
  coverImageUrl?: string
  socialLinks?: SocialLinks
}

// Content filter settings per rating level
export type FilterSetting = 'show' | 'blur' | 'hide'

export interface ContentFilters {
  nsfw: FilterSetting
  r18: FilterSetting
  r18g: FilterSetting
}

// Default content filters (conservative for new users)
export const DEFAULT_CONTENT_FILTERS: ContentFilters = {
  nsfw: 'blur',
  r18: 'hide',
  r18g: 'hide',
}

export interface UpdateBirthdayDto {
  birthday: string | null // ISO date string
  birthdayDisplay: BirthdayDisplay
}

export interface UpdateContentFiltersDto {
  nsfw?: FilterSetting
  r18?: FilterSetting
  r18g?: FilterSetting
}

export interface UserProfileResponse {
  id: string
  username: string
  domain: string | null // ActivityPub domain (null for local users)
  email?: string // Only returned for own profile
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  coverImageUrl: string | null
  socialLinks: SocialLinks | null
  blueskyDid: string | null // Bluesky DID (if OAuth linked)
  blueskyHandle: string | null
  blueskyVerified: boolean
  role: UserRole
  isActive: boolean
  isVerified: boolean
  supporterTier: string // SupporterTier enum from Prisma
  // Patreon OAuth fields (only for own profile)
  patreonId?: string | null
  patreonLastSyncAt?: Date | null
  // Birthday fields (display controlled by birthdayDisplay setting)
  birthday?: Date | null
  birthdayDisplay?: BirthdayDisplay
  isAdult?: boolean // Computed: age >= 18
  // Content filters (only for own profile)
  contentFilters?: ContentFilters
  createdAt: Date
  updatedAt: Date
  _count?: {
    artworks: number
    following: number
    followers: number
  }
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    @Inject(forwardRef(() => ActivityDeliveryService))
    private activityDeliveryService: ActivityDeliveryService,
    @Inject(forwardRef(() => FederationSearchService))
    private federationSearchService: FederationSearchService,
  ) {}

  /**
   * Parse username handle to extract username and domain
   * Supports formats: "username" or "username@domain"
   */
  private parseUserHandle(handle: string): { username: string; domain: string } {
    const parts = handle.split('@')
    if (parts.length === 1) {
      // Local user: "username"
      return { username: parts[0], domain: '' }
    } else if (parts.length === 2) {
      // Remote user: "username@domain"
      return { username: parts[0], domain: parts[1] }
    }
    throw new NotFoundException(`Invalid user handle format: ${handle}`)
  }

  /**
   * Get user profile by username
   * Supports both local users ("username") and remote users ("username@domain")
   * For remote users not in DB, attempts to fetch via ActivityPub
   */
  async getUserByUsername(
    handle: string,
    includeEmail: boolean = false,
  ): Promise<UserProfileResponse> {
    const { username, domain } = this.parseUserHandle(handle)

    let user = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
      include: {
        _count: {
          select: {
            artworks: true,
            following: true,
            followers: true,
          },
        },
      },
    })

    // If user not found and it's a remote user, try to fetch via ActivityPub
    if (!user && domain !== '') {
      this.logger.log(`User @${handle} not in DB, attempting ActivityPub fetch`)
      try {
        const remoteUser = await this.federationSearchService.searchByHandle(`@${username}@${domain}`)
        if (remoteUser && remoteUser.id) {
          // Re-fetch from DB with full relations after federation search saved it
          user = await this.prisma.user.findUnique({
            where: { id: remoteUser.id },
            include: {
              _count: {
                select: {
                  artworks: true,
                  following: true,
                  followers: true,
                },
              },
            },
          })
          this.logger.log(`Successfully fetched remote user @${handle} via ActivityPub`)
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch remote user @${handle}: ${error.message}`)
      }
    }

    if (!user) {
      throw new NotFoundException(`User @${handle} not found`)
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is disabled')
    }

    const profile: UserProfileResponse = {
      id: user.id,
      username: user.username,
      domain: user.domain,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverImageUrl: user.coverImageUrl,
      socialLinks: user.socialLinks as SocialLinks | null,
      blueskyDid: user.blueskyDid,
      blueskyHandle: user.blueskyHandle,
      blueskyVerified: user.blueskyVerified,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      supporterTier: user.supporterTier,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _count: user._count,
    }

    // Only include email and Patreon fields if requested (for own profile)
    if (includeEmail) {
      profile.email = user.email
      profile.patreonId = user.patreonId
      profile.patreonLastSyncAt = user.patreonLastSyncAt
    }

    return profile
  }

  /**
   * Get user profile by ID
   */
  async getUserById(
    userId: string,
    includeEmail: boolean = false,
  ): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            artworks: true,
            following: true,
            followers: true,
          },
        },
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account is disabled')
    }

    const profile: UserProfileResponse = {
      id: user.id,
      username: user.username,
      domain: user.domain,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverImageUrl: user.coverImageUrl,
      socialLinks: user.socialLinks as SocialLinks | null,
      blueskyDid: user.blueskyDid,
      blueskyHandle: user.blueskyHandle,
      blueskyVerified: user.blueskyVerified,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      supporterTier: user.supporterTier,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _count: user._count,
    }

    if (includeEmail) {
      profile.email = user.email
      profile.patreonId = user.patreonId
      profile.patreonLastSyncAt = user.patreonLastSyncAt
    }

    return profile
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateData: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Prepare update data with proper type casting for Prisma
    const prismaUpdateData: any = {
      ...(updateData.displayName !== undefined && { displayName: updateData.displayName }),
      ...(updateData.bio !== undefined && { bio: updateData.bio }),
      ...(updateData.avatarUrl !== undefined && { avatarUrl: updateData.avatarUrl }),
      ...(updateData.coverImageUrl !== undefined && { coverImageUrl: updateData.coverImageUrl }),
      ...(updateData.socialLinks !== undefined && { socialLinks: updateData.socialLinks }),
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: prismaUpdateData,
      include: {
        _count: {
          select: {
            artworks: true,
            following: true,
            followers: true,
          },
        },
      },
    })

    // Send Update activity to remote followers (only for local users)
    if (!updatedUser.domain) {
      this.activityDeliveryService
        .sendUpdateProfile(updatedUser)
        .catch((err) => this.logger.error(`Failed to send profile Update: ${err.message}`))
    }

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      domain: updatedUser.domain,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      coverImageUrl: updatedUser.coverImageUrl,
      socialLinks: updatedUser.socialLinks as SocialLinks | null,
      blueskyDid: updatedUser.blueskyDid,
      blueskyHandle: updatedUser.blueskyHandle,
      blueskyVerified: updatedUser.blueskyVerified,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
      isVerified: updatedUser.isVerified,
      supporterTier: updatedUser.supporterTier,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      _count: updatedUser._count,
    }
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain: '', // Check local users only
        },
      },
    })
    return !user
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })
    return !user
  }

  /**
   * Search users by username or display name
   */
  async searchUsers(
    query: string,
    limit: number = 10,
    includeRemote: boolean = true,
  ): Promise<{
    users: UserProfileResponse[]
    total: number
  }> {
    const whereConditions: any = {
      isActive: true, // Only show active users in search
      OR: [
        { username: { contains: query, mode: 'insensitive' } },
        { displayName: { contains: query, mode: 'insensitive' } },
      ],
    }

    // リモートユーザーを含めない場合
    if (!includeRemote) {
      whereConditions.domain = null
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereConditions,
        take: limit,
        select: {
          id: true,
          username: true,
          domain: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          coverImageUrl: true,
          socialLinks: true,
          blueskyDid: true,
          blueskyHandle: true,
          blueskyVerified: true,
          role: true,
          isActive: true,
          isVerified: true,
          supporterTier: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              artworks: true,
              following: true,
              followers: true,
            },
          },
        },
        orderBy: [
          { domain: 'asc' }, // ローカルユーザーを優先
          { username: 'asc' },
        ],
      }),
      this.prisma.user.count({ where: whereConditions }),
    ])

    return {
      users: users.map((user) => ({
        ...user,
        socialLinks: user.socialLinks as SocialLinks | null,
      })),
      total,
    }
  }

  /**
   * Upload avatar image (NOT encrypted - for ActivityPub compatibility)
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
    cropRegion?: { x: number; y: number; width: number; height: number },
  ): Promise<{ avatarUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Upload profile image WITHOUT encryption (direct MinIO URL)
    // Avatar uses smaller size (400px) for better performance
    const result = await this.storageService.uploadProfileImage(
      file,
      `users/${userId}/avatar`,
      400, // maxWidth for avatar
      85,  // quality
      cropRegion,
    )

    // Update user's avatar URL
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: result.url,
      },
    })

    // Send Update activity to remote followers (only for local users)
    if (!updatedUser.domain) {
      this.activityDeliveryService
        .sendUpdateProfile(updatedUser)
        .catch((err) => this.logger.error(`Failed to send avatar Update: ${err.message}`))
    }

    return { avatarUrl: result.url }
  }

  /**
   * Upload cover image (NOT encrypted - for ActivityPub compatibility)
   */
  async uploadCoverImage(
    userId: string,
    file: Express.Multer.File,
    cropRegion?: { x: number; y: number; width: number; height: number },
  ): Promise<{ coverImageUrl: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Upload profile image WITHOUT encryption (direct MinIO URL)
    // Cover uses larger size (1920px) for banner display
    const result = await this.storageService.uploadProfileImage(
      file,
      `users/${userId}/cover`,
      1920, // maxWidth for cover
      90,   // quality
      cropRegion,
    )

    // Update user's cover image URL
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        coverImageUrl: result.url,
      },
    })

    // Send Update activity to remote followers (only for local users)
    if (!updatedUser.domain) {
      this.activityDeliveryService
        .sendUpdateProfile(updatedUser)
        .catch((err) => this.logger.error(`Failed to send cover Update: ${err.message}`))
    }

    return { coverImageUrl: result.url }
  }

  /**
   * Get dashboard statistics for current user
   */
  async getDashboardStats(userId: string) {
    const [
      artworkStats,
      followerCount,
      followingCount,
      bookmarkCount,
    ] = await Promise.all([
      // Artwork stats aggregation
      this.prisma.artwork.aggregate({
        where: { authorId: userId, isDeleted: false },
        _sum: {
          viewCount: true,
          likeCount: true,
          bookmarkCount: true,
          commentCount: true,
        },
        _count: true,
      }),
      // Follower count
      this.prisma.follow.count({
        where: { followingId: userId, status: 'ACCEPTED' },
      }),
      // Following count
      this.prisma.follow.count({
        where: { followerId: userId, status: 'ACCEPTED' },
      }),
      // User's bookmarks
      this.prisma.bookmark.count({
        where: { userId },
      }),
    ])

    return {
      artworks: {
        count: artworkStats._count,
        totalViews: artworkStats._sum.viewCount || 0,
        totalLikes: artworkStats._sum.likeCount || 0,
        totalBookmarks: artworkStats._sum.bookmarkCount || 0,
        totalComments: artworkStats._sum.commentCount || 0,
      },
      followers: followerCount,
      following: followingCount,
      bookmarks: bookmarkCount,
    }
  }

  /**
   * Get current user's artworks with stats
   */
  async getMyArtworks(userId: string) {
    const artworks = await this.prisma.artwork.findMany({
      where: { authorId: userId, isDeleted: false },
      select: {
        id: true,
        title: true,
        type: true,
        ageRating: true,
        visibility: true,
        viewCount: true,
        likeCount: true,
        bookmarkCount: true,
        commentCount: true,
        createdAt: true,
        updatedAt: true,
        images: {
          select: {
            id: true,
            thumbnailUrl: true,
          },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { artworks }
  }

  /**
   * Get user by Bluesky handle
   * Used for /at/:handle URL redirect
   */
  async getUserByBlueskyHandle(handle: string): Promise<UserProfileResponse | null> {
    // Normalize handle (remove @ if present, ensure .bsky.social suffix if not present)
    let normalizedHandle = handle.replace(/^@/, '')
    if (!normalizedHandle.includes('.')) {
      normalizedHandle = `${normalizedHandle}.bsky.social`
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { blueskyHandle: normalizedHandle },
          { blueskyHandle: handle }, // Also try original format
          // Also check socialLinks.bluesky field
          {
            socialLinks: {
              path: ['bluesky'],
              equals: normalizedHandle,
            },
          },
          {
            socialLinks: {
              path: ['bluesky'],
              equals: handle,
            },
          },
        ],
        isActive: true,
        domain: '', // Local users only
      },
      include: {
        _count: {
          select: {
            artworks: true,
            following: true,
            followers: true,
          },
        },
      },
    })

    if (!user) {
      return null
    }

    return {
      id: user.id,
      username: user.username,
      domain: user.domain,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      coverImageUrl: user.coverImageUrl,
      socialLinks: user.socialLinks as SocialLinks | null,
      blueskyDid: user.blueskyDid,
      blueskyHandle: user.blueskyHandle,
      blueskyVerified: user.blueskyVerified,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      supporterTier: user.supporterTier,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      _count: user._count,
    }
  }

  // ========================================
  // Age Verification & Content Filters
  // ========================================

  /**
   * Calculate age from birthday
   */
  calculateAge(birthday: Date): number {
    const today = new Date()
    const birthDate = new Date(birthday)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  /**
   * Check if user is 18 or older
   */
  async isUserAdult(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthday: true, ageVerifiedAt: true },
    })

    if (!user || !user.birthday) {
      return false
    }

    return this.calculateAge(user.birthday) >= 18
  }

  /**
   * Update user's birthday and display setting
   */
  async updateBirthday(
    userId: string,
    dto: UpdateBirthdayDto,
  ): Promise<{ birthday: Date | null; birthdayDisplay: BirthdayDisplay; isAdult: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const birthday = dto.birthday ? new Date(dto.birthday) : null
    const isAdult = birthday ? this.calculateAge(birthday) >= 18 : false

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        birthday,
        birthdayDisplay: dto.birthdayDisplay,
        // Set age verification timestamp if birthday indicates adult
        ageVerifiedAt: isAdult ? new Date() : null,
      },
    })

    return {
      birthday: updatedUser.birthday,
      birthdayDisplay: updatedUser.birthdayDisplay,
      isAdult,
    }
  }

  /**
   * Get user's content filters (with defaults applied)
   */
  async getContentFilters(userId: string): Promise<ContentFilters> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { contentFilters: true, birthday: true },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const isAdult = user.birthday ? this.calculateAge(user.birthday) >= 18 : false
    const stored = user.contentFilters as Partial<ContentFilters> | null

    // Merge with defaults
    const filters: ContentFilters = {
      nsfw: stored?.nsfw || DEFAULT_CONTENT_FILTERS.nsfw,
      r18: stored?.r18 || DEFAULT_CONTENT_FILTERS.r18,
      r18g: stored?.r18g || DEFAULT_CONTENT_FILTERS.r18g,
    }

    // Force hide R-18 content for non-adults
    if (!isAdult) {
      filters.r18 = 'hide'
      filters.r18g = 'hide'
    }

    return filters
  }

  /**
   * Update user's content filters
   */
  async updateContentFilters(
    userId: string,
    dto: UpdateContentFiltersDto,
  ): Promise<ContentFilters> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { contentFilters: true, birthday: true },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const isAdult = user.birthday ? this.calculateAge(user.birthday) >= 18 : false

    // Don't allow non-adults to enable R-18 content
    if (!isAdult) {
      if (dto.r18 && dto.r18 !== 'hide') {
        throw new ForbiddenException('Age verification required to view R-18 content')
      }
      if (dto.r18g && dto.r18g !== 'hide') {
        throw new ForbiddenException('Age verification required to view R-18G content')
      }
    }

    const currentFilters = user.contentFilters as Partial<ContentFilters> | null
    const newFilters: ContentFilters = {
      nsfw: dto.nsfw ?? currentFilters?.nsfw ?? DEFAULT_CONTENT_FILTERS.nsfw,
      r18: dto.r18 ?? currentFilters?.r18 ?? DEFAULT_CONTENT_FILTERS.r18,
      r18g: dto.r18g ?? currentFilters?.r18g ?? DEFAULT_CONTENT_FILTERS.r18g,
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        contentFilters: newFilters as unknown as Prisma.InputJsonValue,
      },
    })

    // Force hide R-18 for non-adults in response
    if (!isAdult) {
      newFilters.r18 = 'hide'
      newFilters.r18g = 'hide'
    }

    return newFilters
  }

  /**
   * Get all content-related settings (birthday + filters) for the settings page
   */
  async getContentSettings(userId: string): Promise<{
    birthday: string | null
    birthdayDisplay: BirthdayDisplay
    isAdult: boolean
    contentFilters: ContentFilters
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        birthday: true,
        birthdayDisplay: true,
        contentFilters: true,
      },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const isAdult = user.birthday ? this.calculateAge(user.birthday) >= 18 : false
    const stored = user.contentFilters as Partial<ContentFilters> | null

    // Build content filters with defaults
    const contentFilters: ContentFilters = {
      nsfw: stored?.nsfw || DEFAULT_CONTENT_FILTERS.nsfw,
      r18: stored?.r18 || DEFAULT_CONTENT_FILTERS.r18,
      r18g: stored?.r18g || DEFAULT_CONTENT_FILTERS.r18g,
    }

    // Force hide R-18 for non-adults
    if (!isAdult) {
      contentFilters.r18 = 'hide'
      contentFilters.r18g = 'hide'
    }

    return {
      birthday: user.birthday ? user.birthday.toISOString().split('T')[0] : null,
      birthdayDisplay: user.birthdayDisplay,
      isAdult,
      contentFilters,
    }
  }

  /**
   * Get birthday display value based on user's privacy setting
   * Returns null, month/day only, or full date depending on setting
   */
  formatBirthdayForDisplay(
    birthday: Date | null,
    displaySetting: BirthdayDisplay,
  ): { month?: number; day?: number; year?: number } | null {
    if (!birthday || displaySetting === 'HIDDEN') {
      return null
    }

    const date = new Date(birthday)

    if (displaySetting === 'MONTH_DAY') {
      return {
        month: date.getMonth() + 1,
        day: date.getDate(),
      }
    }

    // FULL_DATE
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    }
  }

  /**
   * Get user's portfolio tools (JSON array of tool names)
   */
  async getToolsUsed(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { toolsUsed: true },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    if (!user.toolsUsed) {
      return []
    }

    try {
      return JSON.parse(user.toolsUsed)
    } catch {
      return []
    }
  }

  /**
   * Update user's portfolio tools
   */
  async updateToolsUsed(userId: string, tools: string[]): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Remove duplicates and empty strings
    const uniqueTools = [...new Set(tools.filter(t => t.trim()))]

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        toolsUsed: JSON.stringify(uniqueTools),
      },
    })

    return uniqueTools
  }

  /**
   * Add a tool to user's portfolio tools (used when adding new tool during artwork creation)
   */
  async addTool(userId: string, tool: string): Promise<string[]> {
    const currentTools = await this.getToolsUsed(userId)

    const trimmedTool = tool.trim()
    if (!trimmedTool) {
      return currentTools
    }

    // Check if tool already exists (case-insensitive)
    const exists = currentTools.some(t => t.toLowerCase() === trimmedTool.toLowerCase())
    if (exists) {
      return currentTools
    }

    const newTools = [...currentTools, trimmedTool]

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        toolsUsed: JSON.stringify(newTools),
      },
    })

    return newTools
  }

  /**
   * Get user's tools settings (tools list + useProfileToolsAsDefault)
   */
  async getToolsSettings(userId: string): Promise<{
    tools: string[]
    useProfileToolsAsDefault: boolean
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { toolsUsed: true, useProfileToolsAsDefault: true },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    let tools: string[] = []
    if (user.toolsUsed) {
      try {
        tools = JSON.parse(user.toolsUsed)
      } catch {
        tools = []
      }
    }

    return {
      tools,
      useProfileToolsAsDefault: user.useProfileToolsAsDefault,
    }
  }

  /**
   * Update user's tools settings (tools list and/or useProfileToolsAsDefault)
   */
  async updateToolsSettings(
    userId: string,
    dto: { tools?: string[]; useProfileToolsAsDefault?: boolean },
  ): Promise<{
    tools: string[]
    useProfileToolsAsDefault: boolean
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new NotFoundException('User not found')
    }

    const updateData: any = {}

    if (dto.tools !== undefined) {
      // Remove duplicates and empty strings
      const uniqueTools = [...new Set(dto.tools.filter(t => t.trim()))]
      updateData.toolsUsed = JSON.stringify(uniqueTools)
    }

    if (dto.useProfileToolsAsDefault !== undefined) {
      updateData.useProfileToolsAsDefault = dto.useProfileToolsAsDefault
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { toolsUsed: true, useProfileToolsAsDefault: true },
    })

    let tools: string[] = []
    if (updatedUser.toolsUsed) {
      try {
        tools = JSON.parse(updatedUser.toolsUsed)
      } catch {
        tools = []
      }
    }

    return {
      tools,
      useProfileToolsAsDefault: updatedUser.useProfileToolsAsDefault,
    }
  }

  /**
   * Get tools used for public profile (by username)
   */
  async getToolsUsedByUsername(handle: string): Promise<string[]> {
    const { username, domain } = this.parseUserHandle(handle)

    const user = await this.prisma.user.findUnique({
      where: {
        username_domain: {
          username,
          domain,
        },
      },
      select: { toolsUsed: true },
    })

    if (!user) {
      throw new NotFoundException(`User @${handle} not found`)
    }

    if (!user.toolsUsed) {
      return []
    }

    try {
      return JSON.parse(user.toolsUsed)
    } catch {
      return []
    }
  }

  /**
   * Get top tags for a user (most frequently used tags in their artworks)
   */
  async getUserTopTags(
    handle: string,
    limit: number = 10,
  ): Promise<Array<{ id: string; name: string; count: number }>> {
    // Parse handle to get username and domain
    const [username, domain] = handle.includes('@')
      ? handle.split('@')
      : [handle, '']

    // Find user by username and domain
    const user = await this.prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
        domain: domain || '',
      },
      select: { id: true },
    })

    if (!user) {
      throw new NotFoundException(`User @${handle} not found`)
    }

    // Get tag counts for this user's public/unlisted artworks
    const tagCounts = await this.prisma.artworkTag.groupBy({
      by: ['tagId'],
      _count: {
        tagId: true,
      },
      where: {
        artwork: {
          authorId: user.id,
          isDeleted: false,
          visibility: {
            in: ['PUBLIC', 'UNLISTED'],
          },
        },
      },
      orderBy: {
        _count: {
          tagId: 'desc',
        },
      },
      take: limit,
    })

    if (tagCounts.length === 0) {
      return []
    }

    // Get tag details
    const tagIds = tagCounts.map((tc) => tc.tagId)
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true },
    })

    // Map to result format with counts
    const tagMap = new Map(tags.map((t) => [t.id, t]))
    return tagCounts
      .map((tc) => {
        const tag = tagMap.get(tc.tagId)
        if (!tag) return null
        return {
          id: tag.id,
          name: tag.name,
          count: tc._count.tagId,
        }
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
  }
}
