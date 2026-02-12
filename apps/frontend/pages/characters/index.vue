<template>
  <div class="min-h-screen bg-[var(--color-background)]">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text)]">
            {{ $t('character.fanArtWelcomeSection') }}
          </h1>
          <p class="text-[var(--color-text-muted)] mt-1">
            {{ $t('character.fanArtWelcomeDesc') }}
          </p>
        </div>

        <BaseButton
          v-if="isAuthenticated"
          variant="primary"
          size="md"
          shape="rounded"
          @click="navigateTo('/characters/new')"
        >
          <Icon name="Plus" class="w-5 h-5 mr-2" />
          {{ $t('character.create') }}
        </BaseButton>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="flex justify-center py-12">
        <div
          class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"
        ></div>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="text-center py-12 text-[var(--color-danger-text)]"
      >
        <p>{{ error }}</p>
        <BaseButton
          variant="outline"
          size="md"
          shape="rounded"
          class="mt-4"
          @click="() => fetchCharacters()"
        >
          {{ $t('common.retry') }}
        </BaseButton>
      </div>

      <!-- Characters Grid -->
      <div v-else-if="characters.length > 0">
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
        >
          <CharacterCard
            v-for="character in characters"
            :key="character.id"
            :character="character"
          />
        </div>

        <!-- Load More -->
        <div
          v-if="hasMore"
          class="flex justify-center mt-8"
        >
          <BaseButton
            variant="outline"
            size="lg"
            shape="rounded"
            :loading="isLoadingMore"
            @click="loadMore"
          >
            {{ $t('common.loadMore') }}
          </BaseButton>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16">
        <Icon
          name="User"
          class="w-16 h-16 mx-auto text-[var(--color-text-muted)] mb-4"
        />
        <h2 class="text-xl font-medium text-[var(--color-text)] mb-2">
          {{ $t('character.noCharacters') }}
        </h2>
        <p class="text-[var(--color-text-muted)] mb-6">
          {{ $t('character.noCharactersDesc') }}
        </p>
        <BaseButton
          v-if="isAuthenticated"
          variant="primary"
          size="lg"
          shape="rounded"
          @click="navigateTo('/characters/new')"
        >
          <Icon name="Plus" class="w-5 h-5 mr-2" />
          {{ $t('character.createFirst') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const { t } = useI18n()
const api = useApi()
const { isAuthenticated } = useAuth()

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
  representativeArtwork?: RepresentativeArtwork | null
  allowFanArt: boolean
  fanArtCount: number
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

interface CharactersResponse {
  characters: Character[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const characters = ref<Character[]>([])
const isLoading = ref(true)
const isLoadingMore = ref(false)
const error = ref<string | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)

const hasMore = computed(() => currentPage.value < totalPages.value)

const fetchCharacters = async (append = false) => {
  try {
    if (!append) {
      isLoading.value = true
      currentPage.value = 1
    } else {
      isLoadingMore.value = true
    }
    error.value = null

    const response = await api.get<CharactersResponse>('/api/ocs', {
      params: {
        page: currentPage.value,
        limit: 24,
        fanArtWelcome: true,
      },
    })

    if (append) {
      characters.value = [...characters.value, ...response.characters]
    } else {
      characters.value = response.characters
    }
    totalPages.value = response.pagination.totalPages
  } catch (e: any) {
    console.error('Failed to fetch characters:', e)
    error.value = e.message || t('common.error')
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return
  currentPage.value++
  await fetchCharacters(true)
}

onMounted(() => {
  fetchCharacters()
})

useHead({
  title: () => t('character.fanArtWelcomeSection'),
})
</script>
