<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between mb-4">
      <TabGroup
        v-model="filterMode"
        type="pill"
        :tabs="filterTabs"
      />
      <BaseButton
        v-if="notifications.length > 0"
        variant="secondary"
        size="md"
        shape="rounded"
        @click="markAllAsRead"
      >
        {{ $t('notifications.markAllRead') }}
      </BaseButton>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="notifications.length === 0" class="text-center py-12">
      <Icon name="BellSlash" class="w-16 h-16 mx-auto mb-4 text-[var(--color-text-muted)]" />
      <p class="text-[var(--color-text-muted)]">{{ $t('notifications.empty') }}</p>
    </div>

    <!-- Notifications List -->
    <div v-else class="space-y-2">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="p-4 rounded-lg transition-colors"
        :class="notification.isRead ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-secondary)]'"
      >
        <div class="flex items-start gap-3">
          <!-- Actor Avatar -->
          <NuxtLink :to="`/users/${notification.actor.username}`" class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden flex items-center justify-center">
              <img
                v-if="notification.actor.avatarUrl"
                :src="notification.actor.avatarUrl"
                :alt="notification.actor.username"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="UserCircle" class="w-6 h-6" />
            </div>
          </NuxtLink>

          <!-- Notification Content -->
          <div class="flex-1 min-w-0">
            <p class="text-sm">
              <NuxtLink
                :to="`/users/${notification.actor.username}`"
                class="font-medium hover:text-[var(--color-primary)] transition-colors"
              >
                {{ notification.actor.displayName || notification.actor.username }}
              </NuxtLink>
              <span class="text-[var(--color-text-muted)]">{{ getNotificationText(notification) }}</span>
            </p>

            <!-- Artwork Thumbnail (for LIKE, COMMENT, COMMENT_REPLY) -->
            <NuxtLink
              v-if="notification.artwork"
              :to="getNotificationLink(notification)"
              class="mt-2 flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div class="w-12 h-12 rounded bg-[var(--color-surface-tertiary)] overflow-hidden flex-shrink-0">
                <img
                  v-if="notification.artwork.images?.[0]"
                  :src="getArtworkThumbnailUrl(notification.artwork)"
                  :alt="notification.artwork.title"
                  class="w-full h-full object-cover"
                />
              </div>
              <span class="text-sm text-[var(--color-text-muted)] truncate">{{ notification.artwork.title }}</span>
            </NuxtLink>

            <!-- Comment Preview (for COMMENT, COMMENT_REPLY) -->
            <p v-if="notification.comment" class="mt-1 text-sm text-[var(--color-text-muted)] line-clamp-2">
              "{{ notification.comment.content }}"
            </p>

            <!-- Timestamp -->
            <p class="mt-1 text-xs text-[var(--color-text-muted)]">
              {{ formatRelativeTime(notification.createdAt) }}
            </p>
          </div>

          <!-- Mark as Read Button -->
          <button
            v-if="!notification.isRead"
            @click="markAsRead(notification.id)"
            class="flex-shrink-0 p-2 hover:bg-[var(--color-hover)] rounded-full transition-colors"
            :title="$t('notifications.markAsRead')"
          >
            <Icon name="Check" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6 items-center">
      <BaseButton
        variant="secondary"
        size="md"
        shape="rounded"
        :disabled="currentPage === 1"
        @click="currentPage--"
      >
        {{ $t('common.previous') }}
      </BaseButton>
      <span class="px-4 py-2">{{ currentPage }} / {{ totalPages }}</span>
      <BaseButton
        variant="secondary"
        size="md"
        shape="rounded"
        :disabled="currentPage === totalPages"
        @click="currentPage++"
      >
        {{ $t('common.next') }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const { getSignedUrl } = useSignedImageUrlOnce()

// Use shared notification state
const { resetUnreadCount, decrementUnreadCount } = useNotifications()

// Cache for signed artwork thumbnail URLs
const signedArtworkUrls = ref<Map<string, string>>(new Map())

interface NotificationActor {
  username: string
  displayName?: string
  avatarUrl?: string
}

interface NotificationArtwork {
  id: string
  title: string
  images?: { id: string; thumbnailUrl: string }[]
}

interface NotificationComment {
  id: string
  content: string
}

interface Notification {
  id: string
  type: string
  isRead: boolean
  readAt?: Date
  createdAt: string
  actor: NotificationActor
  artwork?: NotificationArtwork
  comment?: NotificationComment
}

// Filter tabs
const filterTabs = computed(() => [
  { value: 'all', label: t('notifications.all') },
  { value: 'unread', label: t('notifications.unread') },
])

const filterMode = ref('all')
const filterUnreadOnly = computed(() => filterMode.value === 'unread')

// Notifications state
const notifications = ref<Notification[]>([])
const loading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)

// Fetch signed URLs for artwork thumbnails in notifications
const fetchSignedArtworkUrls = async (notificationList: Notification[]) => {
  const artworkImages: { artworkId: string; imageId: string }[] = []

  for (const notification of notificationList) {
    if (notification.artwork?.images?.[0]?.id && !signedArtworkUrls.value.has(notification.artwork.id)) {
      artworkImages.push({
        artworkId: notification.artwork.id,
        imageId: notification.artwork.images[0].id,
      })
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
const getArtworkThumbnailUrl = (artwork: NotificationArtwork) => {
  return signedArtworkUrls.value.get(artwork.id) || artwork.images?.[0]?.thumbnailUrl || ''
}

// Fetch notifications
const fetchNotifications = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: '20',
      ...(filterUnreadOnly.value ? { unreadOnly: 'true' } : {}),
    })

    const data = await api.get<{ notifications: Notification[]; total: number }>(
      `/api/notifications?${params}`,
    )

    notifications.value = data.notifications
    totalPages.value = Math.ceil(data.total / 20)

    // Fetch signed URLs for artwork thumbnails
    await fetchSignedArtworkUrls(data.notifications)
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
  } finally {
    loading.value = false
  }
}

// Mark notification as read
const markAsRead = async (notificationId: string) => {
  try {
    await api.patch(`/api/notifications/${notificationId}/read`)
    const notification = notifications.value.find((n) => n.id === notificationId)
    if (notification) {
      notification.isRead = true
      notification.readAt = new Date()
      decrementUnreadCount()
    }
  } catch (error) {
    console.error('Failed to mark notification as read:', error)
  }
}

// Mark all as read
const markAllAsRead = async () => {
  try {
    await api.patch('/api/notifications/mark-all-read')
    notifications.value.forEach((n) => {
      n.isRead = true
      n.readAt = new Date()
    })
    resetUnreadCount()
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error)
  }
}

// Get notification text based on type
const getNotificationText = (notification: Notification) => {
  switch (notification.type) {
    case 'LIKE':
      return t('notifications.likeAction')
    case 'COMMENT':
      return t('notifications.commentAction')
    case 'COMMENT_REPLY':
      return t('notifications.replyAction')
    case 'FOLLOW':
      return t('notifications.followAction')
    default:
      return ''
  }
}

// Get notification link
const getNotificationLink = (notification: Notification) => {
  if (notification.type === 'FOLLOW') {
    return `/users/${notification.actor.username}`
  }
  if (notification.artwork) {
    if (notification.type === 'COMMENT_REPLY' && notification.comment) {
      return `/artworks/${notification.artwork.id}#comment-${notification.comment.id}`
    }
    return `/artworks/${notification.artwork.id}`
  }
  return '#'
}

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return t('time.justNow')
  if (diffMin < 60) return t('time.minutesAgo', { n: diffMin })
  if (diffHour < 24) return t('time.hoursAgo', { n: diffHour })
  if (diffDay < 7) return t('time.daysAgo', { n: diffDay })

  return date.toLocaleDateString()
}

// Watch for filter and page changes
watch([filterMode, currentPage], () => {
  fetchNotifications()
})

// Initial fetch
onMounted(() => {
  fetchNotifications()
})

// Expose refresh method
defineExpose({
  refresh: fetchNotifications,
})
</script>
