<template>
  <div class="image-uploader">
    <div
      class="upload-area"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        class="hidden"
        @change="handleFileSelect"
      />

      <div v-if="images.length === 0" class="upload-prompt">
        <Icon name="CloudArrowUp" class="upload-icon" />
        <p class="upload-text">{{ $t('upload.addImages') }}</p>
        <p class="upload-hint">{{ $t('upload.supportedFormats') }}</p>
        <p class="upload-hint">{{ $t('upload.sizeHint') }}</p>
      </div>

      <div v-else class="image-grid">
        <div
          v-for="(image, index) in images"
          :key="index"
          class="image-item"
        >
          <img :src="image.preview" :alt="`Image ${index + 1}`" class="preview-image" />
          <button
            type="button"
            class="remove-button"
            @click.stop="removeImage(index)"
          >
            ×
          </button>
          <div class="image-order">{{ index + 1 }}</div>
        </div>

        <div v-if="images.length < MAX_FILES" class="add-more" @click.stop="triggerFileInput">
          <Icon name="Plus" class="add-icon" />
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface ImageData {
  file: File
  preview: string
}

const emit = defineEmits<{
  (e: 'update:images', images: File[]): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const images = ref<ImageData[]>([])
const isDragging = ref(false)
const errorMessage = ref('')

const MAX_FILE_SIZE = 32 * 1024 * 1024 // 32MB
const MAX_TOTAL_SIZE = 200 * 1024 * 1024 // 200MB

const { user } = useAuth()

// Dynamic MAX_FILES based on supporter tier (Admin gets TIER_1 limit)
const MAX_FILES = computed(() => {
  if (user.value?.role === 'ADMIN') return 20
  const tier = user.value?.supporterTier || 'NONE'
  const tierLimits: Record<string, number> = {
    NONE: 5,
    TIER_1: 20,
    TIER_2: 50,
    TIER_3: 100,
  }
  return tierLimits[tier] || 5
})

const triggerFileInput = () => {
  fileInput.value?.click()
}

const validateFiles = (files: File[]): boolean => {
  errorMessage.value = ''

  if (images.value.length + files.length > MAX_FILES.value) {
    errorMessage.value = t('upload.maxFilesError', { max: MAX_FILES.value })
    return false
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      errorMessage.value = t('upload.fileTooLarge', { name: file.name })
      return false
    }

    if (!file.type.match(/^image\/(jpeg|png|webp|gif|svg\+xml)$/)) {
      errorMessage.value = t('upload.unsupportedFormat', { name: file.name })
      return false
    }
  }

  const totalSize = [...images.value, ...files.map(file => ({ file, preview: '' }))].reduce(
    (sum, img) => sum + img.file.size,
    0
  )

  if (totalSize > MAX_TOTAL_SIZE) {
    errorMessage.value = t('upload.totalSizeError')
    return false
  }

  return true
}

const addFiles = (files: File[]) => {
  if (!validateFiles(files)) return

  const newImages: ImageData[] = files.map(file => ({
    file,
    preview: URL.createObjectURL(file),
  }))

  images.value.push(...newImages)
  emit('update:images', images.value.map(img => img.file))
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    addFiles(Array.from(target.files))
  }
  target.value = '' // Reset input
}

const handleDrop = (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files) {
    addFiles(Array.from(event.dataTransfer.files))
  }
}

const removeImage = (index: number) => {
  URL.revokeObjectURL(images.value[index].preview)
  images.value.splice(index, 1)
  emit('update:images', images.value.map(img => img.file))
}

onBeforeUnmount(() => {
  images.value.forEach(img => URL.revokeObjectURL(img.preview))
})
</script>

<style scoped>
.image-uploader {
  width: 100%;
}

.upload-area {
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-surface);
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: var(--color-primary);
  background: var(--color-hover);
}

.hidden {
  display: none;
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  width: 48px;
  height: 48px;
  color: var(--color-primary);
  margin-bottom: 1rem;
}

.upload-text {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.upload-hint {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.image-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-background);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-scrim);
  color: white;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.remove-button:hover {
  background: var(--color-danger);
}

.image-order {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  background: var(--color-scrim);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.add-more {
  aspect-ratio: 1;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.add-more:hover {
  border-color: var(--color-primary);
  background: var(--color-hover);
}

.add-icon {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
}

.error-message {
  color: var(--color-danger-text);
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
</style>
