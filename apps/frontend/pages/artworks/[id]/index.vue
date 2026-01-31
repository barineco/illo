<template>
  <div class="max-w-7xl mx-auto">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State - Artwork not found or access denied -->
    <div v-else-if="errorType" class="flex flex-col items-center justify-center py-20 px-4">
      <!-- Not Found (404) -->
      <template v-if="errorType === 'not_found'">
        <div class="w-24 h-24 mb-6 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
          <Icon name="Photo" class="w-12 h-12 text-[var(--color-text-muted)] opacity-50" />
        </div>
        <h2 class="text-2xl font-bold mb-2">{{ $t('artwork.notFound') }}</h2>
        <p class="text-[var(--color-text-muted)] text-center max-w-md mb-6">
          {{ $t('artwork.notFoundDescription') }}
        </p>
      </template>

      <!-- Access Denied (403) - Private or Followers Only -->
      <template v-else-if="errorType === 'private'">
        <div class="w-24 h-24 mb-6 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
          <Icon name="LockClosed" class="w-12 h-12 text-[var(--color-text-muted)]" />
        </div>
        <h2 class="text-2xl font-bold mb-2">{{ $t('artwork.private') }}</h2>
        <p class="text-[var(--color-text-muted)] text-center max-w-md mb-6">
          {{ $t('artwork.privateDescription') }}
        </p>
      </template>

      <template v-else-if="errorType === 'followers_only'">
        <div class="w-24 h-24 mb-6 rounded-full bg-[var(--color-warning-bg)] flex items-center justify-center">
          <Icon name="Users" class="w-12 h-12 text-[var(--color-warning-text)]" />
        </div>
        <h2 class="text-2xl font-bold mb-2">{{ $t('artwork.followersOnly') }}</h2>
        <p class="text-[var(--color-text-muted)] text-center max-w-md mb-6">
          {{ $t('artwork.followersOnlyDescription') }}
        </p>
      </template>

      <!-- Generic Error -->
      <template v-else>
        <div class="w-24 h-24 mb-6 rounded-full bg-[var(--color-danger-bg)] flex items-center justify-center">
          <Icon name="ExclamationTriangle" class="w-12 h-12 text-[var(--color-danger-text)]" />
        </div>
        <h2 class="text-2xl font-bold mb-2">{{ $t('common.error') }}</h2>
        <p class="text-[var(--color-text-muted)] text-center max-w-md mb-6">
          {{ error }}
        </p>
      </template>

      <!-- Action Buttons -->
      <div class="flex gap-3">
        <BaseButton
          variant="secondary"
          size="md"
          shape="rounded"
          @click="router.back()"
        >
          <Icon name="ArrowLeft" class="w-4 h-4 mr-2" />
          {{ $t('common.goBack') }}
        </BaseButton>
        <BaseButton
          variant="primary"
          size="md"
          shape="rounded"
          @click="navigateTo('/')"
        >
          <Icon name="Home" class="w-4 h-4 mr-2" />
          {{ $t('common.backToHome') }}
        </BaseButton>
      </div>
    </div>

    <!-- Age Verification Required -->
    <div v-else-if="mockArtwork && requiresAgeVerification" class="flex flex-col items-center justify-center py-20 px-4">
      <div class="w-24 h-24 mb-6 rounded-full bg-[var(--color-warning-bg)] flex items-center justify-center">
        <Icon name="ExclamationTriangle" class="w-12 h-12 text-[var(--color-warning-text)]" />
      </div>
      <h2 class="text-2xl font-bold mb-2">{{ $t('ageVerification.title') }}</h2>
      <div class="inline-flex items-center gap-1 px-3 py-1 mb-4 rounded-full text-sm font-medium bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">
        {{ $t(`artwork.rating.${mockArtwork.ageRating?.toLowerCase()}`) }}
      </div>
      <p class="text-[var(--color-text-muted)] text-center max-w-md mb-6">
        {{ $t('ageVerification.description') }}
      </p>
      <div class="flex flex-col gap-3 w-full max-w-xs">
        <BaseButton
          variant="primary"
          size="lg"
          shape="rounded"
          @click="onAgeConfirm"
        >
          {{ $t('ageVerification.confirm') }}
        </BaseButton>
        <BaseButton
          variant="ghost"
          size="md"
          shape="rounded"
          @click="onAgeCancel"
        >
          {{ $t('ageVerification.goBack') }}
        </BaseButton>
      </div>
    </div>

    <!-- Main Artwork Section -->
    <div v-else-if="mockArtwork" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Artwork Images -->
      <div class="lg:col-span-2">
        <div
          class="bg-[var(--color-surface)] rounded-lg overflow-hidden cursor-pointer hover:ring-2 ring-[var(--color-primary)] transition-all"
          @click="openViewer(currentImageIndex)"
          :title="$t('artwork.clickToEnlarge')"
        >
          <img
            :src="currentImageSignedUrl || currentThumbnailSignedUrl || mockArtwork.images[currentImageIndex].thumbnailUrl"
            :alt="mockArtwork.title"
            class="w-full h-auto"
            :class="{ 'select-none': mockArtwork.disableRightClick, 'blur-sm': isLoadingMainImage && !currentImageSignedUrl }"
            @contextmenu="handleContextMenu"
            @dragstart="handleDragStart"
          />
        </div>

        <!-- Image Thumbnails (if multiple) -->
        <div
          v-if="mockArtwork.images.length > 1"
          class="flex gap-2 mt-4 overflow-x-auto pb-2"
        >
          <button
            v-for="(image, index) in mockArtwork.images"
            :key="image.id"
            class="flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all"
            :class="
              currentImageIndex === index
                ? 'border-[var(--color-primary)]'
                : 'border-transparent hover:border-[var(--color-border)]'
            "
            @click="currentImageIndex = index"
          >
            <img
              :src="thumbnailSignedUrls.get(image.id) || image.thumbnailUrl"
              :alt="`${mockArtwork.title} - ${index + 1}`"
              class="w-full h-full object-cover"
              :class="{ 'select-none': mockArtwork.disableRightClick }"
              @contextmenu="handleContextMenu"
              @dragstart="handleDragStart"
            />
          </button>
        </div>
      </div>

      <!-- Artwork Info -->
      <div>
        <div class="sticky top-20">
          <div class="flex items-start justify-between mb-4">
            <div class="flex-1">
              <h1 class="text-3xl font-bold">{{ mockArtwork.title }}</h1>
              <!-- Visibility badge (only for non-PUBLIC) -->
              <div
                v-if="mockArtwork.visibility && mockArtwork.visibility !== 'PUBLIC'"
                class="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded text-xs font-medium"
                :class="visibilityBadgeClass"
              >
                <Icon :name="visibilityIcon" class="w-3 h-3" />
                {{ $t(`artwork.visibility.${mockArtwork.visibility.toLowerCase()}`) }}
              </div>
            </div>

            <!-- Edit Button (only for author) -->
            <NuxtLink
              v-if="isAuthor"
              :to="`/artworks/${mockArtwork.id}/edit`"
              class="ml-4"
            >
              <IconButton
                variant="secondary"
                size="md"
                shape="square"
                :aria-label="$t('artwork.edit')"
                :title="$t('artwork.edit')"
              >
                <Icon name="PencilSquare" class="w-5 h-5" />
              </IconButton>
            </NuxtLink>
          </div>

          <!-- Author Info -->
          <NuxtLink
            :to="getUserPathFromUser(mockArtwork.author)"
            class="flex items-center gap-3 mb-6 p-4 bg-[var(--color-surface)] rounded-lg hover:bg-[var(--color-hover)] transition-colors"
          >
            <div class="w-12 h-12 rounded-full bg-[var(--color-surface-secondary)] flex-shrink-0 flex items-center justify-center overflow-hidden">
              <img
                v-if="mockArtwork.author.avatarUrl"
                :src="mockArtwork.author.avatarUrl"
                :alt="mockArtwork.author.username"
                class="w-full h-full rounded-full object-cover"
              />
              <Icon v-else name="UserCircle" class="w-8 h-8 text-[var(--color-text-muted)]" />
            </div>
            <div class="flex-1">
              <div class="font-medium">
                {{ mockArtwork.author.displayName }}
              </div>
              <div class="text-sm text-[var(--color-text-muted)]">
                {{ formatUserHandle(mockArtwork.author) }}
              </div>
            </div>
            <IconButton
              v-if="!isAuthor && user"
              :variant="isFollowing ? 'secondary' : 'primary'"
              size="md"
              shape="circle"
              :disabled="isLoadingSocial"
              :aria-label="isFollowing ? $t('user.unfollow') : $t('user.follow')"
              :title="isFollowing ? $t('user.unfollow') : $t('user.follow')"
              @click.prevent="toggleFollow"
            >
              <Icon :name="isFollowing ? 'UserMinus' : 'UserPlus'" class="w-4 h-4" />
            </IconButton>
          </NuxtLink>

          <!-- Description -->
          <div v-if="mockArtwork.description" class="mb-6">
            <p class="text-[var(--color-text)] whitespace-pre-wrap">
              {{ mockArtwork.description }}
            </p>
          </div>

          <!-- Tags -->
          <div class="mb-6">
            <div class="flex flex-wrap gap-2">
              <TagChip v-for="tag in mockArtwork.tags" :key="tag" :tag="tag" />
            </div>
          </div>

          <!-- Stats -->
          <div class="flex gap-4 mb-6 text-[var(--color-text-muted)]">
            <div class="flex items-center gap-2">
              <Icon name="Eye" class="w-5 h-5" />
              <span>{{ formatCount(mockArtwork.viewCount) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="Heart" class="w-5 h-5" />
              <span>{{ formatCount(mockArtwork.likeCount) }}</span>
            </div>
          </div>

          <!-- Reactions -->
          <div class="mb-6">
            <ArtworkReactions :artwork-id="mockArtwork.id" />
          </div>

          <!-- Actions -->
          <div v-if="user" class="flex gap-2 mb-6">
            <ToggleButton
              v-model="hasLiked"
              variant="like"
              size="lg"
              shape="square"
              :disabled="isLoadingSocial"
              :title="$t('artwork.likes')"
              @click="toggleLike"
            >
              <Icon name="Heart" :solid="hasLiked" class="w-5 h-5" />
            </ToggleButton>
            <ToggleButton
              v-model="hasBookmarked"
              variant="bookmark"
              size="lg"
              shape="square"
              :disabled="isLoadingSocial"
              :title="$t('artwork.bookmarks')"
              @click="toggleBookmark"
            >
              <Icon name="Bookmark" :solid="hasBookmarked" class="w-5 h-5" />
            </ToggleButton>
            <IconButton
              variant="secondary"
              size="lg"
              shape="square"
              :aria-label="$t('artwork.addToCollection')"
              :title="$t('artwork.addToCollection')"
              @click="isCollectionModalOpen = true"
            >
              <Icon name="FolderPlus" class="w-5 h-5" />
            </IconButton>

            <!-- Share Button -->
            <ShareMenu
              :url="artworkUrl"
              :title="mockArtwork.title"
              variant="secondary"
              size="lg"
            />

            <!-- Report Button (not for own artwork) -->
            <IconButton
              v-if="!isAuthor"
              variant="ghost"
              size="lg"
              shape="square"
              :aria-label="$t('report.title')"
              :title="$t('report.title')"
              @click="isReportModalOpen = true"
            >
              <Icon name="Flag" class="w-5 h-5" />
            </IconButton>
          </div>

          <!-- Metadata -->
          <div class="text-sm text-[var(--color-text-muted)] space-y-2 mb-6">
            <div>{{ $t('artwork.postedOn') }}: {{ formatDate(mockArtwork.createdAt) }}</div>
            <div>{{ $t('artwork.ageRating') }}: {{ getAgeRatingLabel(mockArtwork.ageRating) }}</div>
            <div>{{ $t('artwork.type') }}: {{ getTypeLabel(mockArtwork.type) }}</div>
          </div>

          <!-- Creation Info Section (if any metadata exists) -->
          <div
            v-if="hasCreationMetadata"
            class="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)] mb-6"
          >
            <div class="flex items-center gap-2 mb-3">
              <Icon name="PaintBrush" class="w-4 h-4 text-[var(--color-primary)]" />
              <h3 class="font-medium text-sm">{{ $t('artwork.creationInfo') }}</h3>
            </div>
            <div class="text-sm space-y-2">
              <!-- Creation Date -->
              <div v-if="mockArtwork.creationDate">
                <span class="text-[var(--color-text-muted)]">{{ $t('artwork.creationDate') }}:</span>
                <span class="ml-2">{{ formatDate(mockArtwork.creationDate) }}</span>
              </div>

              <!-- Creation Period -->
              <div v-if="mockArtwork.creationPeriodValue && mockArtwork.creationPeriodUnit">
                <span class="text-[var(--color-text-muted)]">{{ $t('artwork.creationPeriod') }}:</span>
                <span class="ml-2">{{ formatCreationPeriod(mockArtwork.creationPeriodValue, mockArtwork.creationPeriodUnit) }}</span>
              </div>

              <!-- Medium -->
              <div v-if="mockArtwork.medium">
                <span class="text-[var(--color-text-muted)]">{{ $t('artwork.medium') }}:</span>
                <span class="ml-2">{{ getMediumLabel(mockArtwork.medium) }}</span>
              </div>

              <!-- Tools Used -->
              <div v-if="mockArtwork.toolsUsed && mockArtwork.toolsUsed.length > 0">
                <span class="text-[var(--color-text-muted)]">{{ $t('artwork.toolsUsed') }}:</span>
                <div class="flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="tool in mockArtwork.toolsUsed"
                    :key="tool"
                    class="inline-flex px-2 py-0.5 bg-[var(--color-background)] rounded text-xs"
                  >
                    {{ tool }}
                  </span>
                </div>
              </div>

              <!-- Project Name -->
              <div v-if="mockArtwork.projectName">
                <span class="text-[var(--color-text-muted)]">{{ $t('artwork.projectName') }}:</span>
                <span class="ml-2">{{ mockArtwork.projectName }}</span>
              </div>

              <!-- Commission -->
              <div v-if="mockArtwork.isCommission">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-info-bg)] text-[var(--color-info-text)] rounded text-xs">
                  <Icon name="Briefcase" class="w-3 h-3" />
                  {{ $t('artwork.commission') }}
                </span>
                <span v-if="mockArtwork.clientName" class="ml-2 text-[var(--color-text)]">
                  {{ mockArtwork.clientName }}
                </span>
              </div>

              <!-- External URL -->
              <div v-if="mockArtwork.externalUrl">
                <a
                  :href="mockArtwork.externalUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  <Icon name="ArrowTopRightOnSquare" class="w-3 h-3" />
                  {{ $t('artwork.externalLink') }}
                </a>
              </div>
            </div>
          </div>

          <!-- License Information -->
          <div
            v-if="mockArtwork.license"
            class="bg-[var(--color-surface)] rounded-lg p-4 border border-[var(--color-border)]"
          >
            <div class="flex items-center gap-2 mb-2">
              <Icon name="Scale" class="w-4 h-4 text-[var(--color-primary)]" />
              <h3 class="font-medium text-sm">{{ $t('artwork.licenseInfo') }}</h3>
            </div>
            <div class="text-sm space-y-2">
              <div class="text-[var(--color-text)]">
                {{ getLicenseLabel(mockArtwork.license) }}
              </div>

              <!-- Custom License URL -->
              <div v-if="mockArtwork.license === 'Custom' && mockArtwork.customLicenseUrl">
                <a
                  :href="mockArtwork.customLicenseUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                >
                  {{ $t('artwork.viewLicenseDetails') }}
                  <Icon name="ArrowTopRightOnSquare" class="w-3 h-3" />
                </a>
              </div>

              <!-- Custom License Text -->
              <div
                v-if="mockArtwork.license === 'Custom' && mockArtwork.customLicenseText"
                class="mt-3 pt-3 border-t border-[var(--color-border)]"
              >
                <div class="text-xs text-[var(--color-text-muted)] mb-1">
                  {{ $t('artwork.customLicenseDetails') }}
                </div>
                <div class="text-sm text-[var(--color-text)] whitespace-pre-wrap">
                  {{ mockArtwork.customLicenseText }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Comments Section -->
    <CommentSection v-if="mockArtwork" :artworkId="mockArtwork.id" />

    <!-- Image Viewer -->
    <ImageViewer
      v-if="mockArtwork"
      ref="imageViewer"
      :images="imagesWithSignedUrls"
      :disable-right-click="mockArtwork.disableRightClick"
    />

    <!-- Collection Modal -->
    <AddToCollectionModal
      v-if="mockArtwork"
      :is-open="isCollectionModalOpen"
      :artwork-id="mockArtwork.id"
      @close="isCollectionModalOpen = false"
      @added="onAddedToCollection"
    />

    <!-- Report Modal -->
    <ReportModal
      v-if="mockArtwork"
      :is-open="isReportModalOpen"
      type="ARTWORK"
      :target-id="mockArtwork.id"
      :target-name="mockArtwork.title"
      @close="isReportModalOpen = false"
      @submitted="onReportSubmitted"
    />
  </div>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const { user } = useAuth()
const { formatUserHandle, getUserPathFromUser } = useUsername()
const { processArtworkResponse } = useRateLimitState()
const { canViewAdultContent, confirmAgeVerification } = useAgeVerification()
const currentImageIndex = ref(0)
const imageViewer = ref<any>(null)
const runtimeConfig = useRuntimeConfig()

// Fetch artwork data with SSR support for OG meta tags
const artworkId = route.params.id as string
const { data: artworkData, error: fetchError, status } = await useAsyncData(
  `artwork-${artworkId}`,
  async () => {
    try {
      const data = await api.get<any>(`/api/artworks/${artworkId}`)
      return {
        id: data.id,
        title: data.title,
        description: data.description || '',
        type: data.type,
        ageRating: data.ageRating,
        visibility: data.visibility || 'PUBLIC',
        viewCount: data.viewCount || 0,
        likeCount: data._count?.likes || 0,
        bookmarkCount: data._count?.bookmarks || 0,
        commentCount: data._count?.comments || 0,
        createdAt: new Date(data.createdAt),
        author: {
          username: data.author.username,
          domain: data.author.domain || null,
          displayName: data.author.displayName || data.author.username,
          avatarUrl: data.author.avatarUrl,
        },
        tags: data.tags?.map((t: any) => t.name) || [],
        images: data.images.map((img: any) => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          width: img.width,
          height: img.height,
          degraded: img.degraded,
        })),
        disableRightClick: data.disableRightClick ?? true,
        ogCardUrl: data.ogCardUrl || null,
        license: data.license || null,
        customLicenseUrl: data.customLicenseUrl || null,
        customLicenseText: data.customLicenseText || null,
        // Creation metadata (portfolio fields)
        creationDate: data.creationDate ? new Date(data.creationDate) : null,
        creationPeriodValue: data.creationPeriodValue || null,
        creationPeriodUnit: data.creationPeriodUnit || null,
        isCommission: data.isCommission || false,
        clientName: data.clientName || null,
        projectName: data.projectName || null,
        medium: data.medium || null,
        externalUrl: data.externalUrl || null,
        toolsUsed: data.toolsUsed ? JSON.parse(data.toolsUsed) : [],
      }
    } catch (e: any) {
      throw e
    }
  }
)

// Artwork data and error state
const mockArtwork = ref<any>(artworkData.value)
const loading = ref(status.value === 'pending')
const error = ref<string | null>(fetchError.value?.message || null)
const errorType = ref<'not_found' | 'private' | 'followers_only' | 'generic' | null>(null)

// Handle fetch errors
if (fetchError.value) {
  const statusCode = (fetchError.value as any)?.statusCode || (fetchError.value as any)?.response?.status
  const message = (fetchError.value as any)?.data?.message || fetchError.value.message || ''

  if (statusCode === 404) {
    errorType.value = 'not_found'
  } else if (statusCode === 403) {
    if (message.toLowerCase().includes('private')) {
      errorType.value = 'private'
    } else if (message.toLowerCase().includes('followers')) {
      errorType.value = 'followers_only'
    } else {
      errorType.value = 'private'
    }
  } else {
    errorType.value = 'generic'
    error.value = message || t('common.error')
  }
}

// Age verification state
const ageVerifiedThisSession = ref(false)

// Check if content is R-18 or R-18G
const isAdultContent = computed(() => {
  const rating = mockArtwork.value?.ageRating
  return rating === 'R18' || rating === 'R18G'
})

// Check if age verification is required
const requiresAgeVerification = computed(() => {
  // Not adult content - no verification needed
  if (!isAdultContent.value) return false

  // Already verified in this session
  if (ageVerifiedThisSession.value) return false

  // Can view adult content (logged in adult or cookie verified)
  if (canViewAdultContent.value) return false

  return true
})

// Age verification handlers
const onAgeConfirm = () => {
  confirmAgeVerification()
  ageVerifiedThisSession.value = true
}

const onAgeCancel = () => {
  router.back()
}

// Signed URLs for images
const currentImageSignedUrl = ref<string>('')
const currentThumbnailSignedUrl = ref<string>('') // For initial display before standard loads
const thumbnailSignedUrls = ref<Map<string, string>>(new Map())
const fullSizeSignedUrls = ref<Map<string, string>>(new Map())
const isLoadingMainImage = ref(true)

const artworkUrl = computed(() => {
  if (!mockArtwork.value) return ''
  const baseUrl = runtimeConfig.public.siteUrl || (import.meta.client ? window.location.origin : '')
  return `${baseUrl}/artworks/${mockArtwork.value.id}`
})

// Images with signed URLs for ImageViewer
const imagesWithSignedUrls = computed(() => {
  if (!mockArtwork.value?.images) return []

  return mockArtwork.value.images.map((image: any) => ({
    ...image,
    url: fullSizeSignedUrls.value.get(image.id) || image.url,
    thumbnailUrl: thumbnailSignedUrls.value.get(image.id) || image.thumbnailUrl,
  }))
})

// Set OG meta tags immediately (SSR-compatible)
if (mockArtwork.value) {
  const ogImage = mockArtwork.value.ogCardUrl || mockArtwork.value.images[0]?.url
  const description = t('artwork.ogDescription', { username: mockArtwork.value.author.displayName })
  const ogLocale = locale.value === 'ja' ? 'ja_JP' : 'en_US'

  useSeoMeta({
    title: mockArtwork.value.title,
    description: description,
    ogTitle: mockArtwork.value.title,
    ogDescription: description,
    ogImage: ogImage,
    ogUrl: artworkUrl.value,
    ogType: 'website',
    ogLocale: ogLocale,
    twitterCard: 'summary_large_image',
    twitterTitle: mockArtwork.value.title,
    twitterDescription: description,
    twitterImage: ogImage,
  })
}

const isAuthor = computed(() => {
  if (!user.value || !mockArtwork.value) return false
  if (mockArtwork.value.author.domain) return false
  return user.value.username === mockArtwork.value.author.username
})

// Open image viewer
const openViewer = (index: number) => {
  if (imageViewer.value) {
    imageViewer.value.open(index)
  }
}

// Fetch signed URLs for images
const { getSignedUrl } = useSignedImageUrlOnce()

const fetchSignedUrls = async () => {
  if (!mockArtwork.value?.images) return

  const currentImage = mockArtwork.value.images[currentImageIndex.value]

  // First, quickly fetch thumbnail for current image to avoid placeholder flash
  if (currentImage?.id) {
    try {
      currentThumbnailSignedUrl.value = await getSignedUrl(currentImage.id, true, false)
    } catch (e) {
      console.error('Failed to fetch thumbnail signed URL:', e)
    }
  }

  // Then fetch standard version for current main image
  if (currentImage?.id) {
    try {
      currentImageSignedUrl.value = await getSignedUrl(currentImage.id, false, false)
      isLoadingMainImage.value = false
    } catch (e) {
      console.error('Failed to fetch signed URL for main image:', e)
      isLoadingMainImage.value = false
    }
  }

  // Fetch signed URLs for all images (thumbnails and original)
  for (const image of mockArtwork.value.images) {
    if (image.id) {
      try {
        // Thumbnail (320px JPEG)
        const thumbnailUrl = await getSignedUrl(image.id, true, false)
        thumbnailSignedUrls.value.set(image.id, thumbnailUrl)

        // Original (for image viewer - full resolution, original format)
        const originalUrl = await getSignedUrl(image.id, false, true)
        fullSizeSignedUrls.value.set(image.id, originalUrl)
      } catch (e) {
        console.error(`Failed to fetch signed URLs for image ${image.id}:`, e)
      }
    }
  }
}

// Watch for current image changes and fetch new signed URL
watch(currentImageIndex, async (newIndex) => {
  const currentImage = mockArtwork.value?.images[newIndex]
  if (currentImage?.id) {
    isLoadingMainImage.value = true

    // First show thumbnail if available
    const cachedThumbnail = thumbnailSignedUrls.value.get(currentImage.id)
    if (cachedThumbnail) {
      currentThumbnailSignedUrl.value = cachedThumbnail
    } else {
      try {
        currentThumbnailSignedUrl.value = await getSignedUrl(currentImage.id, true, false)
      } catch (e) {
        console.error('Failed to fetch thumbnail signed URL:', e)
      }
    }

    // Then fetch standard version for detail page display
    try {
      currentImageSignedUrl.value = await getSignedUrl(currentImage.id, false, false)
      isLoadingMainImage.value = false
    } catch (e) {
      console.error('Failed to fetch signed URL for main image:', e)
      isLoadingMainImage.value = false
    }
  }
})

// Refresh remote artwork data from origin server
const refreshRemoteArtwork = async () => {
  if (!mockArtwork.value?.author.domain) return // Only refresh remote artworks

  try {
    const refreshed = await api.post<any>(`/api/artworks/${artworkId}/refresh`)
    if (refreshed) {
      // Update artwork data with refreshed values
      mockArtwork.value = {
        ...mockArtwork.value,
        title: refreshed.title,
        description: refreshed.description || '',
        disableRightClick: refreshed.disableRightClick ?? true,
        license: refreshed.license || null,
        customLicenseUrl: refreshed.customLicenseUrl || null,
        customLicenseText: refreshed.customLicenseText || null,
        ageRating: refreshed.ageRating,
        tags: refreshed.tags?.map((t: any) => t.name) || mockArtwork.value.tags,
        images: refreshed.images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl,
          width: img.width,
          height: img.height,
          degraded: img.degraded,
        })) || mockArtwork.value.images,
      }
    }
  } catch (e) {
    // Silent fail - continue with cached data
    console.warn('Failed to refresh remote artwork:', e)
  }
}

// Fetch signed URLs on client-side
const initializeClientData = async () => {
  if (!mockArtwork.value) return

  try {
    // For remote artworks, refresh data from origin server first
    await refreshRemoteArtwork()

    // Fetch signed URLs after artwork is loaded
    await fetchSignedUrls()
  } catch (e: any) {
    console.error('Failed to fetch signed URLs:', e)
  }
}

// Delete artwork
const handleDelete = async () => {
  if (!confirm(t('artwork.deleteConfirm'))) {
    return
  }

  try {
    const artworkId = route.params.id as string
    await api.delete(`/api/artworks/${artworkId}`)

    // Redirect to user's profile after successful deletion
    router.push(`/users/${user.value?.username}`)
  } catch (e: any) {
    console.error('Failed to delete artwork:', e)
    alert(e.message || t('artwork.deleteFailed'))
  }
}

// Social features state
const hasLiked = ref(false)
const hasBookmarked = ref(false)
const isFollowing = ref(false)
const isLoadingSocial = ref(false)

// Collection modal state
const isCollectionModalOpen = ref(false)

const onAddedToCollection = (collectionId: string, collectionTitle: string) => {
  console.log(`Added to collection: ${collectionTitle}`)
}

// Report modal state
const isReportModalOpen = ref(false)

const onReportSubmitted = () => {
  // Optionally show a toast or notification
  console.log('Report submitted')
}

// Check social status
const checkSocialStatus = async () => {
  if (!user.value || !mockArtwork.value) return

  try {
    const artworkId = route.params.id as string

    // Check like status
    const likeData = await api.get<{ hasLiked: boolean }>(`/api/likes/${artworkId}/check`)
    hasLiked.value = likeData.hasLiked

    // Check bookmark status
    const bookmarkData = await api.get<{ hasBookmarked: boolean }>(`/api/bookmarks/${artworkId}/check`)
    hasBookmarked.value = bookmarkData.hasBookmarked

    // Check follow status
    const authorHandle = getAuthorHandle()
    const followData = await api.get<{ isFollowing: boolean }>(`/api/follows/${authorHandle}/check`)
    isFollowing.value = followData.isFollowing
  } catch (e: any) {
    console.error('Failed to check social status:', e)
  }
}

// Toggle like
const toggleLike = async () => {
  if (!user.value || isLoadingSocial.value) return

  try {
    isLoadingSocial.value = true
    const artworkId = route.params.id as string
    const previousLiked = hasLiked.value

    // Use toggle endpoint - server determines the actual state
    const result = await api.post<{ liked: boolean }>(`/api/likes/${artworkId}/toggle`)

    // Update state based on server response
    hasLiked.value = result.liked
    if (mockArtwork.value) {
      // Adjust count based on actual state change
      if (result.liked && !previousLiked) {
        mockArtwork.value.likeCount++
      } else if (!result.liked && previousLiked) {
        mockArtwork.value.likeCount--
      }
    }
  } catch (e: any) {
    console.error('Failed to toggle like:', e)
    alert(e.message || t('artwork.likeFailed'))
  } finally {
    isLoadingSocial.value = false
  }
}

// Toggle bookmark
const toggleBookmark = async () => {
  if (!user.value || isLoadingSocial.value) return

  try {
    isLoadingSocial.value = true
    const artworkId = route.params.id as string
    const previousBookmarked = hasBookmarked.value

    // Use toggle endpoint - server determines the actual state
    const result = await api.post<{ bookmarked: boolean }>(`/api/bookmarks/${artworkId}/toggle`)

    // Update state based on server response
    hasBookmarked.value = result.bookmarked
    if (mockArtwork.value) {
      // Adjust count based on actual state change
      if (result.bookmarked && !previousBookmarked) {
        mockArtwork.value.bookmarkCount++
      } else if (!result.bookmarked && previousBookmarked) {
        mockArtwork.value.bookmarkCount--
      }
    }
  } catch (e: any) {
    console.error('Failed to toggle bookmark:', e)
    alert(e.message || t('artwork.bookmarkFailed'))
  } finally {
    isLoadingSocial.value = false
  }
}

// Get author handle for API calls (username or username@domain for remote)
const getAuthorHandle = (): string => {
  if (!mockArtwork.value) return ''
  const { username, domain } = mockArtwork.value.author
  if (domain) {
    return `${username}@${domain}`
  }
  return username
}

// Toggle follow
const toggleFollow = async () => {
  if (!user.value || !mockArtwork.value || isLoadingSocial.value) return

  try {
    isLoadingSocial.value = true
    const handle = getAuthorHandle()

    // Use toggle endpoint - server determines the actual state
    const result = await api.post<{ following: boolean }>(`/api/follows/${handle}/toggle`)

    // Update state based on server response
    isFollowing.value = result.following
  } catch (e: any) {
    console.error('Failed to toggle follow:', e)
    alert(e.message || t('user.followFailed'))
  } finally {
    isLoadingSocial.value = false
  }
}

// Fetch on mount
onMounted(async () => {
  // Initialize client-side data (signed URLs)
  await initializeClientData()

  // Check social status if user is authenticated
  if (user.value) {
    await checkSocialStatus()
  }
})

// Watch for auth changes
watch(() => user.value, async (newUser) => {
  if (newUser && mockArtwork.value) {
    await checkSocialStatus()
  }
})

const formatCount = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const getAgeRatingLabel = (rating: string): string => {
  const labels: Record<string, string> = {
    ALL_AGES: t('upload.allAges'),
    R18: t('upload.r18'),
    R18G: t('upload.r18g'),
  }
  return labels[rating] || rating
}

const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    ILLUSTRATION: t('upload.typeIllustration'),
    MANGA: t('upload.typeManga'),
  }
  return labels[type] || type
}

const getLicenseLabel = (license: string | null): string => {
  if (!license) return ''

  const labels: Record<string, string> = {
    'All Rights Reserved': t('upload.licenseAllRights'),
    'Fan Art': t('upload.licenseFanArt'),
    'CC0': t('upload.licenseCC0'),
    'CC BY 4.0': t('upload.licenseCCBY'),
    'CC BY-SA 4.0': t('upload.licenseCCBYSA'),
    'CC BY-NC 4.0': t('upload.licenseCCBYNC'),
    'CC BY-NC-ND 4.0': t('upload.licenseCCBYNCND'),
    'CC BY-ND 4.0': t('upload.licenseCCBYND'),
    'CC BY-NC-SA 4.0': t('upload.licenseCCBYNCSA'),
    'Custom': t('upload.licenseCustom'),
  }
  return labels[license] || license
}

// Check if any creation metadata exists
const hasCreationMetadata = computed(() => {
  if (!mockArtwork.value) return false
  return (
    mockArtwork.value.creationDate ||
    (mockArtwork.value.creationPeriodValue && mockArtwork.value.creationPeriodUnit) ||
    mockArtwork.value.medium ||
    (mockArtwork.value.toolsUsed && mockArtwork.value.toolsUsed.length > 0) ||
    mockArtwork.value.projectName ||
    mockArtwork.value.isCommission ||
    mockArtwork.value.externalUrl
  )
})

// Format creation period
const formatCreationPeriod = (value: number, unit: string): string => {
  const unitLabels: Record<string, string> = {
    'HOURS': t('artwork.periodHours', { count: value }),
    'DAYS': t('artwork.periodDays', { count: value }),
    'WEEKS': t('artwork.periodWeeks', { count: value }),
    'MONTHS': t('artwork.periodMonths', { count: value }),
  }
  return unitLabels[unit] || `${value} ${unit.toLowerCase()}`
}

// Get medium label
const getMediumLabel = (medium: string): string => {
  const labels: Record<string, string> = {
    'DIGITAL': t('upload.mediumDigital'),
    'TRADITIONAL': t('upload.mediumTraditional'),
    'THREE_D': t('upload.medium3D'),
    'MIXED': t('upload.mediumMixed'),
  }
  return labels[medium] || medium
}

// Right-click and drag prevention
const handleContextMenu = (e: MouseEvent) => {
  if (mockArtwork.value?.disableRightClick) {
    e.preventDefault()
  }
}

const handleDragStart = (e: DragEvent) => {
  if (mockArtwork.value?.disableRightClick) {
    e.preventDefault()
  }
}

// Visibility badge styling
const visibilityBadgeClass = computed(() => {
  switch (mockArtwork.value?.visibility) {
    case 'PRIVATE':
      return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
    case 'FOLLOWERS_ONLY':
      return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
    case 'UNLISTED':
      return 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]'
    default:
      return 'bg-[var(--color-scrim)] text-white'
  }
})

// Visibility icon (Mastodon style)
const visibilityIcon = computed(() => {
  switch (mockArtwork.value?.visibility) {
    case 'PRIVATE':
      return 'AtSymbol' // Mentioned users only (like DM)
    case 'FOLLOWERS_ONLY':
      return 'LockClosed' // Followers only
    case 'UNLISTED':
      return 'Moon' // Quiet public (not in feeds)
    default:
      return 'GlobeAlt' // Public
  }
})
</script>
