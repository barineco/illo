<template>
  <!-- Deleted artwork placeholder -->
  <div
    v-if="artwork.isDeleted"
    class="block relative overflow-hidden rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)]"
  >
    <div class="aspect-[3/4] flex flex-col items-center justify-center text-[var(--color-text-muted)] p-4">
      <Icon name="TrashIcon" class="w-12 h-12 mb-2 opacity-50" />
      <span class="text-sm text-center">{{ $t('artwork.deleted') }}</span>
    </div>
  </div>

  <!-- Normal artwork card -->
  <div
    v-else
    class="group block relative overflow-hidden rounded-lg bg-[var(--color-surface)] hover:ring-2 ring-[var(--color-primary)] transition-all duration-200 hover:scale-[1.02]"
  >
    <!-- Image - clickable to artwork -->
    <NuxtLink :to="`/artworks/${artwork.id}`" class="block">
      <div
        ref="imageContainer"
        class="aspect-[3/4] overflow-hidden bg-[var(--color-surface-secondary)] relative"
        @mousemove="handleMouseMove"
        @mouseleave="resetHoverImage"
      >
        <!-- Loading spinner -->
        <div
          v-if="isImageLoading"
          class="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-secondary)]"
        >
          <div class="w-8 h-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
        </div>
        <img
          :src="currentImageUrl"
          :alt="artwork.title"
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          :class="{ 'opacity-0': isImageLoading }"
          loading="lazy"
          decoding="async"
          @load="onImageLoad"
          @error="onImageError"
        />

        <!-- Visibility badge - always shown, icon only with tooltip -->
        <div
          v-if="artwork.visibility"
          class="absolute top-2 left-2 p-1.5 rounded-full"
          :class="visibilityBadgeClass"
          :title="$t(`artwork.visibility.${artwork.visibility.toLowerCase()}`)"
        >
          <Icon :name="visibilityIcon" class="w-4 h-4" />
        </div>

        <!-- Age rating badge (only for non-ALL_AGES) -->
        <div
          v-if="artwork.ageRating && artwork.ageRating !== 'ALL_AGES'"
          class="absolute top-10 left-2 px-1.5 py-0.5 rounded text-xs font-bold shadow-md"
          :class="ageRatingBadgeClass"
          :title="$t(`artwork.rating.${artwork.ageRating.toLowerCase()}`)"
        >
          {{ ageRatingLabel }}
        </div>

        <!-- Blurred overlay for filtered content -->
        <div
          v-if="shouldShowBlur && !isBlurRemoved"
          class="absolute inset-0 backdrop-blur-2xl bg-black/50 flex items-center justify-center cursor-pointer z-10"
          @click.prevent.stop="removeBlur"
        >
          <div class="text-white text-center px-4">
            <Icon name="EyeSlashIcon" class="w-8 h-8 mx-auto mb-2" />
            <span class="text-sm">{{ $t(`artwork.rating.${artwork.ageRating?.toLowerCase() || 'nsfw'}`) }}</span>
            <p class="text-xs text-white/70 mt-1">{{ $t('common.showMore') }}</p>
          </div>
        </div>

        <!-- Image count badge -->
        <div
          v-if="imageCount > 1"
          class="absolute top-2 right-2 bg-[var(--color-scrim)] text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1"
        >
          <Icon name="Photo" class="w-3 h-3" />
          {{ imageCount }}
        </div>

        <!-- Hover zone indicator (visible on hover when multiple images) -->
        <div
          v-if="previewImages.length > 1 && isHovering"
          class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1"
        >
          <div
            v-for="(_, index) in previewImages"
            :key="index"
            class="w-2 h-2 rounded-full transition-colors"
            :class="currentHoverIndex === index ? 'bg-white' : 'bg-white/40'"
          />
        </div>
      </div>

      <!-- Overlay on hover - simple semi-transparent black cover -->
      <div
        class="absolute inset-0 bg-[var(--color-scrim-light)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style="bottom: 72px"
      ></div>
    </NuxtLink>

    <!-- Action menu button (bottom right) -->
    <div v-if="isAuthenticated" class="absolute bottom-[72px] right-2 z-10">
      <button
        @click.stop.prevent="toggleMenu"
        class="p-1.5 bg-[var(--color-overlay-light)] hover:bg-[var(--color-scrim)] rounded transition-opacity"
        :class="isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
        :title="$t('common.menu')"
      >
        <Icon name="EllipsisVertical" class="w-5 h-5 text-white" />
      </button>

      <!-- Dropdown menu -->
      <div
        v-if="isMenuOpen"
        class="absolute bottom-full right-0 mb-1 bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-border)] overflow-hidden min-w-[140px]"
      >
        <button
          @click.stop.prevent="toggleLike"
          class="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-2"
          :class="{ 'text-[var(--color-toggle-like-text)]': isLiked }"
        >
          <Icon :name="isLiked ? 'Heart' : 'Heart'" :solid="isLiked" class="w-4 h-4" />
          {{ isLiked ? $t('artwork.liked') : $t('artwork.like') }}
        </button>
        <button
          @click.stop.prevent="toggleBookmark"
          class="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-2"
          :class="{ 'text-[var(--color-toggle-bookmark-text)]': isBookmarked }"
        >
          <Icon :name="isBookmarked ? 'Bookmark' : 'Bookmark'" :solid="isBookmarked" class="w-4 h-4" />
          {{ isBookmarked ? $t('artwork.bookmarked') : $t('artwork.bookmark') }}
        </button>
        <button
          @click.stop.prevent="openCollectionModal"
          class="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-2"
        >
          <Icon name="FolderOpen" class="w-4 h-4" />
          {{ $t('user.collections') }}
        </button>
      </div>
    </div>

    <!-- Collection Modal (lazy loaded) -->
    <AddToCollectionModal
      v-if="isCollectionModalOpen"
      :is-open="isCollectionModalOpen"
      :artwork-id="artwork.id"
      @close="isCollectionModalOpen = false"
      @added="onAddedToCollection"
    />

    <!-- Info Below Image -->
    <div class="p-3">
      <!-- Title - clickable to artwork -->
      <NuxtLink :to="`/artworks/${artwork.id}`">
        <h3 class="text-sm font-medium mb-1 line-clamp-1 hover:text-[var(--color-primary)] transition-colors">
          {{ artwork.title }}
        </h3>
      </NuxtLink>

      <!-- Author info - clickable to user page -->
      <NuxtLink
        :to="getUserPathFromUser(artwork.author)"
        class="flex items-center gap-2 hover:text-[var(--color-primary)] transition-colors w-fit max-w-full"
      >
        <div class="w-6 h-6 rounded-full bg-[var(--color-surface-secondary)] flex-shrink-0 flex items-center justify-center overflow-hidden">
          <img
            v-if="artwork.author.avatarUrl"
            :src="artwork.author.avatarUrl"
            :alt="artwork.author.username"
            class="w-full h-full rounded-full object-cover"
          />
          <Icon v-else name="UserCircle" class="w-4 h-4" />
        </div>
        <div class="flex items-center gap-1.5 min-w-0">
          <div class="flex flex-col min-w-0">
            <span class="text-xs text-[var(--color-text-muted)] truncate">
              {{ artwork.author.displayName || artwork.author.username }}
            </span>
            <span v-if="artwork.author.domain" class="text-[10px] text-[var(--color-text-muted)] truncate">
              {{ artwork.author.domain }}
            </span>
          </div>
          <SupporterBadge :tier="artwork.author.supporterTier" size="sm" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArtworkCardData } from '~/composables/useArtworkTransform'

const { getUserPathFromUser } = useUsername()
const { isAuthenticated, user } = useAuth()
const api = useApi()
const { getSignedUrl } = useSignedImageUrlOnce()

// Image type used in artwork cards
type ArtworkImage = { id: string; thumbnailUrl?: string; url?: string }

// Extended type that includes isDeleted for deleted artwork placeholders
type ArtworkCardInput = ArtworkCardData & {
  isDeleted?: boolean
}

interface ArtworkCardProps {
  artwork: ArtworkCardInput
}

const props = defineProps<ArtworkCardProps>()

// Visibility badge styling (icon-only circular badge with shadow)
const visibilityBadgeClass = computed(() => {
  const base = 'shadow-md'
  switch (props.artwork.visibility) {
    case 'PRIVATE':
      return `${base} bg-gray-700/90 text-gray-200`
    case 'FOLLOWERS_ONLY':
      return `${base} bg-amber-500/90 text-white`
    case 'UNLISTED':
      return `${base} bg-sky-500/90 text-white`
    default:
      return `${base} bg-green-500/90 text-white`
  }
})

// Visibility icon (Mastodon style)
const visibilityIcon = computed(() => {
  switch (props.artwork.visibility) {
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

// Age rating badge styling
const ageRatingBadgeClass = computed(() => {
  switch (props.artwork.ageRating) {
    case 'NSFW':
      return 'bg-orange-500/90 text-white'
    case 'R18':
      return 'bg-red-600/90 text-white'
    case 'R18G':
      return 'bg-red-900/90 text-white'
    default:
      return 'bg-green-500/90 text-white'
  }
})

// Age rating label
const ageRatingLabel = computed(() => {
  switch (props.artwork.ageRating) {
    case 'NSFW':
      return 'NSFW'
    case 'R18':
      return 'R-18'
    case 'R18G':
      return 'R-18G'
    default:
      return ''
  }
})

// Determine if blur should be shown
// - If artwork.blurred is explicitly true (from backend content filter), show blur
// - If user is not authenticated or not age verified, show blur for NSFW+ content
const shouldShowBlur = computed(() => {
  // If artwork explicitly marked as blurred by backend, respect that
  if (props.artwork.blurred) return true

  // For NSFW+ content, check if user can view it
  const rating = props.artwork.ageRating
  if (!rating || rating === 'ALL_AGES') return false

  // If user is not authenticated, blur NSFW+ content
  if (!isAuthenticated.value) return true

  // If user is authenticated but not verified as adult, blur NSFW+ content
  // Note: user.value?.isAdult comes from the user object if available
  const isAdult = user.value?.isAdult ?? false
  if (!isAdult && (rating === 'R18' || rating === 'R18G')) {
    return true
  }

  // For NSFW, blur if user hasn't explicitly allowed it
  // (This is a conservative default - backend should send blurred=true if needed)
  return false
})

// Blur removal state (per card, temporary)
const isBlurRemoved = ref(false)
const removeBlur = () => {
  isBlurRemoved.value = true
}

// Image preview state
const imageContainer = ref<HTMLElement | null>(null)
const currentHoverIndex = ref(0)
const isHovering = ref(false)
const isImageLoading = ref(true)

// Signed URL cache for images
const signedUrlCache = ref<Map<string, string>>(new Map())

// Image loading handlers
const onImageLoad = () => {
  isImageLoading.value = false
}

const onImageError = () => {
  isImageLoading.value = false
}

// Get preview images (up to 4)
const previewImages = computed(() => {
  if (!props.artwork.images || props.artwork.images.length === 0) {
    return [{ thumbnailUrl: props.artwork.thumbnailUrl }]
  }
  return props.artwork.images
})

// Get total image count
const imageCount = computed(() => {
  return props.artwork.imageCount || props.artwork.images?.length || 1
})

// Get signed URL for an image, using cache
const getImageUrl = async (imageId: string | undefined, fallbackUrl: string): Promise<string> => {
  if (!imageId) return fallbackUrl

  // Check cache first
  const cached = signedUrlCache.value.get(imageId)
  if (cached) return cached

  try {
    const signedUrl = await getSignedUrl(imageId, true) // true for thumbnail
    signedUrlCache.value.set(imageId, signedUrl)
    return signedUrl
  } catch {
    return fallbackUrl
  }
}

// Current image URL based on hover position (async)
const displayImageUrl = ref(props.artwork.thumbnailUrl)

// Get the first image ID
const firstImageId = computed(() => {
  if (props.artwork.images && props.artwork.images.length > 0) {
    return props.artwork.images[0].id
  }
  return undefined
})

// Update display URL when hover changes
watch([currentHoverIndex, isHovering], async ([index, hovering]) => {
  const images = previewImages.value
  if (images.length <= 1 || !hovering) {
    // Use signed URL for the first image
    if (firstImageId.value) {
      displayImageUrl.value = await getImageUrl(firstImageId.value, props.artwork.thumbnailUrl)
    }
    return
  }

  const img = images[index] as ArtworkImage | { thumbnailUrl: string }
  const imageId = 'id' in img ? img.id : undefined
  const fallbackUrl = ('thumbnailUrl' in img ? img.thumbnailUrl : props.artwork.thumbnailUrl) || ''
  displayImageUrl.value = await getImageUrl(imageId, fallbackUrl)
}, { immediate: false })

// Current image URL (computed for template)
const currentImageUrl = computed(() => displayImageUrl.value)

// Handle mouse move to switch images
const handleMouseMove = (event: MouseEvent) => {
  const images = previewImages.value
  if (images.length <= 1) return

  isHovering.value = true

  const container = imageContainer.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  const relativeY = event.clientY - rect.top
  const percentage = relativeY / rect.height

  // Divide image into zones based on number of preview images
  const zoneCount = images.length
  const zoneIndex = Math.min(Math.floor(percentage * zoneCount), zoneCount - 1)
  currentHoverIndex.value = Math.max(0, zoneIndex)
}

// Reset hover state
const resetHoverImage = () => {
  isHovering.value = false
  currentHoverIndex.value = 0
}

// Menu state
const isMenuOpen = ref(false)
const isLiked = ref(false)
const isBookmarked = ref(false)

// Collection modal state
const isCollectionModalOpen = ref(false)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
  // Fetch status when menu is opened for the first time
  if (isMenuOpen.value && !statusFetched.value) {
    fetchStatus()
  }
}

// Close menu when clicking outside
const closeMenu = () => {
  isMenuOpen.value = false
}

// Lazy fetch like/bookmark status only when menu is opened
const statusFetched = ref(false)
const fetchStatus = async () => {
  if (!isAuthenticated.value || statusFetched.value) return

  try {
    const [likeRes, bookmarkRes] = await Promise.all([
      api.get<{ hasLiked: boolean }>(`/api/likes/${props.artwork.id}/check`),
      api.get<{ hasBookmarked: boolean }>(`/api/bookmarks/${props.artwork.id}/check`),
    ])
    isLiked.value = likeRes.hasLiked
    isBookmarked.value = bookmarkRes.hasBookmarked
    statusFetched.value = true
  } catch (error) {
    // Silently fail - status will be false by default
  }
}

const toggleLike = async () => {
  try {
    // Use toggle endpoint - server determines the actual state
    const result = await api.post<{ liked: boolean }>(`/api/likes/${props.artwork.id}/toggle`)
    isLiked.value = result.liked
  } catch (error) {
    console.error('Failed to toggle like:', error)
  }
  closeMenu()
}

const toggleBookmark = async () => {
  try {
    // Use toggle endpoint - server determines the actual state
    const result = await api.post<{ bookmarked: boolean }>(`/api/bookmarks/${props.artwork.id}/toggle`)
    isBookmarked.value = result.bookmarked
  } catch (error) {
    console.error('Failed to toggle bookmark:', error)
  }
  closeMenu()
}

const openCollectionModal = () => {
  isCollectionModalOpen.value = true
  closeMenu()
}

const onAddedToCollection = (collectionId: string, collectionTitle: string) => {
  // Could show a toast notification here
  console.log(`Added to collection: ${collectionTitle}`)
}

// Close menu when clicking outside
onMounted(async () => {
  document.addEventListener('click', closeMenu)

  // Fetch signed URL for initial image on mount
  if (firstImageId.value) {
    displayImageUrl.value = await getImageUrl(firstImageId.value, props.artwork.thumbnailUrl)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>
