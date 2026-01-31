<template>
  <div>
    <!-- Tag Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold mb-2">#{{ tagName }}</h1>
      <p v-if="!loading && !error" class="text-[var(--color-text-muted)]">{{ $t('tags.artworkCount', { count: total }) }}</p>
    </div>

    <!-- Sort Options -->
    <div class="mb-6 flex gap-2 flex-wrap">
      <button
        @click="setSort('latest')"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="
          sortBy === 'latest'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'
        "
      >
        {{ $t('search.sortLatest') }}
      </button>
      <button
        @click="setSort('popular')"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="
          sortBy === 'popular'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'
        "
      >
        {{ $t('search.sortPopular') }}
      </button>
      <button
        @click="setSort('views')"
        class="px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="
          sortBy === 'views'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'
        "
      >
        {{ $t('search.sortViews') }}
      </button>
    </div>

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
      <button
        @click="fetchArtworks"
        class="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- Empty State -->
    <div v-else-if="artworks.length === 0" class="text-center py-12">
      <p class="text-[var(--color-text-muted)] text-lg">{{ $t('tags.noArtworks') }}</p>
    </div>

    <!-- Artwork Grid -->
    <div v-else>
      <ArtworkGrid :artworks="artworks" />

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="mt-8 flex justify-center gap-2">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="px-4 py-2 bg-[var(--color-button-secondary)] rounded-lg hover:bg-[var(--color-button-secondary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ $t('common.previous') }}
        </button>

        <div class="flex gap-1">
          <button
            v-for="page in displayPages"
            :key="page"
            @click="goToPage(page)"
            class="px-4 py-2 rounded-lg transition-colors"
            :class="
              page === currentPage
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'
            "
          >
            {{ page }}
          </button>
        </div>

        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="px-4 py-2 bg-[var(--color-button-secondary)] rounded-lg hover:bg-[var(--color-button-secondary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ $t('common.next') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArtworkCardData } from '~/composables/useArtworkTransform'

definePageMeta({
  layout: 'default',
})

const { t } = useI18n()
const route = useRoute()
const api = useApi()
const { transformArtworks } = useArtworkTransform()

// State
const tagName = computed(() => route.params.name as string)
const artworks = ref<ArtworkCardData[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20
const sortBy = ref<'latest' | 'popular' | 'views'>('latest')

// Computed pagination
const totalPages = computed(() => Math.ceil(total.value / pageSize))
const displayPages = computed(() => {
  const pages = []
  const start = Math.max(1, currentPage.value - 2)
  const end = Math.min(totalPages.value, currentPage.value + 2)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})

// Fetch artworks for this tag
const fetchArtworks = async () => {
  try {
    loading.value = true
    error.value = null

    const response = await api.get<any>(
      `/api/artworks?tags=${tagName.value}&page=${currentPage.value}&limit=${pageSize}&sort=${sortBy.value}`
    )

    // Transform API response using composable
    artworks.value = transformArtworks(response.artworks)

    total.value = response.total || 0
  } catch (e: any) {
    console.error('Failed to fetch artworks:', e)
    error.value = e.message || t('artwork.loadFailed')
    artworks.value = []
  } finally {
    loading.value = false
  }
}

// Sort control
const setSort = (sort: 'latest' | 'popular' | 'views') => {
  sortBy.value = sort
  currentPage.value = 1
  fetchArtworks()
}

// Pagination control
const goToPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
  fetchArtworks()
}

// Fetch on mount and when tag changes
watch(
  () => route.params.name,
  () => {
    currentPage.value = 1
    fetchArtworks()
  },
  { immediate: true }
)
</script>
