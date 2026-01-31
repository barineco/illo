<template>
  <div>
    <!-- Search Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold mb-2">{{ $t('search.title') }}</h1>
      <p v-if="searchQuery" class="text-[var(--color-text-muted)]">
        {{ $t('search.resultsFor', { query: searchQuery, count: total }) }}
      </p>
    </div>

    <!-- Filters -->
    <div class="mb-6 space-y-4">
      <!-- Type Filter -->
      <TabGroup
        v-model="selectedType"
        type="pill"
        :tabs="typeTabs"
      />

      <!-- Sort Options -->
      <TabGroup
        v-model="selectedSort"
        type="pill"
        :tabs="sortTabs"
      />

      <!-- Active Tags -->
      <div v-if="filters.tags && filters.tags.length > 0" class="flex gap-2 flex-wrap items-center">
        <span class="text-sm text-[var(--color-text-muted)]">{{ $t('search.filteringTags') }}</span>
        <TagChip
          v-for="tag in filters.tags"
          :key="tag"
          :tag="tag"
          variant="removable"
          @remove="removeTag"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div
        class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"
      ></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('search.searching') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-[var(--color-danger-text)] mb-4">{{ error }}</p>
      <BaseButton
        variant="primary"
        size="md"
        shape="rounded"
        @click="fetchSearchResults"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Empty State -->
    <div v-else-if="artworks.length === 0" class="text-center py-12">
      <p class="text-[var(--color-text-muted)] text-lg">
        {{ searchQuery ? $t('search.noResults', { query: searchQuery }) : $t('search.enterKeyword') }}
      </p>
    </div>

    <!-- Search Results -->
    <div v-else>
      <ArtworkGrid :artworks="artworks" />

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="mt-8 flex justify-center gap-2">
        <BaseButton
          variant="secondary"
          size="md"
          shape="rounded"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          {{ $t('search.prev') }}
        </BaseButton>

        <div class="flex gap-1">
          <BaseButton
            v-for="page in displayPages"
            :key="page"
            :variant="page === currentPage ? 'primary' : 'secondary'"
            size="md"
            shape="rounded"
            @click="goToPage(page)"
          >
            {{ page }}
          </BaseButton>
        </div>

        <BaseButton
          variant="secondary"
          size="md"
          shape="rounded"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          {{ $t('search.next') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArtworkCardData } from '~/composables/useArtworkTransform'

const { t } = useI18n()

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const { transformArtworks } = useArtworkTransform()

// State
const artworks = ref<ArtworkCardData[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 20

// Search query and filters from route
const searchQuery = computed(() => (route.query.q as string) || '')
const filters = computed(() => ({
  type: route.query.type as 'ILLUSTRATION' | 'MANGA' | undefined,
  tags: route.query.tags ? (route.query.tags as string).split(',') : undefined,
  sort: (route.query.sort as 'latest' | 'popular' | 'views') || 'latest',
}))

// TabGroup用のタブ定義
const typeTabs = computed(() => [
  { value: 'all', label: t('search.all') },
  { value: 'ILLUSTRATION', label: t('search.illustration') },
  { value: 'MANGA', label: t('search.manga') },
])

const sortTabs = computed(() => [
  { value: 'latest', label: t('search.sortLatest') },
  { value: 'popular', label: t('search.sortPopular') },
  { value: 'views', label: t('search.sortViews') },
])

// TabGroup用の選択状態（routeと連動）
const selectedType = computed({
  get: () => filters.value.type || 'all',
  set: (value: string) => {
    const query: any = { ...route.query }
    if (value === 'all') {
      delete query.type
    } else {
      query.type = value
    }
    router.push({ query })
  },
})

const selectedSort = computed({
  get: () => filters.value.sort,
  set: (value: string) => {
    const query: any = { ...route.query, sort: value }
    router.push({ query })
  },
})

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

// Fetch search results
const fetchSearchResults = async () => {
  try {
    loading.value = true
    error.value = null

    // Build query parameters
    const params: any = {
      page: currentPage.value,
      limit: pageSize,
      sort: filters.value.sort,
    }

    if (searchQuery.value) {
      params.q = searchQuery.value
    }

    if (filters.value.type) {
      params.type = filters.value.type
    }

    if (filters.value.tags && filters.value.tags.length > 0) {
      params.tags = filters.value.tags.join(',')
    }

    const response = await api.get<any>('/api/artworks', { params })

    // Transform API response using composable
    artworks.value = transformArtworks(response.artworks)

    total.value = response.total || 0
  } catch (e: any) {
    console.error('Failed to fetch search results:', e)
    error.value = e.message || t('search.searchFailed')
    artworks.value = []
  } finally {
    loading.value = false
  }
}

// Filter controls
const setTypeFilter = (type: 'ILLUSTRATION' | 'MANGA' | null) => {
  const query: any = { ...route.query }

  if (type) {
    query.type = type
  } else {
    delete query.type
  }

  router.push({ query })
}

const setSortFilter = (sort: 'latest' | 'popular' | 'views') => {
  const query: any = { ...route.query, sort }
  router.push({ query })
}

const removeTag = (tag: string) => {
  if (!filters.value.tags) return

  const newTags = filters.value.tags.filter((t) => t !== tag)
  const query: any = { ...route.query }

  if (newTags.length > 0) {
    query.tags = newTags.join(',')
  } else {
    delete query.tags
  }

  router.push({ query })
}

const goToPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
  fetchSearchResults()
}

// Watch for route changes
watch(
  () => route.query,
  () => {
    currentPage.value = 1
    fetchSearchResults()
  },
  { immediate: true }
)
</script>
