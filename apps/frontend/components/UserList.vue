<template>
  <div class="space-y-3">
    <div
      v-for="user in users"
      :key="user.id || user.username"
      class="flex items-center gap-4 p-4 bg-[var(--color-surface)] rounded-lg hover:bg-[var(--color-hover)] transition-colors"
    >
      <!-- Avatar -->
      <NuxtLink :to="getUserProfileUrl(user)" class="flex-shrink-0">
        <div class="relative w-12 h-12">
          <!-- Avatar loading spinner -->
          <div
            v-if="user.avatarUrl && !avatarLoadState[user.id || user.username]"
            class="absolute inset-0 flex items-center justify-center rounded-full bg-[var(--color-surface-secondary)]"
          >
            <div class="w-6 h-6 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
          </div>
          <img
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            :alt="user.username"
            class="w-12 h-12 rounded-full object-cover"
            :class="{ 'opacity-0': !avatarLoadState[user.id || user.username] }"
            @load="onAvatarLoaded(user.id || user.username)"
            @error="onAvatarLoaded(user.id || user.username)"
          />
          <div
            v-else
            class="w-12 h-12 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center"
          >
            <Icon name="UserCircle" class="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
        </div>
      </NuxtLink>

      <!-- User Info -->
      <div class="flex-1 min-w-0">
        <NuxtLink
          :to="getUserProfileUrl(user)"
          class="block font-medium hover:text-[var(--color-primary)] transition-colors truncate"
        >
          {{ user.displayName || user.username }}
        </NuxtLink>
        <div class="text-sm text-[var(--color-text-muted)] truncate">{{ formatUserHandle(user) }}</div>
        <p v-if="user.bio" class="text-sm text-[var(--color-text)] mt-1 line-clamp-2">
          {{ user.bio }}
        </p>
      </div>

      <!-- Artwork Previews -->
      <div
        v-if="artworkDisplayStyle !== 'hidden' && user.artworks && user.artworks.length > 0"
        class="flex-shrink-0 ml-4"
      >
        <div
          :class="[
            'grid gap-1',
            artworkDisplayStyle === 'small'
              ? 'grid-cols-4 w-32'
              : 'grid-cols-4 gap-2 w-64'
          ]"
        >
          <NuxtLink
            v-for="artwork in user.artworks"
            :key="artwork.id"
            :to="`/artworks/${artwork.id}`"
            :class="[
              'aspect-square overflow-hidden rounded bg-[var(--color-surface-secondary)]',
              artworkDisplayStyle === 'small' ? 'h-8' : ''
            ]"
          >
            <img
              v-if="artwork.images && artwork.images[0]"
              :src="getArtworkThumbnailUrl(artwork)"
              :alt="`Artwork ${artwork.id}`"
              loading="lazy"
              :class="[
                'w-full h-full object-cover hover:scale-110 transition-transform duration-200',
                artworkDisplayStyle === 'small' ? 'h-8' : ''
              ]"
            />
          </NuxtLink>
        </div>
      </div>

      <!-- Follow Button (only show if not own profile and user is authenticated) -->
      <div v-if="showFollowButton && currentUser && currentUser.username !== user.username" class="flex-shrink-0">
        <IconButton
          :variant="isUserFollowing(user) ? 'secondary' : 'primary'"
          size="md"
          shape="circle"
          :disabled="isFollowLoading(user.username)"
          :aria-label="isUserFollowing(user) ? $t('user.unfollow') : $t('user.follow')"
          :title="isUserFollowing(user) ? $t('user.unfollow') : $t('user.follow')"
          @click.stop="handleFollowToggle(user)"
        >
          <Icon :name="isUserFollowing(user) ? 'UserMinus' : 'UserPlus'" class="w-4 h-4" />
        </IconButton>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="users.length === 0 && !loading" class="text-center py-12">
      <p class="text-[var(--color-text-muted)]">{{ emptyMessage || $t('user.noUsersFound') }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    users: any[]
    loading?: boolean
    emptyMessage?: string
    showFollowButton?: boolean
    artworkDisplayStyle?: 'normal' | 'small' | 'hidden'
  }>(),
  {
    loading: false,
    emptyMessage: 'ユーザーがいません',
    showFollowButton: true,
    artworkDisplayStyle: 'normal',
  }
)

const emit = defineEmits<{
  followToggle: [user: any]
}>()

const { user: currentUser } = useAuth()
const { formatUserHandle } = useUsername()
const { getSignedUrl } = useSignedImageUrlOnce()
const followingMap = ref<Record<string, boolean>>({})
const loadingMap = ref<Record<string, boolean>>({})
const avatarLoadState = ref<Record<string, boolean>>({})
const signedArtworkUrls = ref<Map<string, string>>(new Map())

// Fetch signed URLs for artwork thumbnails
const fetchSignedArtworkUrls = async (userList: any[]) => {
  const artworkImages: { artworkId: string; imageId: string }[] = []

  for (const user of userList) {
    if (user.artworks) {
      for (const artwork of user.artworks) {
        if (artwork.images?.[0]?.id && !signedArtworkUrls.value.has(artwork.id)) {
          artworkImages.push({ artworkId: artwork.id, imageId: artwork.images[0].id })
        }
      }
    }
  }

  // Fetch signed URLs in parallel
  await Promise.all(
    artworkImages.map(async ({ artworkId, imageId }) => {
      try {
        const signedUrl = await getSignedUrl(imageId, true)
        signedArtworkUrls.value.set(artworkId, signedUrl)
      } catch (error) {
        console.error(`Failed to get signed URL for artwork ${artworkId}:`, error)
      }
    })
  )
}

// Get signed URL for artwork thumbnail
const getArtworkThumbnailUrl = (artwork: { id: string; images?: { id: string; thumbnailUrl: string }[] }) => {
  return signedArtworkUrls.value.get(artwork.id) || artwork.images?.[0]?.thumbnailUrl || ''
}

const onAvatarLoaded = (id: string) => {
  avatarLoadState.value[id] = true
}

/**
 * Build user profile URL
 * For local users: /users/username
 * For remote users: /users/username@domain
 */
const getUserProfileUrl = (user: any) => {
  const handle = user.domain ? `${user.username}@${user.domain}` : user.username
  return `/users/${handle}`
}

// Initialize following status from user data
onMounted(async () => {
  props.users.forEach((user) => {
    if (user.isFollowing !== undefined) {
      followingMap.value[user.username] = user.isFollowing
    }
  })
  // Fetch signed URLs for artwork thumbnails
  await fetchSignedArtworkUrls(props.users)
})

// Watch for user changes
watch(
  () => props.users,
  async (newUsers) => {
    newUsers.forEach((user) => {
      if (user.isFollowing !== undefined) {
        followingMap.value[user.username] = user.isFollowing
      }
    })
    // Fetch signed URLs for new users
    await fetchSignedArtworkUrls(newUsers)
  },
  { deep: true }
)

const isUserFollowing = (user: any) => {
  return followingMap.value[user.username] ?? user.isFollowing ?? false
}

const isFollowLoading = (username: string) => {
  return loadingMap.value[username] ?? false
}

const handleFollowToggle = (user: any) => {
  emit('followToggle', user)
}
</script>
