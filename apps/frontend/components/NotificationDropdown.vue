<template>
  <div class="relative" data-dropdown-container>
    <!-- Bell Icon with Badge -->
    <button
      @click="toggle"
      class="p-2 hover:bg-[var(--color-hover)] rounded-full transition-colors relative"
      :title="$t('nav.notifications')"
    >
      <Icon name="Bell" class="w-6 h-6" />
      <!-- Unread Count Badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute top-0 right-0 min-w-[18px] h-[18px] bg-[var(--color-danger)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
      >
        {{ formattedUnreadCount }}
      </span>
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="absolute right-0 top-12 w-96 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl py-2 z-[60] max-h-[600px] overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 class="font-semibold">{{ $t('notifications.title') }}</h3>
        <button
          v-if="notifications.length > 0 && notifications.some(n => !n.isRead)"
          @click="markAllAsRead"
          class="text-xs text-[var(--color-primary)] hover:underline"
        >
          {{ $t('notifications.markAllRead') }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="notifications.length === 0" class="flex flex-col items-center justify-center py-12">
        <Icon name="BellSlash" class="w-12 h-12 text-[var(--color-text-muted)] mb-2" />
        <p class="text-sm text-[var(--color-text-muted)]">{{ $t('notifications.empty') }}</p>
      </div>

      <!-- Notifications List -->
      <div v-else class="overflow-y-auto flex-1">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="block px-4 py-3 hover:bg-[var(--color-hover)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
          :class="{ 'bg-[var(--color-surface-secondary)]': !notification.isRead }"
        >
          <div class="flex items-start gap-3">
            <!-- Actor Avatar (clickable to user profile) -->
            <NuxtLink
              :to="getUserPathFromUser(notification.actor)"
              @click="handleNotificationClick(notification)"
              class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden flex-shrink-0 flex items-center justify-center hover:ring-2 ring-[var(--color-primary)] transition-all"
            >
              <img
                v-if="notification.actor.avatarUrl"
                :src="notification.actor.avatarUrl"
                :alt="notification.actor.username"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="UserCircle" class="w-8 h-8 text-[var(--color-text-muted)]" />
            </NuxtLink>

            <!-- Notification Content (clickable to artwork/user) -->
            <NuxtLink
              :to="getNotificationLink(notification)"
              @click="handleNotificationClick(notification)"
              class="flex-1 min-w-0"
            >
              <p class="text-sm">
                <span class="font-medium">
                  {{ notification.actor.displayName || notification.actor.username }}
                </span>
                <span class="text-[var(--color-text-muted)]">{{ getNotificationText(notification) }}</span>
              </p>

              <!-- Artwork Thumbnail (for LIKE, COMMENT, COMMENT_REPLY) -->
              <div
                v-if="notification.artwork"
                class="mt-2 flex items-center gap-2"
              >
                <div class="w-10 h-10 rounded bg-[var(--color-surface-tertiary)] overflow-hidden flex-shrink-0">
                  <img
                    v-if="notification.artwork.images?.[0]"
                    :src="getArtworkThumbnailUrl(notification)"
                    :alt="notification.artwork.title"
                    class="w-full h-full object-cover"
                  />
                </div>
                <span class="text-xs text-[var(--color-text-muted)] truncate">{{ notification.artwork.title }}</span>
              </div>

              <!-- Timestamp -->
              <p class="mt-1 text-xs text-[var(--color-text-muted)]">
                {{ formatRelativeTime(notification.createdAt) }}
              </p>
            </NuxtLink>

            <!-- Unread Indicator -->
            <div v-if="!notification.isRead" class="flex-shrink-0">
              <div class="w-2 h-2 bg-[var(--color-primary)] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 py-3 border-t border-[var(--color-border)]">
        <NuxtLink
          to="/dashboard?tab=notifications"
          @click="close"
          class="block text-center text-sm text-[var(--color-primary)] hover:underline"
        >
          {{ $t('notifications.viewAll') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const { getUserPathFromUser } = useUsername()
const { getSignedUrl } = useSignedImageUrlOnce()

// Dropdown state using global dropdown manager
const { isOpen, toggle, close } = useDropdown('notifications')
const loading = ref(false)
const notifications = ref<any[]>([])

// Use shared notification state
const { unreadCount, formattedUnreadCount, fetchUnreadCount, resetUnreadCount, decrementUnreadCount } = useNotifications()

// Cache for signed artwork thumbnail URLs
const signedThumbnailUrls = ref<Map<string, string>>(new Map())

// Watch for dropdown open/close
watch(isOpen, async (newValue) => {
  if (newValue) {
    if (notifications.value.length === 0) {
      await fetchNotifications()
    }
    await fetchUnreadCount()
  }
})

// Fetch signed URLs for artwork thumbnails
const fetchSignedUrls = async (notificationList: any[]) => {
  for (const notification of notificationList) {
    const imageId = notification.artwork?.images?.[0]?.id
    if (imageId && !signedThumbnailUrls.value.has(imageId)) {
      try {
        const signedUrl = await getSignedUrl(imageId, true)
        signedThumbnailUrls.value.set(imageId, signedUrl)
      } catch (error) {
        console.error(`Failed to get signed URL for image ${imageId}:`, error)
      }
    }
  }
}

// Get signed URL for artwork thumbnail
const getArtworkThumbnailUrl = (notification: any): string => {
  const imageId = notification.artwork?.images?.[0]?.id
  if (imageId) {
    return signedThumbnailUrls.value.get(imageId) || notification.artwork.images[0].thumbnailUrl
  }
  return ''
}

// Fetch recent notifications (5 items)
const fetchNotifications = async () => {
  loading.value = true
  try {
    const data = await api.get<{ notifications: any[] }>('/api/notifications?limit=5&page=1')
    notifications.value = data.notifications
    // Fetch signed URLs for artwork thumbnails
    await fetchSignedUrls(data.notifications)
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
  } finally {
    loading.value = false
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
    console.error('Failed to mark all as read:', error)
  }
}

// Handle notification click
const handleNotificationClick = async (notification: any) => {
  close()

  // Mark as read if not already
  if (!notification.isRead) {
    try {
      await api.patch(`/api/notifications/${notification.id}/read`)
      notification.isRead = true
      notification.readAt = new Date()
      decrementUnreadCount()
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }
}

// Get notification text based on type
const getNotificationText = (notification: any) => {
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
const getNotificationLink = (notification: any) => {
  if (notification.type === 'FOLLOW') {
    const actor = notification.actor
    return `/users/${actor.username}${actor.domain ? `@${actor.domain}` : ''}`
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

// Fetch unread count on mount and poll every 30 seconds
onMounted(() => {
  fetchUnreadCount()
  const interval = setInterval(fetchUnreadCount, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>
