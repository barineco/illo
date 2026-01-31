<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @mousedown.self="handleBackdropMouseDown"
      @mouseup.self="handleBackdropMouseUp"
    >
      <!-- Modal -->
      <div class="bg-[var(--color-surface)] rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 class="text-lg font-bold">{{ title || $t('cropper.title') }}</h2>
          <button
            @click="close"
            class="p-1 hover:bg-[var(--color-hover)] rounded transition-colors"
          >
            <Icon name="XMark" class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 flex-1 overflow-hidden">
          <!-- Loading -->
          <div v-if="isLoading" class="flex items-center justify-center h-64">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
          </div>

          <!-- Cropper -->
          <div v-else class="cropper-container">
            <Cropper
              ref="cropperRef"
              :src="imageSrc"
              :stencil-component="stencilComponent"
              :stencil-props="stencilProps"
              :default-boundaries="defaultBoundaries"
              :canvas="canvasOptions"
              class="cropper"
              @ready="onCropperReady"
              @change="onCropperChange"
            />
          </div>

          <!-- Instructions -->
          <p class="text-sm text-[var(--color-text-muted)] mt-3 text-center">
            {{ $t('cropper.dragToAdjust') }}
          </p>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t border-[var(--color-border)]">
          <button
            @click="reset"
            class="px-4 py-2 text-sm hover:bg-[var(--color-hover)] rounded transition-colors"
          >
            {{ $t('cropper.reset') }}
          </button>
          <div class="flex gap-2">
            <button
              @click="close"
              class="px-4 py-2 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)] rounded transition-colors text-sm"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              @click="confirm"
              class="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded transition-colors text-sm"
            >
              {{ $t('cropper.apply') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Cropper, CircleStencil, RectangleStencil } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

export interface CropCoordinates {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  isOpen: boolean
  /** Image source: File object, URL string, or null */
  imageSource: File | string | null
  /** Aspect ratio (e.g., 1 for 1:1, 16/9 for 16:9, 3/4 for 3:4). null = free aspect */
  aspectRatio?: number | null
  /** Stencil type: 'rectangle' (default) or 'circle' */
  stencilType?: 'rectangle' | 'circle'
  /** Initial crop coordinates to restore (in original image pixels) */
  initialCrop?: CropCoordinates | null
  /** Original image width (required for coordinate translation when initialCrop is provided) */
  originalWidth?: number
  /** Original image height (required for coordinate translation when initialCrop is provided) */
  originalHeight?: number
  /** Modal title (optional, uses i18n default if not provided) */
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: null,
  stencilType: 'rectangle',
  initialCrop: null,
  originalWidth: undefined,
  originalHeight: undefined,
  title: undefined,
})

const emit = defineEmits<{
  close: []
  confirm: [coordinates: CropCoordinates]
  reset: []
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const imageSrc = ref<string>('')
const isLoading = ref(true)
const displayedImageWidth = ref(0)
const displayedImageHeight = ref(0)
const hasInitialized = ref(false)

// Track mousedown on backdrop to prevent close when dragging out
const backdropMouseDownTime = ref(0)

// Stencil component based on type
const stencilComponent = computed(() => {
  return props.stencilType === 'circle' ? CircleStencil : RectangleStencil
})

// Stencil props including aspect ratio
const stencilProps = computed(() => {
  const baseProps: any = {
    handlers: {},
    movable: true,
    resizable: true,
    aspectRatio: props.aspectRatio || undefined,
  }
  return baseProps
})

// Default boundaries for the cropper
const defaultBoundaries = computed(() => {
  return {
    width: 600,
    height: 400,
  }
})

// Canvas options
const canvasOptions = computed(() => ({
  minWidth: 10,
  minHeight: 10,
  maxWidth: 4096,
  maxHeight: 4096,
}))

const handleBackdropMouseDown = () => {
  backdropMouseDownTime.value = Date.now()
}

const handleBackdropMouseUp = () => {
  const elapsed = Date.now() - backdropMouseDownTime.value
  if (elapsed < 200) {
    close()
  }
}

watch(
  () => [props.isOpen, props.imageSource],
  async ([isOpen, source]) => {
    if (!isOpen || !source) {
      imageSrc.value = ''
      hasInitialized.value = false
      return
    }

    isLoading.value = true
    hasInitialized.value = false

    try {
      if (source instanceof File) {
        imageSrc.value = await fileToDataUrl(source)
      } else if (typeof source === 'string') {
        imageSrc.value = source
      }
    } catch (error) {
      console.error('Failed to load image:', error)
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function onCropperReady() {
  if (hasInitialized.value) return

  const cropper = cropperRef.value
  if (!cropper) return

  const state = cropper.getResult()
  if (state?.image) {
    displayedImageWidth.value = state.image.width
    displayedImageHeight.value = state.image.height
  }

  if (props.initialCrop && props.originalWidth && props.originalHeight) {
    nextTick(() => {
      restoreInitialCrop()
    })
  } else {
    nextTick(() => {
      setDefaultCrop()
    })
  }

  hasInitialized.value = true
}

function setDefaultCrop() {
  const cropper = cropperRef.value
  if (!cropper) return

  const state = cropper.getResult()
  if (!state?.image) return

  const imageWidth = state.image.width
  const imageHeight = state.image.height

  if (props.aspectRatio) {
    const imageAspect = imageWidth / imageHeight
    const targetAspect = props.aspectRatio

    let cropWidth: number
    let cropHeight: number

    if (imageAspect > targetAspect) {
      cropHeight = imageHeight
      cropWidth = cropHeight * targetAspect
    } else {
      cropWidth = imageWidth
      cropHeight = cropWidth / targetAspect
    }

    const left = (imageWidth - cropWidth) / 2
    const top = (imageHeight - cropHeight) / 2

    cropper.setCoordinates({
      left,
      top,
      width: cropWidth,
      height: cropHeight,
    })
  }
}

function onCropperChange(result: any) {
  if (result?.image) {
    displayedImageWidth.value = result.image.width
    displayedImageHeight.value = result.image.height
  }
}

function restoreInitialCrop() {
  const cropper = cropperRef.value
  if (!cropper || !props.initialCrop || !props.originalWidth || !props.originalHeight) return

  const scaleX = displayedImageWidth.value / props.originalWidth
  const scaleY = displayedImageHeight.value / props.originalHeight

  const displayCoords = {
    left: props.initialCrop.x * scaleX,
    top: props.initialCrop.y * scaleY,
    width: props.initialCrop.width * scaleX,
    height: props.initialCrop.height * scaleY,
  }

  cropper.setCoordinates(displayCoords)
}

function close() {
  emit('close')
}

function reset() {
  const cropper = cropperRef.value
  if (cropper) {
    cropper.reset()
    // Re-apply default crop after reset
    nextTick(() => {
      setDefaultCrop()
    })
  }
  emit('reset')
}

// Confirm and emit coordinates
function confirm() {
  const cropper = cropperRef.value
  if (!cropper) {
    close()
    return
  }

  const result = cropper.getResult()
  if (!result || !result.coordinates) {
    close()
    return
  }

  // Get the original image dimensions from the cropper
  const imageWidth = result.image?.width || displayedImageWidth.value
  const imageHeight = result.image?.height || displayedImageHeight.value

  // If original dimensions are provided, convert displayed coordinates to original
  let finalCoordinates: CropCoordinates

  if (props.originalWidth && props.originalHeight && imageWidth && imageHeight) {
    const scaleX = props.originalWidth / imageWidth
    const scaleY = props.originalHeight / imageHeight

    finalCoordinates = {
      x: Math.round(result.coordinates.left * scaleX),
      y: Math.round(result.coordinates.top * scaleY),
      width: Math.round(result.coordinates.width * scaleX),
      height: Math.round(result.coordinates.height * scaleY),
    }
  } else {
    // Use displayed coordinates directly
    finalCoordinates = {
      x: Math.round(result.coordinates.left),
      y: Math.round(result.coordinates.top),
      width: Math.round(result.coordinates.width),
      height: Math.round(result.coordinates.height),
    }
  }

  emit('confirm', finalCoordinates)
  close()
}
</script>

<style scoped>
.cropper-container {
  width: 100%;
  height: 400px;
  background-color: var(--color-background);
  border-radius: 8px;
  overflow: hidden;
}

.cropper {
  width: 100%;
  height: 100%;
}

/* Override vue-advanced-cropper default styles for dark mode compatibility */
:deep(.vue-advanced-cropper) {
  background-color: var(--color-background);
}

:deep(.vue-advanced-cropper__background) {
  background-color: var(--color-background);
}

:deep(.vue-advanced-cropper__foreground) {
  background-color: rgba(0, 0, 0, 0.5);
}

:deep(.vue-rectangle-stencil__preview) {
  border-color: var(--color-primary);
}

:deep(.vue-circle-stencil__preview) {
  border-color: var(--color-primary);
}

:deep(.vue-simple-handler) {
  background-color: var(--color-primary);
  border-color: white;
}
</style>
