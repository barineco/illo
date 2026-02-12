<template>
  <NuxtLink
    :to="`/characters/${character.id}`"
    class="block bg-[var(--color-surface)] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
  >
    <!-- Avatar Image -->
    <div class="aspect-square bg-[var(--color-surface-hover)] relative">
      <img
        v-if="avatarImageUrl"
        :src="avatarImageUrl"
        :alt="character.name"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]"
      >
        <Icon name="User" class="w-16 h-16" />
      </div>

      <!-- Fan Art Welcome Badge (bottom to avoid covering face) -->
      <div
        v-if="character.allowFanArt"
        class="absolute bottom-2 right-2 bg-[var(--color-primary)] text-white text-xs px-2 py-1 rounded-full"
      >
        {{ $t('character.fanArtWelcome') }}
      </div>
    </div>

    <!-- Info -->
    <div class="p-3">
      <h3 class="font-medium text-[var(--color-text)] truncate">
        {{ character.name }}
      </h3>

      <!-- Creator -->
      <div class="flex items-center gap-2 mt-2">
        <img
          v-if="character.creator?.avatarUrl"
          :src="character.creator.avatarUrl"
          :alt="character.creator.displayName || character.creator.username"
          class="w-5 h-5 rounded-full object-cover"
        />
        <div
          v-else
          class="w-5 h-5 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center"
        >
          <Icon name="User" class="w-3 h-3 text-[var(--color-text-muted)]" />
        </div>
        <span class="text-sm text-[var(--color-text-muted)] truncate">
          {{ character.creator?.displayName || character.creator?.username }}
        </span>
      </div>

      <!-- Fan Art Count -->
      <div
        v-if="fanArtCount > 0"
        class="flex items-center gap-1 mt-2 text-sm text-[var(--color-text-muted)]"
      >
        <Icon name="Photo" class="w-4 h-4" />
        <span>{{ $t('character.fanArtCount', { count: fanArtCount }) }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
const { getSignedUrl } = useSignedImageUrlOnce()

interface ArtworkImage {
  id: string
  url?: string | null
  thumbnailUrl?: string | null
}

interface RepresentativeArtwork {
  id: string
  title?: string
  images?: ArtworkImage[]
}

interface Character {
  id: string
  name: string
  // New artwork reference structure
  representativeArtwork?: RepresentativeArtwork | null
  allowFanArt: boolean
  fanArtCount?: number
  _count?: {
    fanArts: number
  }
  creator?: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl?: string | null
  }
}

const props = defineProps<{
  character: Character
}>()

// Signed URL for avatar image
const avatarImageUrl = ref<string | null>(null)

// Get first image ID from representative artwork
const firstImageId = computed(() => {
  const artwork = props.character.representativeArtwork
  if (!artwork?.images?.length) return null
  return artwork.images[0].id
})

// Fetch signed URL on mount
onMounted(async () => {
  if (firstImageId.value) {
    try {
      avatarImageUrl.value = await getSignedUrl(firstImageId.value, true)
    } catch {
      // Fall back to raw URL if signed URL fails
      const artwork = props.character.representativeArtwork
      if (artwork?.images?.length) {
        const firstImage = artwork.images[0]
        avatarImageUrl.value = firstImage.thumbnailUrl || firstImage.url || null
      }
    }
  }
})

const fanArtCount = computed(() => {
  return props.character.fanArtCount || props.character._count?.fanArts || 0
})
</script>
