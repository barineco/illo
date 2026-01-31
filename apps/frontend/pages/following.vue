<template>
  <div class="max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">{{ $t('home.followingLatest') }}</h1>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-16">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="artworks.length === 0" class="text-center py-16">
      <p class="text-[var(--color-text-muted)] text-lg mb-4">{{ $t('home.noFollowingYet') }}</p>
      <NuxtLink
        to="/"
        class="inline-block px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-full font-medium transition-colors"
      >
        {{ $t('home.findWorks') }}
      </NuxtLink>
    </div>

    <!-- Artworks Grid -->
    <ArtworkGrid v-else :artworks="artworks" />

    <!-- Load More Button -->
    <div v-if="!isLoading && artworks.length > 0 && hasMore" class="text-center mt-8 mb-4">
      <BaseButton
        variant="primary"
        size="lg"
        shape="rounded"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? $t('common.loading') : $t('home.loadMore') }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArtworkCardData, ApiArtworkResponse } from '~/composables/useArtworkTransform'

definePageMeta({
  middleware: 'auth', // Require authentication
})

interface FollowingArtworksResponse {
  artworks: ApiArtworkResponse[]
  total: number
}

const api = useApi()
const { transformArtworks } = useArtworkTransform()
const isLoading = ref(true)
const loadingMore = ref(false)
const artworks = ref<ArtworkCardData[]>([])
const currentPage = ref(1)
const hasMore = ref(true)
const limit = 20

const fetchFollowingArtworks = async (append = false) => {
  try {
    if (append) {
      loadingMore.value = true
    } else {
      isLoading.value = true
      currentPage.value = 1
      hasMore.value = true
    }

    const response = await api.get<FollowingArtworksResponse>('/api/artworks/following', {
      params: {
        page: currentPage.value,
        limit,
      },
    })

    // Transform API response using composable
    const newArtworks = transformArtworks(response.artworks)
    artworks.value = append ? [...artworks.value, ...newArtworks] : newArtworks
    hasMore.value = newArtworks.length === limit
  } catch (error) {
    console.error('Failed to fetch following artworks:', error)
    if (!append) {
      artworks.value = []
    }
  } finally {
    isLoading.value = false
    loadingMore.value = false
  }
}

const loadMore = async () => {
  currentPage.value++
  await fetchFollowingArtworks(true)
}

onMounted(() => {
  fetchFollowingArtworks()
})
</script>
