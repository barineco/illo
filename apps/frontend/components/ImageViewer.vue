<template>
  <!-- Fullscreen Modal -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] bg-[var(--color-viewer-bg)] flex items-center justify-center"
        @click.self="close"
      >
        <!-- Close Button -->
        <button
          @click="close"
          class="absolute top-4 right-4 w-12 h-12 flex items-center justify-center bg-[var(--color-viewer-button)] hover:bg-[var(--color-viewer-button-hover)] rounded-full transition-colors z-10 text-white"
          :title="$t('viewer.closeKey')"
        >
          <Icon name="XMark" class="w-6 h-6" />
        </button>

        <!-- Image Info -->
        <div class="absolute top-4 left-4 bg-[var(--color-viewer-controls)] px-4 py-2 rounded-lg z-10">
          <p class="text-sm text-[var(--color-text-secondary)]">
            {{ currentIndex + 1 }} / {{ images.length }}
          </p>
          <p v-if="actualImageDimensions.width && actualImageDimensions.height" class="text-xs text-[var(--color-text-muted)] mt-1">
            {{ actualImageDimensions.width }} × {{ actualImageDimensions.height }}
          </p>
        </div>

        <!-- Download Button (hidden when right-click is disabled) -->
        <button
          v-if="currentImage && !disableRightClick"
          @click="downloadImage"
          class="absolute top-4 right-20 w-12 h-12 flex items-center justify-center bg-[var(--color-viewer-button)] hover:bg-[var(--color-viewer-button-hover)] rounded-full transition-colors z-10 text-white"
          :title="$t('viewer.download')"
        >
          <Icon name="ArrowDownTray" class="w-6 h-6" />
        </button>

        <!-- Previous Button -->
        <button
          v-if="images.length > 1"
          @click="previous"
          class="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-[var(--color-viewer-button)] hover:bg-[var(--color-viewer-button-hover)] rounded-full transition-colors text-white"
          :title="$t('viewer.previousKey')"
        >
          <Icon name="ChevronLeft" class="w-6 h-6" />
        </button>

        <!-- Next Button -->
        <button
          v-if="images.length > 1"
          @click="next"
          class="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-[var(--color-viewer-button)] hover:bg-[var(--color-viewer-button-hover)] rounded-full transition-colors text-white"
          :title="$t('viewer.nextKey')"
        >
          <Icon name="ChevronRight" class="w-6 h-6" />
        </button>

        <!-- Main Image Container -->
        <div
          ref="imageContainer"
          class="absolute inset-0 flex items-center justify-center overflow-visible"
          :style="{
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }"
          @wheel.prevent="handleWheel"
          @mousedown="startDrag"
          @mousemove="drag"
          @mouseup="endDrag"
          @mouseleave="endDrag"
        >
          <img
            v-if="currentImage"
            :src="currentImage.url"
            :alt="$t('viewer.imageAlt', { index: currentIndex + 1 })"
            class="max-w-[90vw] max-h-[90vh] object-contain select-none"
            :style="{
              transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }"
            draggable="false"
            @load="handleImageLoad"
            @contextmenu="handleContextMenu"
          />
        </div>

        <!-- Zoom Controls -->
        <div
          class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[var(--color-viewer-controls)] px-4 py-2 rounded-lg text-white"
        >
          <button
            @click="zoomOut"
            :disabled="zoom <= minZoom"
            class="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-viewer-button-hover)] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            :title="$t('viewer.zoomOut')"
          >
            <Icon name="MinusCircle" class="w-5 h-5" />
          </button>

          <span class="text-sm text-[var(--color-text-secondary)] min-w-[4rem] text-center">{{
            Math.round(zoom * 100)
          }}%</span>

          <button
            @click="zoomIn"
            :disabled="zoom >= maxZoom"
            class="w-8 h-8 flex items-center justify-center hover:bg-[var(--color-viewer-button-hover)] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            :title="$t('viewer.zoomIn')"
          >
            <Icon name="PlusCircle" class="w-5 h-5" />
          </button>

          <div class="w-px h-6 bg-[var(--color-border)] mx-2"></div>

          <button
            @click="resetZoom"
            class="px-3 py-1 hover:bg-[var(--color-viewer-button-hover)] rounded text-sm transition-colors"
            :title="$t('viewer.reset')"
          >
            {{ $t('viewer.reset') }}
          </button>
        </div>

        <!-- Thumbnail Strip (if multiple images) -->
        <div
          v-if="images.length > 1"
          class="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 bg-[var(--color-viewer-controls)] px-4 py-2 rounded-lg max-w-[90vw] overflow-x-auto"
        >
          <button
            v-for="(image, index) in images"
            :key="image.id"
            @click="goToImage(index)"
            class="flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all"
            :class="
              currentIndex === index
                ? 'border-[var(--color-primary)]'
                : 'border-transparent hover:border-[var(--color-border)]'
            "
          >
            <img
              :src="image.thumbnailUrl || image.url"
              :alt="$t('viewer.thumbnailAlt', { index: index + 1 })"
              class="w-full h-full object-cover"
            />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface ImageViewerImage {
  id: string
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
}

interface ImageViewerProps {
  images: ImageViewerImage[]
  initialIndex?: number
  disableRightClick?: boolean
}

const props = withDefaults(defineProps<ImageViewerProps>(), {
  initialIndex: 0,
  disableRightClick: false,
})

const emit = defineEmits<{
  close: []
}>()

// State
const isOpen = ref(false)
const currentIndex = ref(props.initialIndex)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartPanX = ref(0)
const dragStartPanY = ref(0)
const imageContainer = ref<HTMLElement | null>(null)
const actualImageDimensions = ref({ width: 0, height: 0 })

// Zoom Configuration Constants (extractable for future settings)
const minZoom = 0.5
const maxZoom = 10
const zoomStep = 0.25

// Computed
const currentImage = computed(() => props.images[currentIndex.value])

// Methods
const open = (index = 0) => {
  currentIndex.value = index
  isOpen.value = true
  resetZoom()
  document.body.style.overflow = 'hidden'
}

const close = () => {
  isOpen.value = false
  document.body.style.overflow = ''
  emit('close')
}

const next = () => {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
    resetZoom()
  }
}

const previous = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    resetZoom()
  }
}

const goToImage = (index: number) => {
  currentIndex.value = index
  resetZoom()
}

const zoomIn = () => {
  if (zoom.value < maxZoom) {
    zoom.value = Math.min(zoom.value + zoomStep, maxZoom)
  }
}

const zoomOut = () => {
  if (zoom.value > minZoom) {
    zoom.value = Math.max(zoom.value - zoomStep, minZoom)
    if (zoom.value === 1) {
      panX.value = 0
      panY.value = 0
    }
  }
}

const resetZoom = () => {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const startDrag = (e: MouseEvent) => {
  if (zoom.value > 1) {
    isDragging.value = true
    dragStartX.value = e.clientX
    dragStartY.value = e.clientY
    dragStartPanX.value = panX.value
    dragStartPanY.value = panY.value
  }
}

const drag = (e: MouseEvent) => {
  if (isDragging.value) {
    const deltaX = e.clientX - dragStartX.value
    const deltaY = e.clientY - dragStartY.value
    panX.value = dragStartPanX.value + deltaX / zoom.value
    panY.value = dragStartPanY.value + deltaY / zoom.value
  }
}

const endDrag = () => {
  isDragging.value = false
}

const handleImageLoad = (e: Event) => {
  const imgElement = e.target as HTMLImageElement
  if (imgElement) {
    actualImageDimensions.value = {
      width: imgElement.naturalWidth,
      height: imgElement.naturalHeight,
    }
  }

  resetZoom()
}

const handleContextMenu = (e: MouseEvent) => {
  if (props.disableRightClick) {
    e.preventDefault()
  }
}

const downloadImage = () => {
  if (!currentImage.value) return

  const link = document.createElement('a')
  link.href = currentImage.value.url
  link.download = `image-${currentIndex.value + 1}.jpg`
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value) return

  switch (e.key) {
    case 'Escape':
      close()
      break
    case 'ArrowLeft':
      previous()
      break
    case 'ArrowRight':
      next()
      break
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
    case '_':
      zoomOut()
      break
    case '0':
      resetZoom()
      break
  }
}

// Lifecycle
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})

// Expose methods for parent component
defineExpose({
  open,
  close,
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Hide scrollbar for thumbnail strip */
div::-webkit-scrollbar {
  height: 4px;
}

div::-webkit-scrollbar-track {
  background: transparent;
}

div::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

div::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
