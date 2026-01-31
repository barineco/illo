<template>
  <div class="space-y-6">
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-[var(--color-surface)] rounded-lg p-4">
        <p class="text-sm text-[var(--color-text-muted)]">{{ $t('dashboard.stats.artworks') }}</p>
        <p class="text-2xl font-bold mt-1">{{ stats.artworks?.count || 0 }}</p>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4">
        <p class="text-sm text-[var(--color-text-muted)]">{{ $t('dashboard.stats.totalViews') }}</p>
        <p class="text-2xl font-bold mt-1">{{ formatNumber(stats.artworks?.totalViews || 0) }}</p>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4">
        <p class="text-sm text-[var(--color-text-muted)]">{{ $t('dashboard.stats.totalLikes') }}</p>
        <p class="text-2xl font-bold mt-1">{{ formatNumber(stats.artworks?.totalLikes || 0) }}</p>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4">
        <p class="text-sm text-[var(--color-text-muted)]">{{ $t('dashboard.stats.followers') }}</p>
        <p class="text-2xl font-bold mt-1">{{ formatNumber(stats.followers || 0) }}</p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="artworks.length === 0" class="text-center py-12">
      <Icon name="Photo" class="w-16 h-16 mx-auto mb-4 text-[var(--color-text-muted)]" />
      <p class="text-[var(--color-text-muted)] mb-4">{{ $t('dashboard.artworks.empty') }}</p>
      <BaseButton
        variant="primary"
        size="lg"
        shape="rounded"
        @click="navigateTo('/upload')"
      >
        {{ $t('dashboard.artworks.createFirst') }}
      </BaseButton>
    </div>

    <!-- Artworks Table -->
    <div v-else class="bg-[var(--color-surface)] rounded-lg overflow-hidden">
      <table class="w-full">
        <thead class="bg-[var(--color-surface-secondary)]">
          <tr>
            <th class="text-left px-4 py-3 text-sm font-medium">{{ $t('dashboard.artworks.artwork') }}</th>
            <th class="text-center px-4 py-3 text-sm font-medium hidden md:table-cell">{{ $t('dashboard.artworks.views') }}</th>
            <th class="text-center px-4 py-3 text-sm font-medium hidden md:table-cell">{{ $t('dashboard.artworks.likes') }}</th>
            <th class="text-center px-4 py-3 text-sm font-medium hidden sm:table-cell">{{ $t('dashboard.artworks.visibility') }}</th>
            <th class="text-right px-4 py-3 text-sm font-medium">{{ $t('dashboard.artworks.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--color-border)]">
          <tr v-for="artwork in artworks" :key="artwork.id" class="hover:bg-[var(--color-hover)] transition-colors">
            <td class="px-4 py-3">
              <NuxtLink :to="`/artworks/${artwork.id}`" class="flex items-center gap-3 hover:opacity-80">
                <div class="w-12 h-12 rounded bg-[var(--color-surface-tertiary)] overflow-hidden flex-shrink-0">
                  <img
                    v-if="artwork.signedThumbnailUrl || artwork.images?.[0]?.thumbnailUrl"
                    :src="artwork.signedThumbnailUrl || artwork.images?.[0]?.thumbnailUrl"
                    :alt="artwork.title"
                    class="w-full h-full object-cover"
                  />
                </div>
                <span class="font-medium truncate max-w-[200px]">{{ artwork.title }}</span>
              </NuxtLink>
            </td>
            <td class="text-center px-4 py-3 hidden md:table-cell">
              <span class="flex items-center justify-center gap-1 text-sm">
                <Icon name="Eye" class="w-4 h-4 text-[var(--color-text-muted)]" />
                {{ formatNumber(artwork.viewCount) }}
              </span>
            </td>
            <td class="text-center px-4 py-3 hidden md:table-cell">
              <span class="flex items-center justify-center gap-1 text-sm">
                <Icon name="Heart" class="w-4 h-4 text-[var(--color-text-muted)]" />
                {{ formatNumber(artwork.likeCount) }}
              </span>
            </td>
            <td class="text-center px-4 py-3 hidden sm:table-cell">
              <span class="text-xs px-2 py-1 rounded-full" :class="getVisibilityClass(artwork.visibility)">
                {{ $t(`upload.visibility${artwork.visibility.charAt(0) + artwork.visibility.slice(1).toLowerCase()}`) }}
              </span>
            </td>
            <td class="text-right px-4 py-3">
              <div class="flex items-center justify-end gap-2">
                <IconButton
                  variant="ghost"
                  size="sm"
                  shape="square"
                  :aria-label="$t('common.edit')"
                  :title="$t('common.edit')"
                  @click="navigateTo(`/artworks/${artwork.id}/edit`)"
                >
                  <Icon name="PencilSquare" class="w-4 h-4" />
                </IconButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const { getSignedUrl } = useSignedImageUrlOnce()

interface ArtworkImage {
  id: string
  thumbnailUrl: string
}

interface Artwork {
  id: string
  title: string
  viewCount: number
  likeCount: number
  visibility: string
  images?: ArtworkImage[]
  // Signed URL for display (fetched client-side)
  signedThumbnailUrl?: string
}

interface Stats {
  artworks?: {
    count: number
    totalViews: number
    totalLikes: number
  }
  followers?: number
}

// State
const artworks = ref<Artwork[]>([])
const stats = ref<Stats>({})
const loading = ref(false)
const loadingStats = ref(false)

// Fetch stats
const fetchStats = async () => {
  loadingStats.value = true
  try {
    stats.value = await api.get<Stats>('/api/users/me/stats')
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  } finally {
    loadingStats.value = false
  }
}

// Fetch signed URL for an artwork image
const fetchSignedThumbnailUrl = async (artwork: Artwork): Promise<string> => {
  const imageId = artwork.images?.[0]?.id
  if (!imageId) return ''

  try {
    return await getSignedUrl(imageId, true) // true for thumbnail
  } catch {
    // Fall back to original URL if signed URL fails
    return artwork.images?.[0]?.thumbnailUrl || ''
  }
}

// Fetch artworks
const fetchArtworks = async () => {
  loading.value = true
  try {
    const data = await api.get<{ artworks: Artwork[] }>('/api/users/me/artworks')
    artworks.value = data.artworks

    // Fetch signed URLs for all artworks (client-side only)
    if (import.meta.client) {
      await Promise.all(
        artworks.value.map(async (artwork) => {
          artwork.signedThumbnailUrl = await fetchSignedThumbnailUrl(artwork)
        })
      )
    }
  } catch (error) {
    console.error('Failed to fetch artworks:', error)
  } finally {
    loading.value = false
  }
}

// Format number with K/M suffix
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

// Get visibility class
const getVisibilityClass = (visibility: string): string => {
  switch (visibility) {
    case 'PUBLIC':
      return 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
    case 'UNLISTED':
      return 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]'
    case 'FOLLOWERS_ONLY':
      return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
    case 'PRIVATE':
      return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
    default:
      return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
  }
}

// Initial fetch
onMounted(() => {
  fetchStats()
  fetchArtworks()
})

// Expose refresh method
defineExpose({
  refresh: () => {
    fetchStats()
    fetchArtworks()
  },
})
</script>
