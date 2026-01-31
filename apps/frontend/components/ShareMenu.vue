<template>
  <div class="relative">
    <!-- Share Button -->
    <IconButton
      :variant="variant"
      :size="size"
      shape="square"
      :aria-label="$t('artwork.share')"
      :title="$t('artwork.share')"
      @click.stop="toggleMenu"
    >
      <Icon name="Share" class="w-5 h-5" />
    </IconButton>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="absolute right-0 top-full mt-1 bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-border)] overflow-hidden min-w-[180px] z-50"
    >
      <!-- Copy URL -->
      <button
        @click.stop="copyUrl"
        class="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3"
      >
        <Icon name="Link" class="w-4 h-4" />
        {{ $t('artwork.shareUrl') }}
      </button>

      <!-- Share to Bluesky -->
      <button
        @click.stop="shareToBluesky"
        class="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3"
      >
        <BlueskyIcon class="w-4 h-4" />
        {{ $t('artwork.shareToBluesky') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  url: string
  title: string
  variant?: 'ghost' | 'secondary' | 'danger' | 'primary'
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'lg',
})

const { t } = useI18n()
const { addToast } = useToast()
const isOpen = ref(false)

// Toggle menu
const toggleMenu = () => {
  isOpen.value = !isOpen.value
}

// Close menu
const closeMenu = () => {
  isOpen.value = false
}

// Copy URL to clipboard
const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(props.url)
    addToast({
      type: 'success',
      message: t('artwork.urlCopied'),
    })
  } catch (error) {
    console.error('Failed to copy URL:', error)
  }
  closeMenu()
}

// Share to Bluesky
const shareToBluesky = () => {
  const text = encodeURIComponent(`${props.title}\n${props.url}`)
  const blueskyUrl = `https://bsky.app/intent/compose?text=${text}`
  window.open(blueskyUrl, '_blank', 'noopener,noreferrer')
  closeMenu()
}

// Close menu on outside click
onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>
