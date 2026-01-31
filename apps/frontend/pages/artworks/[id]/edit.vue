<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">{{ $t('artwork.editTitle') }}</h1>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div
        class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"
      ></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-[var(--color-danger-text)] mb-4">{{ error }}</p>
      <BaseButton
        variant="primary"
        size="md"
        shape="rounded"
        @click="fetchArtwork"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Edit Form -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Error Message -->
      <div
        v-if="submitError"
        class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-4"
      >
        <p class="text-[var(--color-danger-text)]">{{ submitError }}</p>
      </div>

      <!-- Image Management (First, same as upload.vue) -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <label class="block text-sm font-medium mb-2">{{ $t('upload.images') }}</label>
        <p class="text-sm text-[var(--color-text-muted)] mb-4">
          {{ $t('artwork.imageReorderHint') }}
        </p>

        <!-- Draggable Image Grid -->
        <draggable
          v-model="managedImages"
          item-key="tempId"
          class="grid grid-cols-2 md:grid-cols-4 gap-4"
          ghost-class="opacity-50"
          handle=".drag-handle"
        >
          <template #item="{ element, index }">
            <div
              class="relative aspect-square rounded-lg overflow-hidden bg-[var(--color-surface-secondary)] group"
            >
              <!-- Loading spinner for existing images -->
              <div
                v-if="!element.isNew && !imageLoadState[element.tempId]"
                class="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-secondary)]"
              >
                <div class="w-6 h-6 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
              </div>
              <img
                :src="getThumbnailUrl(element)"
                :alt="`画像 ${index + 1}`"
                class="w-full h-full object-cover"
                :class="{ 'opacity-0': !element.isNew && !imageLoadState[element.tempId] }"
                @load="onImageLoaded(element.tempId)"
                @error="onImageLoaded(element.tempId)"
              />
              <!-- Order Badge -->
              <div
                class="absolute top-2 left-2 bg-[var(--color-scrim)] text-white px-2 py-1 rounded text-xs drag-handle cursor-move"
              >
                {{ index + 1 }}
              </div>
              <!-- Delete Button -->
              <button
                type="button"
                @click="removeImage(element)"
                class="absolute top-2 right-2 bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover-bg)] text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XMarkIcon class="w-4 h-4" />
              </button>
              <!-- New Badge -->
              <div
                v-if="element.isNew"
                class="absolute bottom-2 left-2 bg-[var(--color-button-success)] text-white px-2 py-0.5 rounded text-xs"
              >
                {{ $t('artwork.newImage') }}
              </div>
            </div>
          </template>
        </draggable>

        <!-- Minimum Images Warning -->
        <div
          v-if="managedImages.length === 0"
          class="mt-4 p-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning-text)] rounded-lg"
        >
          <p class="text-[var(--color-warning-text)] text-sm">
            {{ $t('artwork.minImageRequired') }}
          </p>
        </div>

        <!-- Add New Images -->
        <div
          class="mt-4 border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
          @click="triggerFileInput"
          @dragover.prevent
          @drop.prevent="handleFileDrop"
        >
          <PlusIcon class="w-8 h-8 mx-auto mb-2 text-[var(--color-text-muted)]" />
          <p class="text-[var(--color-text-muted)]">{{ $t('artwork.addImages') }}</p>
          <p class="text-xs text-[var(--color-text-muted)] opacity-70 mt-1">{{ $t('artwork.imageLimit') }}</p>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          accept="image/*"
          class="hidden"
          @change="handleFileSelect"
        />
      </div>

      <!-- Form Fields Component (Second, same as upload.vue) -->
      <ArtworkFormFields
        v-model="form"
        v-model:tags-input="tagsInput"
      />

      <!-- Link Card (Third, same as upload.vue) -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <label class="block text-sm font-medium mb-2">
          {{ $t('linkCard.title') }}
          <span class="text-sm font-normal text-[var(--color-text-muted)]">（{{ $t('linkCard.optional') }}）</span>
        </label>
        <p class="text-sm text-[var(--color-text-muted)] mb-4">
          {{ $t('linkCard.description') }}
        </p>
        <LinkCardUploader
          :image-source="firstImage"
          v-model:blur="linkCardBlur"
          v-model:crop-coordinates="linkCardCropCoordinates"
          :age-rating="form.ageRating"
          :original-width="firstImageOriginalWidth"
          :original-height="firstImageOriginalHeight"
        />
      </div>

      <!-- Upload Progress -->
      <div
        v-if="isSubmitting"
        class="bg-[var(--color-surface)] rounded-lg p-6"
      >
        <div class="flex justify-between items-center mb-2">
          <span class="font-medium">{{ $t('upload.uploading') }}</span>
          <span class="font-semibold text-[var(--color-primary)]">{{ uploadProgress }}%</span>
        </div>
        <div class="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            class="h-full bg-[var(--color-primary)] rounded-full transition-all duration-200 ease-out"
            :style="{ width: `${uploadProgress}%` }"
          />
        </div>
        <p class="text-sm text-[var(--color-text-muted)] mt-2">
          {{ $t('upload.uploadingHint') }}
        </p>
      </div>

      <!-- Submit Buttons -->
      <div class="flex gap-4 justify-between">
        <BaseButton
          variant="danger"
          size="lg"
          shape="rounded"
          :disabled="isSubmitting"
          @click="handleDelete"
        >
          {{ $t('common.delete') }}
        </BaseButton>
        <div class="flex gap-4">
          <BaseButton
            variant="outline"
            size="lg"
            shape="rounded"
            @click="router.push(`/artworks/${artworkId}`)"
          >
            {{ $t('common.cancel') }}
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            size="lg"
            shape="rounded"
            :disabled="isSubmitting || managedImages.length === 0"
            :loading="isSubmitting"
          >
            {{ $t('common.save') }}
          </BaseButton>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { XMarkIcon, PlusIcon } from '@heroicons/vue/24/outline'
import draggable from 'vuedraggable'
import type { ArtworkFormData } from '~/components/artwork/ArtworkFormFields.vue'
import type { CropCoordinates } from '~/components/CropperModal.vue'

const { t } = useI18n()

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const { user } = useAuth()

const artworkId = computed(() => route.params.id as string)
const loading = ref(true)
const error = ref<string | null>(null)
const isSubmitting = ref(false)
const uploadProgress = ref(0)
const submitError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

interface ManagedImage {
  tempId: string
  id?: string
  url: string
  thumbnailUrl: string
  isNew: boolean
  file?: File
}

const form = ref<ArtworkFormData>({
  title: '',
  description: '',
  type: 'ILLUSTRATION',
  ageRating: 'ALL_AGES',
  visibility: 'PUBLIC',
  disableRightClick: true,
  license: '',
  customLicenseUrl: '',
  customLicenseText: '',
  // Creation metadata
  creationDate: '',
  creationPeriodValue: undefined,
  creationPeriodUnit: undefined,
  isCommission: false,
  clientName: '',
  projectName: '',
  medium: undefined,
  externalUrl: '',
  toolsUsed: [],
})

const tagsInput = ref('')
const managedImages = ref<ManagedImage[]>([])
const originalImageIds = ref<string[]>([])
const imageLoadState = ref<Record<string, boolean>>({})
const thumbnailSignedUrls = ref<Map<string, string>>(new Map())

// Link Card state
const linkCardCropCoordinates = ref<CropCoordinates | null>(null)
const linkCardBlur = ref(false)
const artwork = ref<any>(null)

// Original image URL for cropper (use standard 2048px version, not thumbnail)
const firstImageUrl = ref<string | null>(null)
const firstImageOriginalWidth = ref<number | undefined>(undefined)
const firstImageOriginalHeight = ref<number | undefined>(undefined)

// Get signed URL for cropper when first image changes
const { getSignedUrl } = useSignedImageUrlOnce()

watch(
  () => managedImages.value[0],
  async (first) => {
    if (!first) {
      firstImageUrl.value = null
      firstImageOriginalWidth.value = undefined
      firstImageOriginalHeight.value = undefined
      return
    }

    if (first.isNew && first.file) {
      // For new images, use File object directly
      firstImageUrl.value = null
      // Get dimensions from File
      const img = new Image()
      img.onload = () => {
        firstImageOriginalWidth.value = img.naturalWidth
        firstImageOriginalHeight.value = img.naturalHeight
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(first.file)
    } else if (first.id) {
      // For existing images, fetch standard (2048px) URL - NOT thumbnail
      try {
        const url = await getSignedUrl(first.id, false, false) // standard version
        firstImageUrl.value = url
        // Find original dimensions from artwork data
        const imgData = artwork.value?.images?.find((img: any) => img.id === first.id)
        if (imgData) {
          firstImageOriginalWidth.value = imgData.originalWidth || imgData.width
          firstImageOriginalHeight.value = imgData.originalHeight || imgData.height
        }
      } catch (e) {
        console.error('Failed to get signed URL for first image:', e)
        firstImageUrl.value = first.url
      }
    }
  },
  { immediate: true },
)

// First image for link card cropping (either File from new or URL from existing)
const firstImage = computed<File | string | null>(() => {
  const first = managedImages.value[0]
  if (!first) return null
  if (first.isNew && first.file) return first.file
  // For existing images, use the fetched signed URL (standard 2048px version)
  return firstImageUrl.value
})

// Track image load state
const onImageLoaded = (tempId: string) => {
  imageLoadState.value[tempId] = true
}

// Get thumbnail URL with signed URL fallback
const getThumbnailUrl = (image: ManagedImage): string => {
  // For new images, use the preview URL directly
  if (image.isNew) {
    return image.thumbnailUrl
  }
  // For existing images, use signed URL if available
  if (image.id && thumbnailSignedUrls.value.has(image.id)) {
    return thumbnailSignedUrls.value.get(image.id)!
  }
  // Fallback to original URL
  return image.thumbnailUrl || image.url
}

// Computed tags list
const tagsList = computed(() => {
  if (!tagsInput.value.trim()) return []
  return tagsInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
})

// Fetch signed URLs for thumbnails (uses getSignedUrl from above)
const fetchSignedUrls = async (images: any[]) => {
  for (const img of images) {
    if (img.id) {
      try {
        const thumbnailUrl = await getSignedUrl(img.id, true)
        thumbnailSignedUrls.value.set(img.id, thumbnailUrl)
      } catch (e) {
        console.error(`Failed to fetch signed URL for thumbnail ${img.id}:`, e)
      }
    }
  }
}

// Fetch artwork data
const fetchArtwork = async () => {
  try {
    loading.value = true
    error.value = null

    const data = await api.get<any>(`/api/artworks/${artworkId.value}`)

    // Store artwork data
    artwork.value = data

    // Check if user is the author
    if (!user.value || user.value.username !== data.author.username) {
      error.value = t('artwork.noEditPermission')
      return
    }

    // Populate form
    form.value = {
      title: data.title,
      description: data.description || '',
      type: data.type,
      ageRating: data.ageRating,
      visibility: data.visibility || 'PUBLIC',
      disableRightClick: data.disableRightClick ?? true,
      license: data.license || '',
      customLicenseUrl: data.customLicenseUrl || '',
      customLicenseText: data.customLicenseText || '',
      // Creation metadata
      creationDate: data.creationDate ? data.creationDate.split('T')[0] : '',
      creationPeriodValue: data.creationPeriodValue ?? undefined,
      creationPeriodUnit: data.creationPeriodUnit || undefined,
      isCommission: data.isCommission ?? false,
      clientName: data.clientName || '',
      projectName: data.projectName || '',
      medium: data.medium || undefined,
      externalUrl: data.externalUrl || '',
      toolsUsed: data.toolsUsed ? JSON.parse(data.toolsUsed) : [],
    }

    tagsInput.value = data.tags?.map((t: any) => t.name).join(', ') || ''

    // Initialize link card state
    linkCardBlur.value = data.ogCardBlur || false
    // Load existing crop coordinates if present
    if (data.ogCardCropX != null && data.ogCardCropY != null && data.ogCardCropWidth != null && data.ogCardCropHeight != null) {
      linkCardCropCoordinates.value = {
        x: data.ogCardCropX,
        y: data.ogCardCropY,
        width: data.ogCardCropWidth,
        height: data.ogCardCropHeight,
      }
    }

    // Initialize managed images
    managedImages.value = (data.images || []).map((img: any) => ({
      tempId: img.id,
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl || img.url,
      isNew: false,
    }))
    originalImageIds.value = data.images?.map((img: any) => img.id) || []

    // Fetch signed URLs for thumbnails
    await fetchSignedUrls(data.images || [])
  } catch (e: any) {
    console.error('Failed to fetch artwork:', e)
    error.value = e.message || t('artwork.loadFailed')
  } finally {
    loading.value = false
  }
}

// Remove image
const removeImage = (image: ManagedImage) => {
  managedImages.value = managedImages.value.filter(
    (img) => img.tempId !== image.tempId
  )
}

// Trigger file input click
const triggerFileInput = () => {
  fileInput.value?.click()
}

// Handle file selection
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files) {
    addFiles(Array.from(files))
  }
  // Reset input to allow selecting same file again
  target.value = ''
}

// Handle file drop
const handleFileDrop = (event: DragEvent) => {
  const files = event.dataTransfer?.files
  if (files) {
    addFiles(Array.from(files))
  }
}

// Add files to managed images
const addFiles = (files: File[]) => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const maxImages = 20

  for (const file of files) {
    if (managedImages.value.length >= maxImages) {
      submitError.value = t('artwork.maxImagesReached', { max: maxImages })
      break
    }

    if (!file.type.startsWith('image/')) {
      continue
    }

    if (file.size > maxSize) {
      submitError.value = t('artwork.imageTooLarge', { name: file.name })
      continue
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    managedImages.value.push({
      tempId: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: previewUrl,
      thumbnailUrl: previewUrl,
      isNew: true,
      file,
    })
  }
}

// Build imageOperations array for API
const buildImageOperations = () => {
  const operations: { type: 'keep' | 'delete' | 'add'; id?: string; order: number }[] = []

  // Find deleted images
  for (const originalId of originalImageIds.value) {
    const stillExists = managedImages.value.some(
      (img) => img.id === originalId
    )
    if (!stillExists) {
      operations.push({ type: 'delete', id: originalId, order: -1 })
    }
  }

  // Process current images
  managedImages.value.forEach((img, index) => {
    if (img.isNew) {
      operations.push({ type: 'add', order: index })
    } else if (img.id) {
      operations.push({ type: 'keep', id: img.id, order: index })
    }
  })

  return operations
}

// Submit form
const handleSubmit = async () => {
  if (managedImages.value.length === 0) {
    submitError.value = t('artwork.minImageRequired')
    return
  }

  try {
    isSubmitting.value = true
    uploadProgress.value = 0
    submitError.value = null

    const formData = new FormData()
    formData.append('title', form.value.title)
    formData.append('description', form.value.description)
    formData.append('type', form.value.type)
    formData.append('ageRating', form.value.ageRating)
    formData.append('visibility', form.value.visibility)
    formData.append('disableRightClick', String(form.value.disableRightClick))
    formData.append('tags', JSON.stringify(tagsList.value))
    formData.append('imageOperations', JSON.stringify(buildImageOperations()))

    // Add license metadata
    if (form.value.license) {
      formData.append('license', form.value.license)
    }
    if (form.value.customLicenseUrl) {
      formData.append('customLicenseUrl', form.value.customLicenseUrl)
    }
    if (form.value.customLicenseText) {
      formData.append('customLicenseText', form.value.customLicenseText)
    }

    // Add creation metadata
    if (form.value.creationDate) {
      formData.append('creationDate', form.value.creationDate)
    }
    if (form.value.creationPeriodValue !== null && form.value.creationPeriodUnit) {
      formData.append('creationPeriodValue', String(form.value.creationPeriodValue))
      formData.append('creationPeriodUnit', form.value.creationPeriodUnit)
    }
    formData.append('isCommission', String(form.value.isCommission))
    if (form.value.clientName) {
      formData.append('clientName', form.value.clientName)
    }
    if (form.value.projectName) {
      formData.append('projectName', form.value.projectName)
    }
    if (form.value.medium) {
      formData.append('medium', form.value.medium)
    }
    if (form.value.externalUrl) {
      formData.append('externalUrl', form.value.externalUrl)
    }
    if (form.value.toolsUsed && form.value.toolsUsed.length > 0) {
      formData.append('toolsUsed', JSON.stringify(form.value.toolsUsed))
    }

    // Add new image files
    for (const img of managedImages.value) {
      if (img.isNew && img.file) {
        formData.append('newImages', img.file)
      }
    }

    // リンクカード切り抜き座標を追加
    if (linkCardCropCoordinates.value) {
      formData.append('ogCardCropX', String(linkCardCropCoordinates.value.x))
      formData.append('ogCardCropY', String(linkCardCropCoordinates.value.y))
      formData.append('ogCardCropWidth', String(linkCardCropCoordinates.value.width))
      formData.append('ogCardCropHeight', String(linkCardCropCoordinates.value.height))
    }
    formData.append('ogCardBlur', String(linkCardBlur.value))

    await api.updateFormDataWithProgress(
      `/api/artworks/${artworkId.value}`,
      formData,
      (percent) => {
        uploadProgress.value = percent
      }
    )

    // OGカード生成/削除
    // 1枚目が新規画像の場合は最新のartworkデータを取得してimageIdを確認
    const firstImg = managedImages.value[0]
    let firstImageId: string | null = null

    if (firstImg?.isNew) {
      // 新規画像の場合、更新後のartworkからimageIdを取得
      try {
        const updatedArtwork = await api.get<any>(`/api/artworks/${artworkId.value}`)
        firstImageId = updatedArtwork.images?.[0]?.id || null
      } catch (e) {
        console.error('Failed to fetch updated artwork:', e)
      }
    } else {
      firstImageId = firstImg?.id || null
    }

    // OGカード生成（常に実行 - 座標未指定時はデフォルト中央切り抜き）
    if (firstImageId) {
      try {
        await api.post(`/api/artworks/${artworkId.value}/og-card`, {
          imageId: firstImageId,
          cropRegion: linkCardCropCoordinates.value || undefined,
          blur: linkCardBlur.value,
        })
      } catch (e) {
        console.error('Failed to generate OG card:', e)
      }
    }

    // Clean up preview URLs
    for (const img of managedImages.value) {
      if (img.isNew) {
        URL.revokeObjectURL(img.url)
      }
    }

    // Redirect to artwork page after successful update
    router.push(`/artworks/${artworkId.value}`)
  } catch (e: any) {
    console.error('Failed to update artwork:', e)
    submitError.value = e.message || t('artwork.updateFailed')
    isSubmitting.value = false
  }
}

// Delete artwork
const handleDelete = async () => {
  if (!confirm(t('artwork.deleteConfirm'))) {
    return
  }

  try {
    isSubmitting.value = true
    await api.delete(`/api/artworks/${artworkId.value}`)

    // Clean up preview URLs
    for (const img of managedImages.value) {
      if (img.isNew) {
        URL.revokeObjectURL(img.url)
      }
    }

    // Redirect to user profile after deletion
    router.push(`/users/${user.value?.username}`)
  } catch (e: any) {
    console.error('Failed to delete artwork:', e)
    submitError.value = e.message || t('artwork.deleteFailed')
    isSubmitting.value = false
  }
}

// Fetch on mount
onMounted(() => {
  fetchArtwork()
})

// Cleanup preview URLs on unmount
onUnmounted(() => {
  for (const img of managedImages.value) {
    if (img.isNew) {
      URL.revokeObjectURL(img.url)
    }
  }
})
</script>
