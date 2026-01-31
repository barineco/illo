<template>
  <div class="relative">
    <!-- Loading state -->
    <div
      v-if="isLoading || isImageLoading"
      class="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-secondary)]"
      :class="loadingClass"
    >
      <div class="w-8 h-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
    </div>

    <!-- Error state -->
    <div
      v-if="hasError && !isLoading"
      class="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-secondary)]"
      :class="errorClass"
    >
      <Icon name="PhotoIcon" class="w-12 h-12 text-[var(--color-text-muted)] opacity-50" />
    </div>

    <!-- Image -->
    <img
      v-if="imageUrl"
      :src="imageUrl"
      :alt="alt"
      :class="[imageClass, { 'opacity-0': isImageLoading || hasError }]"
      :loading="loading"
      :decoding="decoding"
      v-bind="$attrs"
      @load="onImageLoad"
      @error="onImageError"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * ArtworkImage Component
 *
 * Displays artwork images with signed URL support.
 * When signed URLs are enabled on the backend, automatically fetches
 * and refreshes time-limited access tokens.
 *
 * Usage:
 *   <ArtworkImage
 *     :image-id="image.id"
 *     :thumbnail="true"
 *     alt="Artwork title"
 *     class="w-full h-full object-cover"
 *   />
 *
 * Or with direct URL (for non-signed URL environments):
 *   <ArtworkImage
 *     :src="image.thumbnailUrl"
 *     alt="Artwork title"
 *     class="w-full h-full object-cover"
 *   />
 */

interface Props {
  // Image ID for signed URL fetching
  imageId?: string
  // Direct image URL (used when signed URLs are disabled)
  src?: string
  // Use thumbnail version
  thumbnail?: boolean
  // Alt text for accessibility
  alt?: string
  // Native loading attribute
  loading?: 'lazy' | 'eager'
  // Native decoding attribute
  decoding?: 'sync' | 'async' | 'auto'
  // Custom class for loading state
  loadingClass?: string
  // Custom class for error state
  errorClass?: string
  // Custom class for image element
  imageClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  thumbnail: false,
  loading: 'lazy',
  decoding: 'async',
  loadingClass: '',
  errorClass: '',
  imageClass: '',
})

const isImageLoading = ref(true)
const hasError = ref(false)

// Use signed URL if imageId is provided, otherwise use direct src
const resolvedImageId = computed(() => props.imageId || '')

const {
  signedUrl,
  isLoading,
  error,
  refresh,
} = useSignedImageUrl(resolvedImageId, props.thumbnail)

// Final image URL: prefer signed URL, fall back to direct src
const imageUrl = computed(() => {
  if (props.imageId && signedUrl.value) {
    return signedUrl.value
  }
  return props.src || ''
})

// Watch for src changes to reset loading state
watch(() => imageUrl.value, () => {
  if (imageUrl.value) {
    isImageLoading.value = true
    hasError.value = false
  }
})

function onImageLoad() {
  isImageLoading.value = false
  hasError.value = false
}

function onImageError() {
  isImageLoading.value = false
  hasError.value = true
  // Try refreshing the signed URL once on error (might be expired)
  if (props.imageId && !error.value) {
    refresh()
  }
}

// Expose refresh method for parent components
defineExpose({
  refresh,
})
</script>
