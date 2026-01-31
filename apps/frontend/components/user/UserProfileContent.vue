<template>
  <div>
    <!-- Artworks Tab -->
    <div v-if="selectedTab === 'artworks'">
      <!-- Sort Options -->
      <div v-if="artworks.length > 0" class="mb-4 flex gap-2 flex-wrap">
        <button
          v-for="tab in sortTabs"
          :key="tab.value"
          type="button"
          :class="[
            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
            artworkSort === tab.value
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-button-secondary)] text-[var(--color-text)] hover:bg-[var(--color-button-secondary-hover)]',
          ]"
          @click="onSortChange(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="isLoadingSortedArtworks" class="text-center py-16">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
        <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
      </div>
      <div v-else-if="displayedArtworks.length === 0" class="text-center py-16">
        <p class="text-[var(--color-text-muted)] text-lg mb-4">{{ $t('user.noWorksYet') }}</p>
        <BaseButton
          v-if="isOwnProfile"
          variant="primary"
          size="lg"
          shape="pill"
          @click="navigateTo('/upload')"
        >
          {{ $t('home.postFirstWork') }}
        </BaseButton>
      </div>
      <ArtworkGrid v-else :artworks="displayedArtworks" />

      <!-- Load More Button for Artworks -->
      <div v-if="!isLoadingSortedArtworks && displayedArtworks.length > 0 && hasMoreArtworks" class="text-center mt-8 mb-4">
        <BaseButton
          variant="primary"
          size="lg"
          shape="rounded"
          :disabled="loadingMoreArtworks"
          @click="loadMoreArtworks"
        >
          {{ loadingMoreArtworks ? $t('common.loading') : $t('home.loadMore') }}
        </BaseButton>
      </div>
    </div>

    <!-- Collections Tab -->
    <div v-else-if="selectedTab === 'collections'">
      <div v-if="isLoadingCollections" class="text-center py-16">
        <p class="text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
      </div>
      <div v-else-if="collections.length === 0" class="text-center py-16">
        <p class="text-[var(--color-text-muted)] text-lg mb-4">{{ $t('user.noCollectionsYet') }}</p>
        <BaseButton
          v-if="isOwnProfile"
          variant="primary"
          size="lg"
          shape="pill"
          @click="navigateTo('/')"
        >
          {{ $t('user.findAndCreateCollection') }}
        </BaseButton>
      </div>
      <div v-else class="space-y-6">
        <!-- Each collection as a row -->
        <div
          v-for="collection in collections"
          :key="collection.id"
          class="bg-[var(--color-surface)] rounded-lg p-4"
        >
          <!-- Collection Header -->
          <div class="flex items-center justify-between mb-4">
            <NuxtLink
              :to="`/collections/${collection.id}`"
              class="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div class="w-8 h-8 bg-[var(--color-surface-secondary)] rounded flex items-center justify-center text-[var(--color-text-muted)]">
                <Icon name="FolderOpen" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-bold hover:text-[var(--color-primary)] transition-colors">{{ collection.title }}</h3>
                <p class="text-sm text-[var(--color-text-muted)]">{{ $t('user.collectionCount', { count: collection.artworkCount }) }}</p>
              </div>
            </NuxtLink>
            <NuxtLink
              :to="`/collections/${collection.id}`"
              class="text-sm text-[var(--color-primary)] hover:underline"
            >
              {{ $t('user.viewAll') }}
            </NuxtLink>
          </div>

          <!-- Description if exists -->
          <p v-if="collection.description" class="text-sm text-[var(--color-text-muted)] mb-4 line-clamp-2">
            {{ collection.description }}
          </p>

          <!-- Artwork Preview Row -->
          <div v-if="collection.artworks && collection.artworks.length > 0" class="flex gap-2 overflow-x-auto p-1 -m-1">
            <NuxtLink
              v-for="ca in collection.artworks.slice(0, 6)"
              :key="ca.artwork.id"
              :to="`/artworks/${ca.artwork.id}`"
              class="flex-shrink-0 w-32 aspect-square rounded-lg overflow-hidden bg-[var(--color-surface-secondary)] hover:ring-2 hover:ring-[var(--color-primary)] transition-all"
            >
              <img
                v-if="ca.artwork.images && ca.artwork.images[0]"
                :src="getCollectionArtworkUrl(ca.artwork.id, ca.artwork.images[0].id, ca.artwork.images[0].thumbnailUrl || ca.artwork.images[0].url || '')"
                :alt="ca.artwork.title"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                <Icon name="Photo" class="w-8 h-8" />
              </div>
            </NuxtLink>
            <!-- Show more indicator -->
            <NuxtLink
              v-if="collection.artworkCount > 6"
              :to="`/collections/${collection.id}`"
              class="flex-shrink-0 w-32 aspect-square rounded-lg bg-[var(--color-surface-secondary)] flex items-center justify-center hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <span class="text-[var(--color-text-muted)]">+{{ collection.artworkCount - 6 }}</span>
            </NuxtLink>
          </div>

          <!-- Empty collection -->
          <div v-else class="text-center py-8 text-[var(--color-text-muted)]">
            {{ $t('user.noWorksYet') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Likes Tab -->
    <div v-else-if="selectedTab === 'likes'">
      <div v-if="isLoadingLikes" class="text-center py-16">
        <p class="text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
      </div>
      <div v-else-if="likedArtworks.length === 0" class="text-center py-16">
        <p class="text-[var(--color-text-muted)] text-lg">{{ $t('user.noLikesYet') }}</p>
      </div>
      <ArtworkGrid v-else :artworks="likedArtworks" />

      <!-- Load More Button for Likes -->
      <div v-if="!isLoadingLikes && likedArtworks.length > 0 && hasMoreLikes" class="text-center mt-8 mb-4">
        <BaseButton
          variant="primary"
          size="lg"
          shape="rounded"
          :disabled="loadingMoreLikes"
          @click="loadMoreLikes"
        >
          {{ loadingMoreLikes ? $t('common.loading') : $t('home.loadMore') }}
        </BaseButton>
      </div>
    </div>

    <!-- Bookmarks Tab -->
    <div v-else-if="selectedTab === 'bookmarks'">
      <div v-if="isLoadingBookmarks" class="text-center py-16">
        <p class="text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
      </div>
      <div v-else-if="bookmarkedArtworks.length === 0" class="text-center py-16">
        <p class="text-[var(--color-text-muted)] text-lg mb-4">{{ $t('user.noBookmarksYet') }}</p>
        <BaseButton
          variant="primary"
          size="lg"
          shape="pill"
          @click="navigateTo('/')"
        >
          {{ $t('home.findWorks') }}
        </BaseButton>
      </div>
      <ArtworkGrid v-else :artworks="bookmarkedArtworks" />

      <!-- Load More Button for Bookmarks -->
      <div v-if="!isLoadingBookmarks && bookmarkedArtworks.length > 0 && hasMoreBookmarks" class="text-center mt-8 mb-4">
        <BaseButton
          variant="primary"
          size="lg"
          shape="rounded"
          :disabled="loadingMoreBookmarks"
          @click="loadMoreBookmarks"
        >
          {{ loadingMoreBookmarks ? $t('common.loading') : $t('home.loadMore') }}
        </BaseButton>
      </div>
    </div>

    <!-- Followers Section (shown when activeStat is 'followers') -->
    <div v-if="activeStat === 'followers'">
      <UserList
        :users="followers"
        :loading="isLoadingFollowers"
        :emptyMessage="$t('user.noFollowersYet')"
        :showFollowButton="true"
        @followToggle="handleFollowToggle"
      />
    </div>

    <!-- Following Section (shown when activeStat is 'following') -->
    <div v-if="activeStat === 'following'">
      <UserList
        :users="following"
        :loading="isLoadingFollowing"
        :emptyMessage="$t('user.noFollowingYet')"
        :showFollowButton="true"
        @followToggle="handleFollowToggle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ArtworkCardData } from '~/composables/useArtworkTransform'

// Extended type for artwork display with optional isDeleted
type ArtworkCardInput = ArtworkCardData & { isDeleted?: boolean }

interface Collection {
  id: string
  title: string
  description?: string
  artworkCount: number
  artworks?: {
    artwork: {
      id: string
      title: string
      images: { id: string; thumbnailUrl?: string; url?: string }[]
    }
  }[]
}

interface UserInList {
  id: string
  username: string
  domain?: string | null
  displayName?: string
  avatarUrl?: string
  isFollowing?: boolean
}

const props = defineProps<{
  selectedTab: string
  username: string
  userHandle: string
  isOwnProfile: boolean
  artworks: ArtworkCardInput[]
  activeStat?: 'following' | 'followers' | null
}>()

const emit = defineEmits<{
  (e: 'updateFollowingCount', delta: number): void
}>()

const { t } = useI18n()
const api = useApi()
const { isAuthenticated } = useAuth()
const { transformArtworks } = useArtworkTransform()
const { getSignedUrl } = useSignedImageUrlOnce()

// Creation date sort order (true = DESC/newest first, false = ASC/oldest first)
const creationDateSortDesc = ref(true)

// Sort tabs for TabGroup - creation date is a single tab with toggle behavior
const sortTabs = computed(() => [
  { value: 'latest', label: t('sort.latest') },
  {
    value: 'creationDate',
    label: `${t('sort.creationDate')} ${creationDateSortDesc.value ? '▼' : '▲'}`,
  },
  { value: 'popular', label: t('sort.popular') },
  { value: 'views', label: t('sort.views') },
])

// Artwork sort state
const artworkSort = ref<'latest' | 'creationDate' | 'popular' | 'views'>('latest')
const sortedArtworks = ref<ArtworkCardInput[]>([])
const isLoadingSortedArtworks = ref(false)
const hasFetchedSortedArtworks = ref(false)
const loadingMoreArtworks = ref(false)
const artworkPage = ref(1)
const artworkLimit = 20

// Check if initial data suggests more pages exist
const hasMoreArtworks = computed(() => {
  // If we're on latest sort and haven't fetched yet, check initial data length
  if (artworkSort.value === 'latest' && !hasFetchedSortedArtworks.value) {
    return props.artworks.length >= artworkLimit
  }
  // After fetching, check the last fetch result
  return sortedArtworks.value.length > 0 && sortedArtworks.value.length % artworkLimit === 0
})

const displayedArtworks = computed(() => {
  if (artworkSort.value === 'latest' && !hasFetchedSortedArtworks.value) {
    return props.artworks
  }
  return sortedArtworks.value
})

const fetchSortedArtworks = async (append = false) => {
  try {
    if (append) {
      loadingMoreArtworks.value = true
    } else {
      isLoadingSortedArtworks.value = true
      artworkPage.value = 1
    }

    let apiSort: string = artworkSort.value
    if (artworkSort.value === 'creationDate') {
      apiSort = creationDateSortDesc.value ? 'creationDateDesc' : 'creationDateAsc'
    }

    const response = await api.get<any>(`/api/artworks/user/${props.username}`, {
      params: {
        page: append ? artworkPage.value : 1,
        limit: artworkLimit,
        sort: apiSort,
      },
    })

    const newArtworks = transformArtworks(response.artworks)

    if (append) {
      // For Load More: append to existing data
      sortedArtworks.value = [...sortedArtworks.value, ...newArtworks]
    } else {
      // For sort change: replace all data
      sortedArtworks.value = newArtworks
    }

    hasFetchedSortedArtworks.value = true
  } catch (error) {
    console.error('Failed to fetch sorted artworks:', error)
    if (!append) {
      sortedArtworks.value = props.artworks
    }
  } finally {
    isLoadingSortedArtworks.value = false
    loadingMoreArtworks.value = false
  }
}

const onSortChange = (newValue: string) => {
  if (newValue === 'creationDate' && artworkSort.value === 'creationDate') {
    creationDateSortDesc.value = !creationDateSortDesc.value
  }
  artworkSort.value = newValue as typeof artworkSort.value
  fetchSortedArtworks()
}

const loadMoreArtworks = async () => {
  // If this is the first Load More on latest sort, initialize sortedArtworks with props data
  if (artworkSort.value === 'latest' && !hasFetchedSortedArtworks.value) {
    sortedArtworks.value = [...props.artworks]
    hasFetchedSortedArtworks.value = true
    artworkPage.value = 2 // Next page after initial props data
  } else {
    artworkPage.value++
  }
  await fetchSortedArtworks(true)
}

const signedCollectionUrls = ref<Map<string, string>>(new Map())

const collections = ref<Collection[]>([])
const likedArtworks = ref<ArtworkCardInput[]>([])
const bookmarkedArtworks = ref<ArtworkCardInput[]>([])
const followers = ref<UserInList[]>([])
const following = ref<UserInList[]>([])

const isLoadingCollections = ref(false)
const isLoadingLikes = ref(false)
const isLoadingBookmarks = ref(false)
const isLoadingFollowers = ref(false)
const isLoadingFollowing = ref(false)

// Pagination for likes and bookmarks
const loadingMoreLikes = ref(false)
const hasMoreLikes = computed(() => likedArtworks.value.length > 0 && likedArtworks.value.length % likesLimit === 0)
const likesPage = ref(1)
const likesLimit = 20

const loadingMoreBookmarks = ref(false)
const hasMoreBookmarks = computed(() => bookmarkedArtworks.value.length > 0 && bookmarkedArtworks.value.length % bookmarksLimit === 0)
const bookmarksPage = ref(1)
const bookmarksLimit = 20

const getCollectionArtworkUrl = (artworkId: string, imageId: string, fallbackUrl: string) => {
  const cacheKey = `${artworkId}-${imageId}`
  return signedCollectionUrls.value.get(cacheKey) || fallbackUrl
}

const fetchCollectionSignedUrls = async (collectionList: Collection[]) => {
  const imageRequests: { artworkId: string; imageId: string }[] = []

  for (const collection of collectionList) {
    if (collection.artworks) {
      for (const ca of collection.artworks) {
        const imageId = ca.artwork.images?.[0]?.id
        if (imageId) {
          const cacheKey = `${ca.artwork.id}-${imageId}`
          if (!signedCollectionUrls.value.has(cacheKey)) {
            imageRequests.push({ artworkId: ca.artwork.id, imageId })
          }
        }
      }
    }
  }

  await Promise.all(
    imageRequests.map(async ({ artworkId, imageId }) => {
      try {
        const signedUrl = await getSignedUrl(imageId, true)
        const cacheKey = `${artworkId}-${imageId}`
        signedCollectionUrls.value.set(cacheKey, signedUrl)
      } catch (error) {
        console.error(`Failed to get signed URL for collection artwork ${artworkId}:`, error)
      }
    })
  )
}

const fetchCollections = async () => {
  isLoadingCollections.value = true
  try {
    const response = await api.get<Collection[]>(`/api/collections/user/${encodeURIComponent(props.userHandle)}`)
    collections.value = response || []
    await fetchCollectionSignedUrls(collections.value)
  } catch (error) {
    console.error('Failed to fetch collections:', error)
  } finally {
    isLoadingCollections.value = false
  }
}

const fetchLikedArtworks = async (append = false) => {
  if (!isAuthenticated.value) return

  try {
    if (append) {
      loadingMoreLikes.value = true
      likesPage.value++
    } else {
      isLoadingLikes.value = true
      likesPage.value = 1
    }

    const response = await api.get<{ artworks: any[] }>(`/api/likes/user/${props.username}`, {
      params: {
        page: likesPage.value,
        limit: likesLimit,
      },
    })

    const newArtworks = transformArtworks(response.artworks)
    likedArtworks.value = append ? [...likedArtworks.value, ...newArtworks] : newArtworks
  } catch (error) {
    console.error('Failed to fetch liked artworks:', error)
    if (!append) {
      likedArtworks.value = []
    }
  } finally {
    isLoadingLikes.value = false
    loadingMoreLikes.value = false
  }
}

const loadMoreLikes = async () => {
  await fetchLikedArtworks(true)
}

const fetchBookmarkedArtworks = async (append = false) => {
  if (!isAuthenticated.value) return

  try {
    if (append) {
      loadingMoreBookmarks.value = true
      bookmarksPage.value++
    } else {
      isLoadingBookmarks.value = true
      bookmarksPage.value = 1
    }

    const response = await api.get<{ artworks: any[] }>(`/api/bookmarks/user/${props.username}`, {
      params: {
        page: bookmarksPage.value,
        limit: bookmarksLimit,
      },
    })

    const newArtworks = transformArtworks(response.artworks)
    bookmarkedArtworks.value = append ? [...bookmarkedArtworks.value, ...newArtworks] : newArtworks
  } catch (error) {
    console.error('Failed to fetch bookmarked artworks:', error)
    if (!append) {
      bookmarkedArtworks.value = []
    }
  } finally {
    isLoadingBookmarks.value = false
    loadingMoreBookmarks.value = false
  }
}

const loadMoreBookmarks = async () => {
  await fetchBookmarkedArtworks(true)
}

const fetchFollowers = async () => {
  isLoadingFollowers.value = true
  try {
    const response = await api.get<{ followers: UserInList[] }>(`/api/follows/${encodeURIComponent(props.userHandle)}/followers`)
    followers.value = response.followers || []
  } catch (error) {
    console.error('Failed to fetch followers:', error)
  } finally {
    isLoadingFollowers.value = false
  }
}

const fetchFollowing = async () => {
  isLoadingFollowing.value = true
  try {
    const response = await api.get<{ following: UserInList[] }>(`/api/follows/${encodeURIComponent(props.userHandle)}/following`)
    following.value = response.following || []
  } catch (error) {
    console.error('Failed to fetch following:', error)
  } finally {
    isLoadingFollowing.value = false
  }
}

const handleFollowToggle = async (targetUser: UserInList) => {
  try {
    const handle = targetUser.domain
      ? `${targetUser.username}@${targetUser.domain}`
      : targetUser.username
    const previousFollowing = targetUser.isFollowing ?? false

    const result = await api.post<{ following: boolean }>(`/api/follows/${encodeURIComponent(handle)}/toggle`)
    targetUser.isFollowing = result.following

    if (props.isOwnProfile) {
      if (!result.following && previousFollowing && props.selectedTab === 'following') {
        emit('updateFollowingCount', -1)
      }
      if (result.following && !previousFollowing && props.selectedTab === 'followers') {
        emit('updateFollowingCount', 1)
      }
    }
  } catch (e: any) {
    console.error('Failed to toggle follow in list:', e)
    alert(e.message || t('user.followFailed'))
  }
}

watch(() => props.selectedTab, (newTab) => {
  if (newTab === 'collections' && collections.value.length === 0) {
    fetchCollections()
  } else if (newTab === 'likes' && likedArtworks.value.length === 0) {
    fetchLikedArtworks()
  } else if (newTab === 'bookmarks' && bookmarkedArtworks.value.length === 0) {
    fetchBookmarkedArtworks()
  }
}, { immediate: true })

watch(() => props.activeStat, (newStat) => {
  if (newStat === 'followers' && followers.value.length === 0) {
    fetchFollowers()
  } else if (newStat === 'following' && following.value.length === 0) {
    fetchFollowing()
  }
}, { immediate: true })
</script>
