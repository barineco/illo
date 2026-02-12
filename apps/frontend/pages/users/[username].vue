<template>
  <div class="max-w-7xl mx-auto">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-[var(--color-danger-text)] mb-4">{{ error }}</p>
      <BaseButton
        variant="primary"
        size="md"
        shape="rounded"
        @click="fetchUserData"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- User Profile -->
    <template v-else-if="profileUser">
      <!-- Profile Header -->
      <UserProfileHeader
        :user="profileUser"
        :is-own-profile="isOwnProfile"
        :active-stat="activeStat"
        @select-tab="selectedTab = $event"
        @select-stat="handleSelectStat"
      >
        <template #actions>
          <UserProfileActions
            :user="profileUser"
            :is-own-profile="isOwnProfile"
            :is-following="isFollowing"
            :is-loading-follow="isLoadingFollow"
            :is-muted="isMuted"
            @toggle-follow="toggleFollow"
            @toggle-mute="toggleMuteUser"
            @open-report="isReportModalOpen = true"
          />
        </template>
      </UserProfileHeader>

      <!-- Tabs -->
      <div class="mb-6">
        <TabGroup
          v-model="selectedTab"
          type="underline"
          :tabs="tabItems"
          :animated="true"
          @update:model-value="handleTabSelect"
        />
      </div>

      <!-- Tab Content -->
      <UserProfileContent
        :selected-tab="selectedTab"
        :username="profileUser.username"
        :user-handle="userHandle"
        :is-own-profile="isOwnProfile"
        :artworks="artworks"
        :active-stat="activeStat"
        @update-following-count="handleFollowingCountUpdate"
      />

      <!-- Report Modal -->
      <ReportModal
        :is-open="isReportModalOpen"
        type="USER"
        :target-id="profileUser.id"
        :target-name="profileUser.displayName || profileUser.username"
        @close="isReportModalOpen = false"
        @submitted="onReportSubmitted"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  ssr: false,
})

const { t } = useI18n()
const route = useRoute()
const api = useApi()
const { user, isAuthenticated } = useAuth()
const { addToast } = useToast()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const selectedTab = ref('artworks')

// User data
interface ProfileUser {
  id: string
  username: string
  domain?: string | null
  displayName: string
  bio?: string
  avatarUrl?: string
  coverImageUrl?: string
  socialLinks?: {
    bluesky?: string
    twitter?: string
    pixiv?: string
    website?: string
  } | null
  blueskyHandle?: string | null
  blueskyVerified?: boolean
  followersCount: number
  followingCount: number
  artworksCount: number
  createdAt: Date
  toolsUsed?: string[]
  supporterTier?: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'
}

interface Artwork {
  id: string
  title: string
  thumbnailUrl: string
  likeCount: number
  bookmarkCount: number
  imageCount: number
  images: Array<{ id: string; thumbnailUrl?: string; url?: string }>
  visibility: 'PUBLIC' | 'UNLISTED' | 'FOLLOWERS_ONLY' | 'PRIVATE'
  ageRating: 'ALL_AGES' | 'NSFW' | 'R18' | 'R18G'
  blurred: boolean
  author: {
    username: string
    domain: string | null
    displayName: string
    avatarUrl: string | null
  }
}

const profileUser = ref<ProfileUser | null>(null)
const artworks = ref<Artwork[]>([])

// Follow state
const isFollowing = ref(false)
const isLoadingFollow = ref(false)

// Mute state
const isMuted = ref(false)

// Report modal state
const isReportModalOpen = ref(false)

// Computed
const userHandle = computed(() => {
  if (!profileUser.value) return ''
  return profileUser.value.domain
    ? `${profileUser.value.username}@${profileUser.value.domain}`
    : profileUser.value.username
})

const isOwnProfile = computed(() => {
  if (!user.value || !profileUser.value) return false
  // Current user is always local (no domain), profile user may be remote
  const profileDomain = profileUser.value.domain || ''
  return user.value.username === profileUser.value.username && profileDomain === ''
})

// Dynamic tabs based on profile ownership
// Following/Followers are shown via header stat clicks, not tabs
const tabs = computed(() => {
  const publicTabs = ['artworks', 'characters', 'collections', 'likes']
  if (isOwnProfile.value) {
    return ['artworks', 'characters', 'collections', 'likes', 'bookmarks']
  }
  return publicTabs
})

// Active stat highlight (when user clicks on following/followers count)
const activeStat = ref<'following' | 'followers' | null>(null)

const tabLabels = computed(() => ({
  artworks: t('user.works'),
  characters: t('user.characters'),
  collections: t('user.collections'),
  likes: t('user.likes'),
  bookmarks: t('user.bookmarks'),
}))

const tabItems = computed(() => {
  return tabs.value.map(tab => ({
    value: tab,
    label: tabLabels.value[tab as keyof typeof tabLabels.value] || tab,
  }))
})

// Fetch user profile and artworks
const fetchUserData = async () => {
  try {
    loading.value = true
    error.value = null

    const username = route.params.username as string
    const config = useRuntimeConfig()

    let baseURL = ''
    if (import.meta.server) {
      baseURL = process.env.API_BASE_SERVER || config.apiBaseServer || config.public.apiBase || ''
    } else {
      baseURL = config.public.apiBase || ''
    }

    const url = `${baseURL}/users/${username}`
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`)
    }

    const userData = await response.json()
    profileUser.value = {
      id: userData.id,
      username: userData.username,
      domain: userData.domain,
      displayName: userData.displayName || userData.username,
      bio: userData.bio || '',
      avatarUrl: userData.avatarUrl,
      coverImageUrl: userData.coverImageUrl,
      socialLinks: userData.socialLinks || null,
      blueskyHandle: userData.blueskyHandle || null,
      blueskyVerified: userData.blueskyVerified || false,
      followersCount: userData._count?.followers || 0,
      followingCount: userData._count?.following || 0,
      artworksCount: userData._count?.artworks || 0,
      createdAt: new Date(userData.createdAt),
      toolsUsed: userData.toolsUsed ? JSON.parse(userData.toolsUsed) : [],
      supporterTier: userData.supporterTier || 'NONE',
    }

    // Fetch user's artworks
    const artworksData = await api.get<any>(`/api/artworks/user/${username}?limit=20`)
    artworks.value = artworksData.artworks.map((artwork: any) => ({
      id: artwork.id,
      title: artwork.title,
      thumbnailUrl: artwork.thumbnailUrl || artwork.images[0]?.thumbnailUrl || artwork.images[0]?.url || '',
      likeCount: artwork._count?.likes || 0,
      bookmarkCount: artwork._count?.bookmarks || 0,
      imageCount: artwork.imageCount || artwork._count?.images || artwork.images?.length || 1,
      images: artwork.images || [],
      visibility: artwork.visibility,
      ageRating: artwork.ageRating,
      blurred: artwork.blurred || false,
      author: {
        username: userData.username,
        domain: userData.domain || null,
        displayName: userData.displayName || userData.username,
        avatarUrl: userData.avatarUrl,
        supporterTier: userData.supporterTier || 'NONE',
      },
    }))
  } catch (e: any) {
    console.error('Failed to fetch user data:', e)
    error.value = e.message || 'Failed to load user data'
  } finally {
    loading.value = false
  }
}

// Check follow status
const checkFollowStatus = async () => {
  if (!user.value || !profileUser.value || isOwnProfile.value) return

  try {
    const followData = await api.get<{ isFollowing: boolean }>(
      `/api/follows/${encodeURIComponent(userHandle.value)}/check`
    )
    isFollowing.value = followData.isFollowing
  } catch (e: any) {
    console.error('Failed to check follow status:', e)
  }
}

// Toggle follow
const toggleFollow = async () => {
  if (!user.value || !profileUser.value || isLoadingFollow.value || isOwnProfile.value) return

  try {
    isLoadingFollow.value = true
    const previousFollowing = isFollowing.value

    const result = await api.post<{ following: boolean }>(
      `/api/follows/${encodeURIComponent(userHandle.value)}/toggle`
    )

    isFollowing.value = result.following
    if (profileUser.value) {
      if (result.following && !previousFollowing) {
        profileUser.value.followersCount++
        addToast({
          type: 'success',
          message: t('user.followSuccess', { name: profileUser.value.displayName }),
        })
      } else if (!result.following && previousFollowing) {
        profileUser.value.followersCount--
        addToast({
          type: 'success',
          message: t('user.unfollowSuccess', { name: profileUser.value.displayName }),
        })
      }
    }
  } catch (e: any) {
    console.error('Failed to toggle follow:', e)
    addToast({
      type: 'error',
      message: e.message || t('user.followFailed'),
    })
  } finally {
    isLoadingFollow.value = false
  }
}

// Check mute status
const checkMuteStatus = async () => {
  if (!user.value || !profileUser.value || isOwnProfile.value) return

  try {
    const response = await api.get<{ isMuted: boolean }>(
      `/api/mutes/users/${encodeURIComponent(userHandle.value)}/check`
    )
    isMuted.value = response.isMuted
  } catch (error) {
    console.error('Failed to check mute status:', error)
  }
}

// Toggle mute user
const toggleMuteUser = async () => {
  if (!user.value || !profileUser.value || isOwnProfile.value) return

  try {
    if (isMuted.value) {
      await api.delete(`/api/mutes/users/${encodeURIComponent(userHandle.value)}`)
      isMuted.value = false
      addToast({
        type: 'success',
        message: t('mutes.unmuteSuccess'),
      })
    } else {
      await api.post(`/api/mutes/users/${encodeURIComponent(userHandle.value)}`, {})
      isMuted.value = true
      addToast({
        type: 'success',
        message: t('mutes.muteUserSuccess'),
      })
    }
  } catch (error) {
    console.error('Failed to toggle mute:', error)
    addToast({
      type: 'error',
      message: t('mutes.muteUserFailed'),
    })
  }
}

// Handle following count update from child component
const handleFollowingCountUpdate = (delta: number) => {
  if (profileUser.value) {
    profileUser.value.followingCount += delta
  }
}

// Handle selecting followers/following stat
const handleSelectStat = (stat: 'following' | 'followers') => {
  // Toggle: if already selected, deselect and restore tab; otherwise select and clear tab
  if (activeStat.value === stat) {
    activeStat.value = null
    // Restore default tab
    selectedTab.value = 'artworks'
  } else {
    activeStat.value = stat
    // Clear tab selection when viewing followers/following
    selectedTab.value = ''
  }
}

// Handle tab selection - clear activeStat when a tab is clicked
const handleTabSelect = (tab: string) => {
  selectedTab.value = tab
  activeStat.value = null
}

// Report submitted handler
const onReportSubmitted = () => {
  console.log('Report submitted')
}

// Fetch on mount
onMounted(async () => {
  await fetchUserData()
  if (user.value && !isOwnProfile.value) {
    await checkFollowStatus()
    await checkMuteStatus()
  }

  const tabParam = route.query.tab as string
  if (tabParam && tabs.value.includes(tabParam)) {
    selectedTab.value = tabParam
  }
})

// Watch for auth changes
watch(() => user.value, async (newUser) => {
  if (newUser && profileUser.value && !isOwnProfile.value) {
    await checkFollowStatus()
    await checkMuteStatus()
  }
})
</script>
