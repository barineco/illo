-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InstanceMode" AS ENUM ('PERSONAL', 'FEDERATION_ONLY', 'FULL_FEDIVERSE');

-- CreateEnum
CREATE TYPE "RemoteImageCacheStatus" AS ENUM ('NOT_CACHED', 'CACHING', 'CACHED', 'CACHE_FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "SupporterTier" AS ENUM ('NONE', 'TIER_1', 'TIER_2', 'TIER_3');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'FOLLOWERS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ArtworkType" AS ENUM ('ILLUSTRATION', 'MANGA');

-- CreateEnum
CREATE TYPE "AgeRating" AS ENUM ('ALL_AGES', 'NSFW', 'R18', 'R18G');

-- CreateEnum
CREATE TYPE "CreationPeriodUnit" AS ENUM ('HOURS', 'DAYS', 'WEEKS', 'MONTHS');

-- CreateEnum
CREATE TYPE "ArtworkMedium" AS ENUM ('DIGITAL', 'TRADITIONAL', 'THREE_D', 'MIXED');

-- CreateEnum
CREATE TYPE "BirthdayDisplay" AS ENUM ('HIDDEN', 'MONTH_DAY', 'FULL_DATE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LIKE', 'COMMENT', 'COMMENT_REPLY', 'FOLLOW', 'DIRECT_MESSAGE', 'REACTION');

-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('ARTWORK', 'USER', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('INAPPROPRIATE_CONTENT', 'SPAM', 'HARASSMENT', 'COPYRIGHT_VIOLATION', 'SEXUAL_CONTENT', 'VIOLENCE', 'ACCOUNT_SPAM', 'IMPERSONATION', 'HATE_SPEECH', 'OTHER');

-- CreateEnum
CREATE TYPE "RateLimitTier" AS ENUM ('NORMAL', 'WARNING', 'SOFT_LIMIT', 'HARD_LIMIT');

-- CreateTable
CREATE TABLE "instance_settings" (
    "id" TEXT NOT NULL,
    "instanceName" VARCHAR(100) NOT NULL,
    "instanceMode" "InstanceMode" NOT NULL DEFAULT 'PERSONAL',
    "isSetupComplete" BOOLEAN NOT NULL DEFAULT false,
    "adminUserId" TEXT,
    "allowRegistration" BOOLEAN NOT NULL DEFAULT false,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "publicUrl" VARCHAR(500),
    "federatedInstances" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allow_search_engine_indexing" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "remote_image_cache_enabled" BOOLEAN NOT NULL DEFAULT true,
    "remote_image_cache_ttl_days" INTEGER NOT NULL DEFAULT 30,
    "remote_image_auto_cache" BOOLEAN NOT NULL DEFAULT true,
    "cache_priority_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cache_priority_threshold" INTEGER NOT NULL DEFAULT 100,
    "cache_ttl_multiplier_tier1" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "cache_ttl_multiplier_tier2" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "cache_ttl_multiplier_tier3" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "cache_like_tier1" INTEGER NOT NULL DEFAULT 10,
    "cache_like_tier2" INTEGER NOT NULL DEFAULT 50,
    "cache_like_tier3" INTEGER NOT NULL DEFAULT 100,
    "tos_version" INTEGER NOT NULL DEFAULT 1,
    "tos_updated_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255),
    "passwordHash" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(50),
    "bio" TEXT,
    "avatarUrl" VARCHAR(500),
    "coverImageUrl" VARCHAR(500),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "defaultLicense" VARCHAR(200),
    "usedStorageBytes" BIGINT NOT NULL DEFAULT 0,
    "storageQuotaBytes" BIGINT NOT NULL DEFAULT 1073741824,
    "domain" VARCHAR(255) NOT NULL DEFAULT '',
    "actorUrl" VARCHAR(500),
    "inbox" VARCHAR(500),
    "outbox" VARCHAR(500),
    "publicKey" TEXT,
    "privateKey" TEXT,
    "followers_url" VARCHAR(500),
    "following_url" VARCHAR(500),
    "shared_inbox" VARCHAR(500),
    "summary" TEXT,
    "last_fetched_at" TIMESTAMP(3),
    "fetch_error_count" INTEGER NOT NULL DEFAULT 0,
    "avatar_cache_status" "RemoteImageCacheStatus",
    "avatar_cached_at" TIMESTAMP(3),
    "avatar_cache_expires_at" TIMESTAMP(3),
    "cached_avatar_url" VARCHAR(500),
    "federationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultVisibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifyToken" VARCHAR(255),
    "emailVerifyExpires" TIMESTAMP(3),
    "resetPasswordToken" VARCHAR(255),
    "resetPasswordExpires" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" VARCHAR(30),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "lastModifiedBy" VARCHAR(30),
    "lastModifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" VARCHAR(255),
    "social_links" JSONB,
    "birthday" DATE,
    "birthday_display" "BirthdayDisplay" NOT NULL DEFAULT 'HIDDEN',
    "age_verified_at" TIMESTAMP(3),
    "content_filters" JSONB,
    "bluesky_did" VARCHAR(255),
    "bluesky_handle" VARCHAR(255),
    "bluesky_verified" BOOLEAN NOT NULL DEFAULT false,
    "bluesky_linked_at" TIMESTAMP(3),
    "supporter_tier" "SupporterTier" NOT NULL DEFAULT 'NONE',
    "supporter_since" TIMESTAMP(3),
    "supporter_expires_at" TIMESTAMP(3),
    "patreon_id" VARCHAR(255),
    "patreon_access_token" TEXT,
    "patreon_refresh_token" TEXT,
    "patreon_token_expires_at" TIMESTAMP(3),
    "patreon_last_sync_at" TIMESTAMP(3),
    "tools_used" TEXT,
    "use_profile_tools_as_default" BOOLEAN NOT NULL DEFAULT true,
    "tos_accepted_at" TIMESTAMP(3),
    "tos_accepted_version" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artworks" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "ArtworkType" NOT NULL DEFAULT 'ILLUSTRATION',
    "ageRating" "AgeRating" NOT NULL DEFAULT 'ALL_AGES',
    "authorId" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "license" VARCHAR(200),
    "custom_license_url" VARCHAR(500),
    "custom_license_text" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "apObjectId" TEXT,
    "federated" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "disable_right_click" BOOLEAN NOT NULL DEFAULT true,
    "og_card_url" VARCHAR(500),
    "og_card_blur" BOOLEAN NOT NULL DEFAULT false,
    "og_card_crop_x" INTEGER,
    "og_card_crop_y" INTEGER,
    "og_card_crop_width" INTEGER,
    "og_card_crop_height" INTEGER,
    "creation_date" TIMESTAMP(3),
    "creation_period_value" INTEGER,
    "creation_period_unit" "CreationPeriodUnit",
    "is_commission" BOOLEAN NOT NULL DEFAULT false,
    "client_name" VARCHAR(200),
    "project_name" VARCHAR(200),
    "medium" "ArtworkMedium",
    "external_url" VARCHAR(500),
    "tools_used" TEXT,

    CONSTRAINT "artworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_images" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "thumbnailUrl" VARCHAR(500) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "original_width" INTEGER,
    "original_height" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "storageKey" VARCHAR(500) NOT NULL,
    "originalStorageKey" VARCHAR(500),
    "fileSize" INTEGER NOT NULL,
    "originalFileSize" INTEGER,
    "mimeType" VARCHAR(100) NOT NULL,
    "originalFormat" VARCHAR(20) NOT NULL,
    "hasMetadata" BOOLEAN NOT NULL DEFAULT false,
    "wasResized" BOOLEAN NOT NULL DEFAULT false,
    "encryption_iv" VARCHAR(32),
    "original_encryption_iv" VARCHAR(32),
    "thumbnail_encryption_iv" VARCHAR(32),
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "cache_status" "RemoteImageCacheStatus",
    "cached_at" TIMESTAMP(3),
    "cache_expires_at" TIMESTAMP(3),
    "remote_url" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artwork_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "artworkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artwork_tags" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artwork_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "artworkId" TEXT,
    "commentId" TEXT,
    "likeId" TEXT,
    "followId" TEXT,
    "messageId" TEXT,
    "reactionId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "apActivityId" TEXT,
    "federated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "emoji" VARCHAR(64) NOT NULL,
    "userId" TEXT,
    "ipHash" VARCHAR(64),
    "apActivityId" TEXT,
    "federated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_reaction_limits" (
    "id" TEXT NOT NULL,
    "ipHash" VARCHAR(64) NOT NULL,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anonymous_reaction_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "apActivityId" TEXT,
    "federated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "status" "FollowStatus" NOT NULL DEFAULT 'ACCEPTED',
    "apActivityId" TEXT,
    "federated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" VARCHAR(500) NOT NULL,
    "deviceName" VARCHAR(100),
    "deviceType" VARCHAR(50),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "location" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" VARCHAR(255) NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userAgent" VARCHAR(500),
    "success" BOOLEAN NOT NULL,
    "failureReason" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" BYTEA NOT NULL,
    "credentialPublicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "credentialDeviceType" VARCHAR(32) NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "authenticators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "challenge" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federated_instances" (
    "id" TEXT NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "softwareName" VARCHAR(100),
    "softwareVersion" VARCHAR(50),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federated_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_delivery_logs" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "inboxUrl" VARCHAR(500) NOT NULL,
    "activityType" VARCHAR(50) NOT NULL,
    "activityId" VARCHAR(500),
    "activityPayload" JSONB NOT NULL,
    "status" "ActivityDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "bullmqJobId" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "activity_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "targetUserId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "coverImageUrl" VARCHAR(500),
    "artworkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_artworks" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_artworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mutes" (
    "id" TEXT NOT NULL,
    "muterId" TEXT NOT NULL,
    "mutedId" TEXT NOT NULL,
    "muteNotifications" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_mutes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" VARCHAR(255) NOT NULL,
    "regex" BOOLEAN NOT NULL DEFAULT false,
    "wholeWord" BOOLEAN NOT NULL DEFAULT false,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_mutes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "duration" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tag_mutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reporterId" TEXT NOT NULL,
    "artworkId" TEXT,
    "targetUserId" TEXT,
    "commentId" TEXT,
    "reviewedBy" TEXT,
    "adminNotes" TEXT,
    "adminAction" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200),
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "hasLeft" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "encryption_version" INTEGER NOT NULL DEFAULT 0,
    "content_iv" VARCHAR(24),
    "replyToId" TEXT,
    "apActivityId" TEXT,
    "federated" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mls_key_packages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyPackage" BYTEA NOT NULL,
    "publicKey" VARCHAR(100) NOT NULL,
    "cipherSuite" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "mls_key_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mls_group_states" (
    "id" TEXT NOT NULL,
    "groupId" VARCHAR(100) NOT NULL,
    "epochNumber" INTEGER NOT NULL DEFAULT 0,
    "groupState" BYTEA NOT NULL,
    "participantIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mls_group_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" VARCHAR(45) NOT NULL,
    "endpoint" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "tier" "RateLimitTier" NOT NULL DEFAULT 'NORMAL',
    "requestCount" INTEGER NOT NULL,
    "windowSize" INTEGER NOT NULL,
    "intervalVariance" DOUBLE PRECISION,
    "avgInterval" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "riskScore" DOUBLE PRECISION,
    "intervalScore" DOUBLE PRECISION,
    "regularityScore" DOUBLE PRECISION,
    "detectionReason" VARCHAR(50),
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rate_limit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_penalties" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" VARCHAR(45) NOT NULL,
    "tier" "RateLimitTier" NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 1,
    "escalatedFrom" TEXT,

    CONSTRAINT "rate_limit_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_config" (
    "id" TEXT NOT NULL,
    "windowSeconds" INTEGER NOT NULL DEFAULT 30,
    "softLimitPerWindow" INTEGER NOT NULL DEFAULT 8,
    "hardLimitPerWindow" INTEGER NOT NULL DEFAULT 12,
    "softLimitPerHour" INTEGER NOT NULL DEFAULT 150,
    "hardLimitPerHour" INTEGER NOT NULL DEFAULT 250,
    "cvSoftThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "cvHardThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "softPenaltyMinutes" INTEGER NOT NULL DEFAULT 5,
    "hardPenaltyMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxPenaltyMinutes" INTEGER NOT NULL DEFAULT 120,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "hardLimitScore" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "softLimitScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "warningScore" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "minSamplesAnonymous" INTEGER NOT NULL DEFAULT 15,
    "minSamplesUser" INTEGER NOT NULL DEFAULT 20,
    "instantDetectionIntervalMs" INTEGER NOT NULL DEFAULT 3000,
    "instantDetectionCV" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "measurementMode" BOOLEAN NOT NULL DEFAULT false,
    "useCompositeScore" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "rate_limit_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "view_logs" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "viewerId" TEXT,
    "visitorHash" VARCHAR(64),
    "referrer" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "view_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instance_settings_adminUserId_key" ON "instance_settings"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_actorUrl_key" ON "users"("actorUrl");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerifyToken_key" ON "users"("emailVerifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_resetPasswordToken_key" ON "users"("resetPasswordToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_bluesky_did_key" ON "users"("bluesky_did");

-- CreateIndex
CREATE UNIQUE INDEX "users_patreon_id_key" ON "users"("patreon_id");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_domain_key" ON "users"("username", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "artworks_apObjectId_key" ON "artworks"("apObjectId");

-- CreateIndex
CREATE INDEX "artworks_authorId_idx" ON "artworks"("authorId");

-- CreateIndex
CREATE INDEX "artworks_type_idx" ON "artworks"("type");

-- CreateIndex
CREATE INDEX "artworks_ageRating_idx" ON "artworks"("ageRating");

-- CreateIndex
CREATE INDEX "artworks_visibility_idx" ON "artworks"("visibility");

-- CreateIndex
CREATE INDEX "artworks_createdAt_idx" ON "artworks"("createdAt");

-- CreateIndex
CREATE INDEX "artworks_publishedAt_idx" ON "artworks"("publishedAt");

-- CreateIndex
CREATE INDEX "artworks_viewCount_idx" ON "artworks"("viewCount");

-- CreateIndex
CREATE INDEX "artworks_likeCount_idx" ON "artworks"("likeCount");

-- CreateIndex
CREATE INDEX "artworks_is_deleted_idx" ON "artworks"("is_deleted");

-- CreateIndex
CREATE INDEX "artworks_creation_date_idx" ON "artworks"("creation_date");

-- CreateIndex
CREATE INDEX "artwork_images_artworkId_order_idx" ON "artwork_images"("artworkId", "order");

-- CreateIndex
CREATE INDEX "artwork_images_cache_status_idx" ON "artwork_images"("cache_status");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_name_idx" ON "tags"("name");

-- CreateIndex
CREATE INDEX "tags_artworkCount_idx" ON "tags"("artworkCount");

-- CreateIndex
CREATE INDEX "artwork_tags_artworkId_idx" ON "artwork_tags"("artworkId");

-- CreateIndex
CREATE INDEX "artwork_tags_tagId_idx" ON "artwork_tags"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "artwork_tags_artworkId_tagId_key" ON "artwork_tags"("artworkId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_commentId_key" ON "notifications"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_likeId_key" ON "notifications"("likeId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_followId_key" ON "notifications"("followId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_messageId_key" ON "notifications"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_reactionId_key" ON "notifications"("reactionId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_actorId_idx" ON "notifications"("actorId");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE UNIQUE INDEX "likes_apActivityId_key" ON "likes"("apActivityId");

-- CreateIndex
CREATE INDEX "likes_userId_idx" ON "likes"("userId");

-- CreateIndex
CREATE INDEX "likes_artworkId_idx" ON "likes"("artworkId");

-- CreateIndex
CREATE INDEX "likes_createdAt_idx" ON "likes"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "likes_userId_artworkId_key" ON "likes"("userId", "artworkId");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_apActivityId_key" ON "reactions"("apActivityId");

-- CreateIndex
CREATE INDEX "reactions_artworkId_idx" ON "reactions"("artworkId");

-- CreateIndex
CREATE INDEX "reactions_userId_idx" ON "reactions"("userId");

-- CreateIndex
CREATE INDEX "reactions_ipHash_idx" ON "reactions"("ipHash");

-- CreateIndex
CREATE INDEX "reactions_emoji_idx" ON "reactions"("emoji");

-- CreateIndex
CREATE INDEX "reactions_createdAt_idx" ON "reactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_artworkId_userId_emoji_key" ON "reactions"("artworkId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_artworkId_ipHash_emoji_key" ON "reactions"("artworkId", "ipHash", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_reaction_limits_ipHash_key" ON "anonymous_reaction_limits"("ipHash");

-- CreateIndex
CREATE INDEX "anonymous_reaction_limits_expiresAt_idx" ON "anonymous_reaction_limits"("expiresAt");

-- CreateIndex
CREATE INDEX "bookmarks_userId_idx" ON "bookmarks"("userId");

-- CreateIndex
CREATE INDEX "bookmarks_artworkId_idx" ON "bookmarks"("artworkId");

-- CreateIndex
CREATE INDEX "bookmarks_createdAt_idx" ON "bookmarks"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_artworkId_key" ON "bookmarks"("userId", "artworkId");

-- CreateIndex
CREATE UNIQUE INDEX "comments_apActivityId_key" ON "comments"("apActivityId");

-- CreateIndex
CREATE INDEX "comments_artworkId_idx" ON "comments"("artworkId");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "follows_apActivityId_key" ON "follows"("apActivityId");

-- CreateIndex
CREATE INDEX "follows_followerId_idx" ON "follows"("followerId");

-- CreateIndex
CREATE INDEX "follows_followingId_idx" ON "follows"("followingId");

-- CreateIndex
CREATE INDEX "follows_status_idx" ON "follows"("status");

-- CreateIndex
CREATE INDEX "follows_createdAt_idx" ON "follows"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "follows_followerId_followingId_key" ON "follows"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_userId_idx" ON "two_factor_backup_codes"("userId");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_code_idx" ON "two_factor_backup_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_refreshToken_idx" ON "sessions"("refreshToken");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");

-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_idx" ON "login_attempts"("ipAddress");

-- CreateIndex
CREATE INDEX "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_success_idx" ON "login_attempts"("success");

-- CreateIndex
CREATE UNIQUE INDEX "authenticators_credentialId_key" ON "authenticators"("credentialId");

-- CreateIndex
CREATE INDEX "authenticators_userId_idx" ON "authenticators"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_challenges_challenge_key" ON "webauthn_challenges"("challenge");

-- CreateIndex
CREATE INDEX "webauthn_challenges_expiresAt_idx" ON "webauthn_challenges"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "federated_instances_domain_key" ON "federated_instances"("domain");

-- CreateIndex
CREATE INDEX "federated_instances_domain_idx" ON "federated_instances"("domain");

-- CreateIndex
CREATE INDEX "federated_instances_isTrusted_idx" ON "federated_instances"("isTrusted");

-- CreateIndex
CREATE INDEX "federated_instances_isBlocked_idx" ON "federated_instances"("isBlocked");

-- CreateIndex
CREATE UNIQUE INDEX "activity_delivery_logs_bullmqJobId_key" ON "activity_delivery_logs"("bullmqJobId");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_senderId_idx" ON "activity_delivery_logs"("senderId");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_status_idx" ON "activity_delivery_logs"("status");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_activityType_idx" ON "activity_delivery_logs"("activityType");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_createdAt_idx" ON "activity_delivery_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_inboxUrl_idx" ON "activity_delivery_logs"("inboxUrl");

-- CreateIndex
CREATE INDEX "audit_logs_adminId_idx" ON "audit_logs"("adminId");

-- CreateIndex
CREATE INDEX "audit_logs_targetUserId_idx" ON "audit_logs"("targetUserId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "collections_userId_idx" ON "collections"("userId");

-- CreateIndex
CREATE INDEX "collections_visibility_idx" ON "collections"("visibility");

-- CreateIndex
CREATE INDEX "collections_createdAt_idx" ON "collections"("createdAt");

-- CreateIndex
CREATE INDEX "collection_artworks_collectionId_idx" ON "collection_artworks"("collectionId");

-- CreateIndex
CREATE INDEX "collection_artworks_artworkId_idx" ON "collection_artworks"("artworkId");

-- CreateIndex
CREATE INDEX "collection_artworks_order_idx" ON "collection_artworks"("order");

-- CreateIndex
CREATE UNIQUE INDEX "collection_artworks_collectionId_artworkId_key" ON "collection_artworks"("collectionId", "artworkId");

-- CreateIndex
CREATE INDEX "user_mutes_muterId_idx" ON "user_mutes"("muterId");

-- CreateIndex
CREATE INDEX "user_mutes_mutedId_idx" ON "user_mutes"("mutedId");

-- CreateIndex
CREATE INDEX "user_mutes_expiresAt_idx" ON "user_mutes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_mutes_muterId_mutedId_key" ON "user_mutes"("muterId", "mutedId");

-- CreateIndex
CREATE INDEX "word_mutes_userId_idx" ON "word_mutes"("userId");

-- CreateIndex
CREATE INDEX "word_mutes_expiresAt_idx" ON "word_mutes"("expiresAt");

-- CreateIndex
CREATE INDEX "tag_mutes_userId_idx" ON "tag_mutes"("userId");

-- CreateIndex
CREATE INDEX "tag_mutes_tagId_idx" ON "tag_mutes"("tagId");

-- CreateIndex
CREATE INDEX "tag_mutes_expiresAt_idx" ON "tag_mutes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "tag_mutes_userId_tagId_key" ON "tag_mutes"("userId", "tagId");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_targetUserId_idx" ON "reports"("targetUserId");

-- CreateIndex
CREATE INDEX "reports_artworkId_idx" ON "reports"("artworkId");

-- CreateIndex
CREATE INDEX "reports_commentId_idx" ON "reports"("commentId");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");

-- CreateIndex
CREATE INDEX "conversation_participants_conversationId_idx" ON "conversation_participants"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_apActivityId_key" ON "messages"("apActivityId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_apActivityId_idx" ON "messages"("apActivityId");

-- CreateIndex
CREATE INDEX "mls_key_packages_userId_idx" ON "mls_key_packages"("userId");

-- CreateIndex
CREATE INDEX "mls_key_packages_publicKey_idx" ON "mls_key_packages"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "mls_group_states_groupId_key" ON "mls_group_states"("groupId");

-- CreateIndex
CREATE INDEX "mls_group_states_groupId_idx" ON "mls_group_states"("groupId");

-- CreateIndex
CREATE INDEX "rate_limit_logs_userId_createdAt_idx" ON "rate_limit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_logs_ipAddress_createdAt_idx" ON "rate_limit_logs"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_logs_tier_createdAt_idx" ON "rate_limit_logs"("tier", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_penalties_userId_idx" ON "rate_limit_penalties"("userId");

-- CreateIndex
CREATE INDEX "rate_limit_penalties_ipAddress_idx" ON "rate_limit_penalties"("ipAddress");

-- CreateIndex
CREATE INDEX "rate_limit_penalties_expiresAt_idx" ON "rate_limit_penalties"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_penalties_userId_ipAddress_key" ON "rate_limit_penalties"("userId", "ipAddress");

-- CreateIndex
CREATE INDEX "view_logs_artworkId_createdAt_idx" ON "view_logs"("artworkId", "createdAt");

-- CreateIndex
CREATE INDEX "view_logs_artworkId_visitorHash_idx" ON "view_logs"("artworkId", "visitorHash");

-- CreateIndex
CREATE INDEX "view_logs_createdAt_idx" ON "view_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_images" ADD CONSTRAINT "artwork_images_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_tags" ADD CONSTRAINT "artwork_tags_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artwork_tags" ADD CONSTRAINT "artwork_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_likeId_fkey" FOREIGN KEY ("likeId") REFERENCES "likes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_followId_fkey" FOREIGN KEY ("followId") REFERENCES "follows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reactionId_fkey" FOREIGN KEY ("reactionId") REFERENCES "reactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_artworks" ADD CONSTRAINT "collection_artworks_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_artworks" ADD CONSTRAINT "collection_artworks_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_muterId_fkey" FOREIGN KEY ("muterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_mutes" ADD CONSTRAINT "word_mutes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_mutes" ADD CONSTRAINT "tag_mutes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag_mutes" ADD CONSTRAINT "tag_mutes_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mls_key_packages" ADD CONSTRAINT "mls_key_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_logs" ADD CONSTRAINT "rate_limit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_penalties" ADD CONSTRAINT "rate_limit_penalties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_logs" ADD CONSTRAINT "view_logs_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "view_logs" ADD CONSTRAINT "view_logs_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

