<template>
  <div class="min-h-screen bg-[var(--color-background)]">
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-24">
      <div
        class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"
      ></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="text-center py-24 text-[var(--color-danger-text)]"
    >
      <Icon name="ExclamationCircle" class="w-16 h-16 mx-auto mb-4" />
      <p class="text-lg">{{ error }}</p>
      <BaseButton
        variant="outline"
        size="md"
        shape="rounded"
        class="mt-4"
        @click="navigateTo('/characters')"
      >
        {{ $t('common.back') }}
      </BaseButton>
    </div>

    <!-- Content -->
    <div v-else-if="character" class="max-w-5xl mx-auto px-4 py-8">
      <!-- Back Button -->
      <div class="mb-6">
        <button
          type="button"
          class="inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          @click="goBack"
        >
          <Icon name="ArrowLeft" class="w-5 h-5" />
          {{ $t('common.back') }}
        </button>
      </div>

      <!-- Header -->
      <div class="bg-[var(--color-surface)] rounded-xl p-6 mb-6">
        <div class="flex flex-col md:flex-row gap-6">
          <!-- Avatar (from representative artwork) -->
          <div class="flex-shrink-0">
            <div
              class="w-32 h-32 md:w-48 md:h-48 rounded-xl overflow-hidden bg-[var(--color-surface-hover)]"
            >
              <img
                v-if="avatarImageUrl"
                :src="avatarImageUrl"
                :alt="character.name"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]"
              >
                <Icon name="User" class="w-16 h-16" />
              </div>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1">
            <div class="flex items-start justify-between">
              <div>
                <h1 class="text-2xl md:text-3xl font-bold text-[var(--color-text)]">
                  {{ character.name }}
                </h1>

                <!-- Fan Art Welcome Badge -->
                <div
                  v-if="character.allowFanArt"
                  class="inline-flex items-center gap-1 mt-2 bg-[var(--color-primary)] text-white text-sm px-3 py-1 rounded-full"
                >
                  <Icon name="Heart" class="w-4 h-4" />
                  {{ $t('character.fanArtWelcome') }}
                </div>
              </div>

              <!-- Edit Button -->
              <BaseButton
                v-if="isOwner"
                variant="outline"
                size="sm"
                shape="rounded"
                @click="navigateTo(`/characters/${character.id}/edit`)"
              >
                <Icon name="Pencil" class="w-4 h-4 mr-2" />
                {{ $t('character.edit') }}
              </BaseButton>
            </div>

            <!-- Creator -->
            <NuxtLink
              :to="`/users/${character.creator?.username}`"
              class="inline-flex items-center gap-2 mt-4 hover:opacity-80"
            >
              <img
                v-if="character.creator?.avatarUrl"
                :src="character.creator.avatarUrl"
                :alt="character.creator.displayName || character.creator.username"
                class="w-8 h-8 rounded-full object-cover"
              />
              <div
                v-else
                class="w-8 h-8 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center"
              >
                <Icon name="User" class="w-4 h-4 text-[var(--color-text-muted)]" />
              </div>
              <div>
                <p class="text-sm text-[var(--color-text-muted)]">
                  {{ $t('character.createdBy') }}
                </p>
                <p class="font-medium text-[var(--color-text)]">
                  {{ character.creator?.displayName || character.creator?.username }}
                </p>
              </div>
            </NuxtLink>

            <!-- Description -->
            <p
              v-if="character.description"
              class="mt-4 text-[var(--color-text)] whitespace-pre-wrap"
            >
              {{ character.description }}
            </p>

            <!-- Tags -->
            <div
              v-if="character.tags && character.tags.length > 0"
              class="flex flex-wrap gap-2 mt-4"
            >
              <span
                v-for="tag in character.tags"
                :key="tag"
                class="px-3 py-1 bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] text-sm rounded-full"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Guidelines -->
      <div
        v-if="character.allowFanArt"
        class="bg-[var(--color-surface)] rounded-xl p-6 mb-6"
      >
        <h2 class="text-lg font-semibold text-[var(--color-text)] mb-4">
          {{ $t('character.guidelines.title') }}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- R18 -->
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                character.allowR18
                  ? 'bg-green-100 text-green-600'
                  : 'bg-red-100 text-red-600',
              ]"
            >
              <Icon :name="character.allowR18 ? 'Check' : 'XMark'" class="w-5 h-5" />
            </div>
            <div>
              <p class="font-medium text-[var(--color-text)]">
                {{ $t('character.guidelines.r18') }}
              </p>
              <p class="text-sm text-[var(--color-text-muted)]">
                {{ character.allowR18 ? 'OK' : 'NG' }}
              </p>
            </div>
          </div>

          <!-- Commercial -->
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                character.allowCommercial
                  ? 'bg-green-100 text-green-600'
                  : 'bg-red-100 text-red-600',
              ]"
            >
              <Icon :name="character.allowCommercial ? 'Check' : 'XMark'" class="w-5 h-5" />
            </div>
            <div>
              <p class="font-medium text-[var(--color-text)]">
                {{ $t('character.guidelines.commercial') }}
              </p>
              <p class="text-sm text-[var(--color-text-muted)]">
                {{ character.allowCommercial ? 'OK' : 'NG' }}
              </p>
            </div>
          </div>

          <!-- Credit -->
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                character.requireCredit
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-gray-100 text-gray-600',
              ]"
            >
              <Icon name="AtSymbol" class="w-5 h-5" />
            </div>
            <div>
              <p class="font-medium text-[var(--color-text)]">
                {{ $t('character.guidelines.credit') }}
              </p>
              <p class="text-sm text-[var(--color-text-muted)]">
                {{
                  character.requireCredit
                    ? $t('character.guidelines.creditRequired')
                    : $t('character.guidelines.optional')
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Free Text Guidelines -->
        <p
          v-if="character.guidelines"
          class="mt-4 text-[var(--color-text)] p-4 bg-[var(--color-surface-hover)] rounded-lg whitespace-pre-wrap"
        >
          {{ character.guidelines }}
        </p>
      </div>

      <!-- Reference Materials (now using artwork references) -->
      <div
        v-if="
          (character.referenceArtworks && character.referenceArtworks.length > 0) ||
          character.referenceNotes
        "
        class="bg-[var(--color-surface)] rounded-xl p-6 mb-6"
      >
        <h2 class="text-lg font-semibold text-[var(--color-text)] mb-4">
          {{ $t('character.reference.title') }}
        </h2>

        <!-- Reference Notes -->
        <p
          v-if="character.referenceNotes"
          class="text-[var(--color-text)] mb-4 whitespace-pre-wrap"
        >
          {{ character.referenceNotes }}
        </p>

        <!-- Reference Artworks Grid -->
        <div
          v-if="character.referenceArtworks && character.referenceArtworks.length > 0"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <NuxtLink
            v-for="ref in character.referenceArtworks"
            :key="ref.id"
            :to="`/artworks/${ref.artwork.id}`"
            class="relative group"
          >
            <img
              :src="getArtworkThumbnail(ref.artwork)"
              :alt="ref.caption || ref.artwork.title || 'Reference artwork'"
              class="w-full aspect-square object-cover rounded-lg"
            />
            <p
              v-if="ref.caption"
              class="mt-1 text-sm text-[var(--color-text-muted)] truncate"
            >
              {{ ref.caption }}
            </p>
          </NuxtLink>
        </div>
      </div>

      <!-- Fan Arts Section -->
      <div class="bg-[var(--color-surface)] rounded-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-[var(--color-text)]">
            {{ $t('character.fanArts') }}
          </h2>
          <span class="text-[var(--color-text-muted)]">
            {{ $t('character.fanArtCount', { count: fanArtCount }) }}
          </span>
        </div>

        <!-- Fan Arts Loading -->
        <div v-if="isLoadingFanArts" class="flex justify-center py-8">
          <div
            class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"
          ></div>
        </div>

        <!-- Fan Arts Grid -->
        <div v-else-if="fanArts.length > 0">
          <div
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            <ArtworkCard
              v-for="artwork in fanArts"
              :key="artwork.id"
              :artwork="artwork"
            />
          </div>

          <!-- Load More -->
          <div
            v-if="hasMoreFanArts"
            class="flex justify-center mt-6"
          >
            <BaseButton
              variant="outline"
              size="md"
              shape="rounded"
              :loading="isLoadingMoreFanArts"
              @click="loadMoreFanArts"
            >
              {{ $t('common.loadMore') }}
            </BaseButton>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="py-8">
          <!-- Positive Message -->
          <div class="text-center text-[var(--color-text-muted)] mb-8">
            <Icon name="Photo" class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p v-if="isOwner">{{ $t('character.noFanArtsCreator') }}</p>
            <p v-else-if="character.allowFanArt">{{ $t('character.noFanArtsPositive') }}</p>
            <p v-else>{{ $t('character.noFanArts') }}</p>

            <!-- CTA Button -->
            <BaseButton
              v-if="user && character.allowFanArt && !isOwner"
              variant="primary"
              size="md"
              shape="rounded"
              class="mt-4"
              @click="navigateTo(`/upload?characterId=${character.id}`)"
            >
              <Icon name="Photo" class="w-4 h-4 mr-2" />
              {{ $t('character.postFanArt') }}
            </BaseButton>
          </div>

          <!-- Creator's Other Works -->
          <div v-if="creatorArtworks.length > 0" class="mb-8">
            <h3 class="text-base font-medium text-[var(--color-text)] mb-4">
              {{ $t('character.creatorOtherWorks', { name: character.creator?.displayName || character.creator?.username }) }}
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <ArtworkCard
                v-for="artwork in creatorArtworks"
                :key="artwork.id"
                :artwork="artwork"
              />
            </div>
          </div>

          <!-- Other Fan Art Welcome Characters -->
          <div v-if="otherFanArtWelcomeCharacters.length > 0">
            <h3 class="text-base font-medium text-[var(--color-text)] mb-4">
              {{ $t('character.otherFanArtWelcome') }}
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CharacterCard
                v-for="char in otherFanArtWelcomeCharacters"
                :key="char.id"
                :character="char"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArtworkCardData, ApiArtworkResponse } from '~/composables/useArtworkTransform'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const api = useApi()
const { user } = useAuth()
const { transformArtworks } = useArtworkTransform()
const { getSignedUrl } = useSignedImageUrlOnce()

const characterId = computed(() => route.params.id as string)

interface ArtworkImage {
  id: string
  url?: string | null
  thumbnailUrl?: string | null
}

interface ReferenceArtwork {
  id: string
  title?: string
  images?: ArtworkImage[]
}

interface CharacterReferenceArtwork {
  id: string
  artworkId: string
  artwork: ReferenceArtwork
  order: number
  caption?: string | null
}

interface RepresentativeArtwork {
  id: string
  title?: string
  images?: ArtworkImage[]
}

interface Character {
  id: string
  name: string
  description?: string | null
  representativeArtwork?: RepresentativeArtwork | null
  allowFanArt: boolean
  fanArtPermission: 'EVERYONE' | 'FOLLOWERS_ONLY'
  allowR18: boolean
  allowCommercial: boolean
  requireCredit: boolean
  guidelines?: string | null
  referenceNotes?: string | null
  referenceVisibility: 'PUBLIC' | 'UNLISTED' | 'FOLLOWERS_ONLY' | 'PRIVATE'
  tags: string[]
  fanArtCount: number
  referenceArtworks: CharacterReferenceArtwork[]
  _count?: {
    fanArts: number
  }
  creator?: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl?: string | null
    bio?: string | null
  }
  createdAt: string
  updatedAt: string
}

interface FanArtsResponse {
  artworks: ApiArtworkResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

const character = ref<Character | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const fanArts = ref<ArtworkCardData[]>([])
const isLoadingFanArts = ref(false)
const isLoadingMoreFanArts = ref(false)
const fanArtPage = ref(1)
const fanArtTotalPages = ref(1)

// Empty state data
const creatorArtworks = ref<ArtworkCardData[]>([])
interface FanArtWelcomeCharacter {
  id: string
  name: string
  allowFanArt: boolean
  fanArtCount?: number
  _count?: { fanArts: number }
  representativeArtwork?: RepresentativeArtwork | null
  creator?: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl?: string | null
  }
}
const otherFanArtWelcomeCharacters = ref<FanArtWelcomeCharacter[]>([])

const isOwner = computed(() => {
  return user.value?.id === character.value?.creator?.id
})

// Signed URL for avatar image
const avatarImageUrl = ref<string | null>(null)

// Get first image ID from representative artwork
const avatarImageId = computed(() => {
  const artwork = character.value?.representativeArtwork
  if (!artwork?.images?.length) return null
  return artwork.images[0].id
})

// Fetch signed URL for avatar when character is loaded
const fetchAvatarSignedUrl = async () => {
  if (avatarImageId.value) {
    try {
      avatarImageUrl.value = await getSignedUrl(avatarImageId.value, true)
    } catch {
      // Fall back to raw URL if signed URL fails
      const artwork = character.value?.representativeArtwork
      if (artwork?.images?.length) {
        const firstImage = artwork.images[0]
        avatarImageUrl.value = firstImage.thumbnailUrl || firstImage.url || null
      }
    }
  } else {
    avatarImageUrl.value = null
  }
}

const fanArtCount = computed(() => {
  return character.value?.fanArtCount || character.value?._count?.fanArts || 0
})

const hasMoreFanArts = computed(() => fanArtPage.value < fanArtTotalPages.value)

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    navigateTo('/characters')
  }
}

// Signed URL cache for reference artworks
const referenceArtworkUrls = ref<Map<string, string>>(new Map())

// Fetch signed URLs for reference artworks
const fetchReferenceArtworkUrls = async () => {
  const refs = character.value?.referenceArtworks
  if (!refs?.length) return

  for (const ref of refs) {
    const artwork = ref.artwork
    if (!artwork?.images?.length) continue
    const imageId = artwork.images[0].id
    if (referenceArtworkUrls.value.has(imageId)) continue

    try {
      const signedUrl = await getSignedUrl(imageId, true)
      referenceArtworkUrls.value.set(imageId, signedUrl)
    } catch {
      // Fall back to raw URL
      const firstImage = artwork.images[0]
      referenceArtworkUrls.value.set(imageId, firstImage.thumbnailUrl || firstImage.url || '')
    }
  }
}

const getArtworkThumbnail = (artwork: ReferenceArtwork): string => {
  if (!artwork.images?.length) return ''
  const imageId = artwork.images[0].id
  // Use cached signed URL if available
  return referenceArtworkUrls.value.get(imageId) || artwork.images[0].thumbnailUrl || artwork.images[0].url || ''
}

const fetchCharacter = async () => {
  try {
    isLoading.value = true
    error.value = null

    character.value = await api.get<Character>(`/api/ocs/${characterId.value}`)
  } catch (e: any) {
    console.error('Failed to fetch character:', e)
    error.value = e.message || t('common.error')
  } finally {
    isLoading.value = false
  }
}

const fetchFanArts = async (append = false) => {
  try {
    if (!append) {
      isLoadingFanArts.value = true
      fanArtPage.value = 1
    } else {
      isLoadingMoreFanArts.value = true
    }

    const response = await api.get<FanArtsResponse>(
      `/api/ocs/${characterId.value}/fan-arts`,
      {
        params: {
          page: fanArtPage.value,
          limit: 12,
        },
      }
    )

    const transformed = transformArtworks(response.artworks)
    if (append) {
      fanArts.value = [...fanArts.value, ...transformed]
    } else {
      fanArts.value = transformed
    }
    fanArtTotalPages.value = response.pagination.totalPages
  } catch (e: any) {
    console.error('Failed to fetch fan arts:', e)
  } finally {
    isLoadingFanArts.value = false
    isLoadingMoreFanArts.value = false
  }
}

const loadMoreFanArts = async () => {
  if (isLoadingMoreFanArts.value || !hasMoreFanArts.value) return
  fanArtPage.value++
  await fetchFanArts(true)
}

// Fetch creator's other artworks (for empty state)
const fetchCreatorArtworks = async () => {
  try {
    const artworks = await api.get<ApiArtworkResponse[]>(
      `/api/ocs/${characterId.value}/creator-artworks`,
      { params: { limit: 4 } }
    )
    creatorArtworks.value = transformArtworks(artworks)
  } catch (e) {
    console.error('Failed to fetch creator artworks:', e)
  }
}

// Fetch other fan art welcome characters (for empty state)
const fetchOtherFanArtWelcomeCharacters = async () => {
  try {
    const characters = await api.get<FanArtWelcomeCharacter[]>(
      '/api/ocs/fan-art-welcome',
      { params: { limit: 5 } }
    )
    // Filter out current character
    otherFanArtWelcomeCharacters.value = characters
      .filter((c) => c.id !== characterId.value)
      .slice(0, 4)
  } catch (e) {
    console.error('Failed to fetch fan art welcome characters:', e)
  }
}

onMounted(async () => {
  await fetchCharacter()
  if (character.value) {
    // Fetch signed URLs for images
    await Promise.all([
      fetchAvatarSignedUrl(),
      fetchReferenceArtworkUrls(),
      fetchFanArts(),
    ])

    // If no fan arts, fetch empty state data
    if (fanArts.value.length === 0) {
      await Promise.all([
        fetchCreatorArtworks(),
        fetchOtherFanArtWelcomeCharacters(),
      ])
    }
  }
})

useHead({
  title: () =>
    character.value
      ? `${character.value.name} - ${t('character.pageTitle')}`
      : t('character.pageTitle'),
})
</script>
