<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
    @click.self="$emit('close')"
  >
    <div
      class="bg-[var(--color-surface)] rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 class="text-lg font-semibold text-[var(--color-text)]">
          {{ title }}
        </h2>
        <button
          type="button"
          class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          @click="$emit('close')"
        >
          <Icon name="XMark" class="w-6 h-6" />
        </button>
      </div>

      <!-- Search -->
      <div class="p-4 border-b border-[var(--color-border)]">
        <div class="relative">
          <Icon
            name="MagnifyingGlass"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('artwork.searchPlaceholder')"
            class="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            @input="debouncedSearch"
          />
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Loading -->
        <div v-if="isLoading" class="flex justify-center py-8">
          <div
            class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"
          ></div>
        </div>

        <!-- Artworks Grid -->
        <div
          v-else-if="artworks.length > 0"
          class="grid grid-cols-3 md:grid-cols-4 gap-3"
        >
          <button
            v-for="artwork in artworks"
            :key="artwork.id"
            type="button"
            class="relative aspect-square rounded-lg overflow-hidden border-2 transition-all"
            :class="
              selectedId === artwork.id
                ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]'
                : 'border-transparent hover:border-[var(--color-border)]'
            "
            @click="handleSelect(artwork.id)"
          >
            <img
              :src="getArtworkThumbnail(artwork)"
              :alt="artwork.title"
              class="w-full h-full object-cover"
            />
            <div
              v-if="selectedId === artwork.id"
              class="absolute inset-0 bg-[var(--color-primary)]/20 flex items-center justify-center"
            >
              <Icon name="Check" class="w-8 h-8 text-[var(--color-primary)]" />
            </div>
          </button>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-8 text-[var(--color-text-muted)]">
          <Icon name="Photo" class="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{{ $t('artwork.noArtworks') }}</p>
        </div>

        <!-- Load More -->
        <div
          v-if="hasMore && !isLoading"
          class="flex justify-center mt-4"
        >
          <BaseButton
            variant="outline"
            size="sm"
            shape="rounded"
            :loading="isLoadingMore"
            @click="loadMore"
          >
            {{ $t('common.loadMore') }}
          </BaseButton>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-3 p-4 border-t border-[var(--color-border)]">
        <BaseButton
          variant="outline"
          size="md"
          shape="rounded"
          @click="$emit('close')"
        >
          {{ $t('common.cancel') }}
        </BaseButton>
        <BaseButton
          variant="primary"
          size="md"
          shape="rounded"
          :disabled="!selectedId"
          @click="confirmSelection"
        >
          {{ $t('common.select') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const api = useApi()
const { getSignedUrl } = useSignedImageUrlOnce()

interface ArtworkImage {
  id: string
  url?: string | null
  thumbnailUrl?: string | null
}

interface Artwork {
  id: string
  title: string
  images: ArtworkImage[]
}

interface ArtworksResponse {
  artworks: Artwork[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const props = defineProps<{
  title: string
  excludeIds?: string[]
}>()

const emit = defineEmits<{
  close: []
  select: [artworkId: string]
}>()

const artworks = ref<Artwork[]>([])
const isLoading = ref(true)
const isLoadingMore = ref(false)
const page = ref(1)
const totalPages = ref(1)
const searchQuery = ref('')
const selectedId = ref<string | null>(null)

// Cache for signed URLs
const signedUrlCache = ref<Map<string, string>>(new Map())

const hasMore = computed(() => page.value < totalPages.value)

// Fetch signed URLs for artwork thumbnails
const fetchSignedUrls = async (artworkList: Artwork[]) => {
  for (const artwork of artworkList) {
    if (!artwork.images?.length) continue
    const imageId = artwork.images[0].id
    if (signedUrlCache.value.has(imageId)) continue

    try {
      const signedUrl = await getSignedUrl(imageId, true)
      signedUrlCache.value.set(imageId, signedUrl)
    } catch {
      // Fall back to raw URL
      const firstImage = artwork.images[0]
      signedUrlCache.value.set(imageId, firstImage.thumbnailUrl || firstImage.url || '')
    }
  }
}

const getArtworkThumbnail = (artwork: Artwork): string => {
  if (!artwork.images?.length) return ''
  const imageId = artwork.images[0].id
  return signedUrlCache.value.get(imageId) || artwork.images[0].thumbnailUrl || artwork.images[0].url || ''
}

const fetchArtworks = async (append = false) => {
  try {
    if (!append) {
      isLoading.value = true
      page.value = 1
    } else {
      isLoadingMore.value = true
    }

    const params: Record<string, any> = {
      page: page.value,
      limit: 20,
      authorOnly: true, // Only show user's own artworks
    }

    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim()
    }

    const response = await api.get<ArtworksResponse>('/api/artworks', { params })

    // Filter out excluded IDs
    let filtered = response.artworks
    if (props.excludeIds?.length) {
      filtered = filtered.filter((a) => !props.excludeIds!.includes(a.id))
    }

    if (append) {
      artworks.value = [...artworks.value, ...filtered]
    } else {
      artworks.value = filtered
    }
    totalPages.value = response.pagination.totalPages

    // Fetch signed URLs for the new artworks
    await fetchSignedUrls(filtered)
  } catch (e: any) {
    console.error('Failed to fetch artworks:', e)
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return
  page.value++
  await fetchArtworks(true)
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
const debouncedSearch = () => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    fetchArtworks()
  }, 300)
}

const handleSelect = (artworkId: string) => {
  selectedId.value = selectedId.value === artworkId ? null : artworkId
}

const confirmSelection = () => {
  if (selectedId.value) {
    emit('select', selectedId.value)
  }
}

onMounted(() => {
  fetchArtworks()
})
</script>
