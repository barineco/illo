<template>
  <div>
    <!-- Category Tabs -->
    <div class="mb-6 overflow-x-auto pb-2">
      <TabGroup
        v-model="selectedCategory"
        type="pill"
        :tabs="categoryTabs"
      />
    </div>

    <!-- Section Title -->
    <h2 class="text-2xl font-bold mb-6">
      {{
        selectedCategory === 'following'
          ? $t('home.followingWorks')
          : selectedCategory === 'local'
          ? $t('home.localWorks')
          : $t('home.recommendedWorks')
      }}
    </h2>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-surface-secondary)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-[var(--color-danger-text)] mb-4">{{ error }}</p>
      <BaseButton
        variant="primary"
        size="md"
        shape="rounded"
        @click="fetchArtworks"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Empty State for Following Tab -->
    <div v-else-if="selectedCategory === 'following' && artworks.length === 0" class="text-center py-16">
      <p class="text-[var(--color-text-muted)] text-lg mb-4">{{ $t('home.noFollowingWorks') }}</p>
      <BaseButton
        variant="primary"
        size="lg"
        shape="pill"
        @click="navigateTo('/search')"
      >
        {{ $t('home.findUsers') }}
      </BaseButton>
    </div>

    <!-- General Empty State -->
    <div v-else-if="artworks.length === 0" class="text-center py-12">
      <p class="text-[var(--color-text-muted)] text-lg">{{ $t('home.noWorksYet') }}</p>
      <BaseButton
        variant="primary"
        size="lg"
        shape="rounded"
        class="mt-4"
        @click="navigateTo('/upload')"
      >
        {{ $t('home.postFirstWork') }}
      </BaseButton>
    </div>

    <!-- Artwork Grid -->
    <ArtworkGrid v-else :artworks="artworks" />

    <!-- Load More Button -->
    <div v-if="!loading && artworks.length > 0 && hasMore" class="text-center mt-8 mb-4">
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

    <!-- Fan Art Welcome Section -->
    <div v-if="fanArtWelcomeCharacters.length > 0" class="mt-12">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-[var(--color-text)]">
          {{ $t('character.fanArtWelcomeSection') }}
        </h2>
        <NuxtLink
          to="/characters"
          class="text-[var(--color-primary)] hover:underline text-sm font-medium"
        >
          {{ $t('character.viewMore') }}
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <CharacterCard
          v-for="character in fanArtWelcomeCharacters"
          :key="character.id"
          :character="character"
        />
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

const api = useApi()
const { isAuthenticated } = useAuth()
const { transformArtworks } = useArtworkTransform()

// Fan Art Welcome Characters
interface Character {
  id: string
  name: string
  avatarUrl?: string | null
  avatarThumbnailUrl?: string | null
  allowFanArt: boolean
  fanArtCount: number
  creator?: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl?: string | null
  }
}

const fanArtWelcomeCharacters = ref<Character[]>([])

// Categories change based on authentication status
const categories = computed(() => {
  if (isAuthenticated.value) {
    return ['following', 'all', 'local', 'illustration', 'manga']
  }
  return ['all', 'local', 'illustration', 'manga']
})

// TabGroup用のtabs形式に変換
const categoryTabs = computed(() => {
  const labelMap: Record<string, string> = {
    following: t('home.following'),
    all: t('home.all'),
    local: t('home.local'),
    illustration: t('home.illustration'),
    manga: t('home.manga'),
  }
  return categories.value.map(cat => ({
    value: cat,
    label: labelMap[cat] || cat,
  }))
})

// Default to 'all' when not authenticated, 'following' when authenticated
const selectedCategory = ref(isAuthenticated.value ? 'following' : 'all')
const artworks = ref<ArtworkCardData[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const currentPage = ref(1)
const hasMore = ref(true)

// Fetch artworks from API
const fetchArtworks = async (append = false) => {
  try {
    if (append) {
      loadingMore.value = true
    } else {
      loading.value = true
      currentPage.value = 1
      hasMore.value = true
    }
    error.value = null

    const limit = 20

    // Following tab
    if (selectedCategory.value === 'following') {
      if (!isAuthenticated.value) {
        artworks.value = []
        loading.value = false
        return
      }

      const response = await api.get<any>('/api/artworks/following', {
        params: {
          page: currentPage.value,
          limit,
        },
      })

      const newArtworks = transformArtworks(response.artworks)
      artworks.value = append ? [...artworks.value, ...newArtworks] : newArtworks
      hasMore.value = newArtworks.length === limit
      loading.value = false
      loadingMore.value = false
      return
    }

    // Other tabs
    const params: any = {
      page: currentPage.value,
      limit,
      sort: 'latest',
    }

    // Type filter
    if (selectedCategory.value === 'illustration') {
      params.type = 'ILLUSTRATION'
    } else if (selectedCategory.value === 'manga') {
      params.type = 'MANGA'
    }

    // Federation filter
    if (selectedCategory.value === 'local') {
      params.federation = 'local'
    } else if (selectedCategory.value === 'all') {
      params.federation = 'all'
    } else if (selectedCategory.value === 'illustration' || selectedCategory.value === 'manga') {
      params.federation = 'all'
    }

    console.log('Fetching artworks with params:', params)
    const response = await api.get<any>('/api/artworks', { params })
    console.log('Received response:', response)

    const newArtworks = transformArtworks(response.artworks)
    artworks.value = append ? [...artworks.value, ...newArtworks] : newArtworks
    hasMore.value = newArtworks.length === limit
  } catch (e: any) {
    console.error('Failed to fetch artworks:', e)
    error.value = e.message || t('common.error')
    if (!append) {
      artworks.value = []
    }
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// Load more artworks
const loadMore = async () => {
  currentPage.value++
  await fetchArtworks(true)
}

// Fetch fan art welcome characters
const fetchFanArtWelcomeCharacters = async () => {
  try {
    const response = await api.get<{ characters: Character[] }>('/api/ocs', {
      params: {
        fanArtWelcome: true,
        limit: 6,
      },
    })
    fanArtWelcomeCharacters.value = response.characters
  } catch (e) {
    console.error('Failed to fetch fan art welcome characters:', e)
  }
}

// Fetch artworks on mount
onMounted(() => {
  fetchArtworks()
  fetchFanArtWelcomeCharacters()
})

// Watch category changes
watch(selectedCategory, () => {
  fetchArtworks()
})
</script>
