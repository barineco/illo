<template>
  <div class="link-card-uploader">
    <!-- No Image Available -->
    <div v-if="!hasImage" class="no-image-area">
      <div class="no-image-prompt">
        <Icon name="Photo" class="prompt-icon" />
        <p class="prompt-text">{{ $t('linkCard.noImageYet') }}</p>
        <p class="prompt-hint">{{ $t('linkCard.uploadFirstImage') }}</p>
      </div>
    </div>

    <!-- Preview with Crop Button -->
    <div v-else class="preview-container">
      <div class="preview-image-wrapper">
        <img
          :src="displayPreviewUrl"
          alt="Link Card Preview"
          class="preview-image"
          :class="{ 'preview-blurred': shouldShowBlurPreview }"
        />
        <button
          type="button"
          class="crop-button"
          @click="openCropper"
          :title="$t('linkCard.setCropArea')"
        >
          <Icon name="ArrowUpTray" class="h-5 w-5" />
          {{ $t('linkCard.setCropArea') }}
        </button>
      </div>

      <!-- Crop Status -->
      <div class="crop-status">
        <span v-if="cropCoordinates" class="status-badge status-set">
          {{ $t('linkCard.cropSet') }}
        </span>
        <span v-else class="status-badge status-default">
          {{ $t('linkCard.cropDefault') }}
        </span>
        <button
          v-if="cropCoordinates"
          type="button"
          class="reset-button"
          @click="resetCrop"
        >
          {{ $t('linkCard.resetCrop') }}
        </button>
      </div>

      <!-- Blur Toggle -->
      <div class="blur-toggle">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="blur"
            :disabled="blurRequired"
            @change="updateBlur"
          />
          <span>{{ $t('linkCard.blurOption') }}</span>
          <span v-if="blurRequired" class="required-badge">{{ $t('linkCard.blurRequired') }}</span>
        </label>
      </div>
    </div>

    <!-- Link Card Cropper Modal -->
    <CropperModal
      :is-open="showCropper"
      :image-source="imageSource"
      :aspect-ratio="16/9"
      stencil-type="rectangle"
      :initial-crop="cropCoordinates"
      :original-width="originalWidth"
      :original-height="originalHeight"
      :title="$t('cropper.linkCardCrop')"
      @close="closeCropper"
      @confirm="onCropConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { CropCoordinates } from '~/components/CropperModal.vue'

interface Props {
  /** First image from artwork (File for new upload, URL string for existing) */
  imageSource?: File | string | null
  /** Whether to blur the link card image */
  blur?: boolean
  /** Age rating of the artwork */
  ageRating?: string
  /** Current crop coordinates (null = use default center crop) */
  cropCoordinates?: CropCoordinates | null
  /** Original image width (required for coordinate transformation) */
  originalWidth?: number
  /** Original image height (required for coordinate transformation) */
  originalHeight?: number
}

const props = withDefaults(defineProps<Props>(), {
  imageSource: null,
  blur: false,
  ageRating: 'ALL_AGES',
  cropCoordinates: null,
  originalWidth: undefined,
  originalHeight: undefined,
})

const emit = defineEmits<{
  (e: 'update:blur', blur: boolean): void
  (e: 'update:cropCoordinates', coordinates: CropCoordinates | null): void
}>()

const showCropper = ref(false)
const previewUrl = ref<string | null>(null)
const croppedPreviewUrl = ref<string | null>(null)

// Check if we have an image to work with
const hasImage = computed(() => {
  return props.imageSource !== null && props.imageSource !== undefined
})

// Display URL: use cropped preview if available, otherwise use original
const displayPreviewUrl = computed((): string | undefined => {
  return croppedPreviewUrl.value || previewUrl.value || undefined
})

// Blur is required for R18/R18G content
const blurRequired = computed(() => {
  return props.ageRating === 'R18' || props.ageRating === 'R18G'
})

// Show blur preview
const shouldShowBlurPreview = computed(() => {
  return props.blur
})

// Generate preview URL from imageSource
watch(
  () => props.imageSource,
  async (source) => {
    if (!source) {
      previewUrl.value = null
      croppedPreviewUrl.value = null
      return
    }

    if (source instanceof File) {
      // Convert File to data URL
      const reader = new FileReader()
      reader.onload = (e) => {
        previewUrl.value = e.target?.result as string
      }
      reader.readAsDataURL(source)
    } else if (typeof source === 'string') {
      // URL string - use directly
      previewUrl.value = source
    }
  },
  { immediate: true },
)

// Generate cropped preview when crop coordinates change
watch(
  [() => props.cropCoordinates, () => props.originalWidth, () => props.originalHeight, previewUrl],
  async ([coords, origW, origH, srcUrl]) => {
    // Clear previous cropped preview
    if (croppedPreviewUrl.value) {
      URL.revokeObjectURL(croppedPreviewUrl.value)
      croppedPreviewUrl.value = null
    }

    // If no coordinates or no source, don't generate cropped preview
    if (!coords || !srcUrl || !origW || !origH) {
      return
    }

    try {
      const croppedUrl = await generateCroppedPreview(srcUrl, coords, origW, origH)
      croppedPreviewUrl.value = croppedUrl
    } catch (e) {
      console.error('Failed to generate cropped preview:', e)
    }
  },
  { immediate: true },
)

/**
 * Generate a cropped preview image using Canvas
 * @param sourceUrl - Source image URL or data URL
 * @param coords - Crop coordinates (in original image pixels)
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 */
async function generateCroppedPreview(
  sourceUrl: string,
  coords: CropCoordinates,
  originalWidth: number,
  originalHeight: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // Calculate scale factor between displayed image and original
      const scaleX = img.naturalWidth / originalWidth
      const scaleY = img.naturalHeight / originalHeight

      // Convert original coordinates to displayed image coordinates
      const cropX = coords.x * scaleX
      const cropY = coords.y * scaleY
      const cropW = coords.width * scaleX
      const cropH = coords.height * scaleY

      // Create canvas for cropped image (16:9 aspect ratio preview)
      const canvas = document.createElement('canvas')
      const previewWidth = 640
      const previewHeight = 360
      canvas.width = previewWidth
      canvas.height = previewHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // Draw cropped region to canvas
      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH, // Source rectangle
        0, 0, previewWidth, previewHeight, // Destination rectangle
      )

      // Convert to blob URL
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob))
          } else {
            reject(new Error('Failed to create blob'))
          }
        },
        'image/jpeg',
        0.85,
      )
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = sourceUrl
  })
}

// Open cropper modal
const openCropper = () => {
  showCropper.value = true
}

// Close cropper modal
const closeCropper = () => {
  showCropper.value = false
}

// Handle crop confirmation
const onCropConfirm = (coordinates: CropCoordinates) => {
  showCropper.value = false
  emit('update:cropCoordinates', coordinates)
}

// Reset crop to default
const resetCrop = () => {
  emit('update:cropCoordinates', null)
}

// Update blur setting
const updateBlur = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:blur', target.checked)
}

// Watch for age rating changes - auto-enable blur for R18/R18G
watch(() => props.ageRating, (newRating) => {
  if ((newRating === 'R18' || newRating === 'R18G') && hasImage.value) {
    emit('update:blur', true)
  }
})

// Cleanup blob URLs on unmount
onUnmounted(() => {
  if (croppedPreviewUrl.value) {
    URL.revokeObjectURL(croppedPreviewUrl.value)
  }
})
</script>

<style scoped>
.link-card-uploader {
  width: 100%;
}

.no-image-area {
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  background: var(--color-bg-secondary);
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-image-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.prompt-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.prompt-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text);
}

.prompt-hint {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.preview-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-image-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: var(--color-bg-secondary);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: filter 0.3s ease;
}

.preview-image.preview-blurred {
  filter: blur(20px);
}

.crop-button {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
}

.crop-button:hover {
  background: rgba(0, 0, 0, 0.85);
}

.crop-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-set {
  background: var(--color-success-bg, #dcfce7);
  color: var(--color-success-text, #166534);
}

.status-default {
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
}

.reset-button {
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.reset-button:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.blur-toggle {
  padding: 1rem;
  background: var(--color-bg-secondary);
  border-radius: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"]:disabled {
  cursor: not-allowed;
}

.required-badge {
  margin-left: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-warning);
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}
</style>
