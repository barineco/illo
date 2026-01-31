<template>
  <div class="relative" data-dropdown-container>
    <!-- Envelope Icon with Badge -->
    <button
      @click="toggle"
      class="p-2 hover:bg-[var(--color-hover)] rounded-full transition-colors relative"
      :title="$t('nav.messages')"
    >
      <Icon name="Envelope" class="w-6 h-6" />
      <!-- Unread Count Badge -->
      <span
        v-if="unreadMessageCount > 0"
        class="absolute top-0 right-0 min-w-[18px] h-[18px] bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
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
        <h3 class="font-semibold">{{ $t('messages.title') }}</h3>
        <NuxtLink
          to="/messages"
          @click="close"
          class="text-xs text-[var(--color-primary)] hover:underline"
        >
          {{ $t('messages.newMessage') }}
        </NuxtLink>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="conversations.length === 0" class="flex flex-col items-center justify-center py-12">
        <Icon name="ChatBubbleLeftRight" class="w-12 h-12 text-[var(--color-text-muted)] mb-2" />
        <p class="text-sm text-[var(--color-text-muted)]">{{ $t('messages.empty') }}</p>
      </div>

      <!-- Conversations List -->
      <div v-else class="overflow-y-auto flex-1">
        <NuxtLink
          v-for="conv in conversations"
          :key="conv.id"
          :to="`/messages/${conv.id}`"
          @click="close"
          class="block px-4 py-3 hover:bg-[var(--color-hover)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
          :class="{ 'bg-[var(--color-surface-secondary)]': conv.unreadCount > 0 }"
        >
          <div class="flex items-start gap-3">
            <!-- User Avatar -->
            <div class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden flex-shrink-0 flex items-center justify-center">
              <img
                v-if="conv.participant?.avatarUrl"
                :src="conv.participant.avatarUrl"
                :alt="conv.participant.username"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="UserCircle" class="w-8 h-8 text-[var(--color-text-muted)]" />
            </div>

            <!-- Conversation Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="font-medium truncate">
                  {{ conv.participant?.displayName || conv.participant?.username }}
                </span>
                <span class="text-xs text-[var(--color-text-muted)] flex-shrink-0 ml-2">
                  {{ formatRelativeTime(conv.lastMessageAt) }}
                </span>
              </div>
              <p class="text-sm text-[var(--color-text-muted)] truncate mt-1">
                {{ conv.lastMessage?.content || $t('messages.noMessages') }}
              </p>
            </div>

            <!-- Unread Indicator -->
            <div v-if="conv.unreadCount > 0" class="flex-shrink-0">
              <div class="min-w-[20px] h-5 bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Footer -->
      <div class="px-4 py-3 border-t border-[var(--color-border)]">
        <NuxtLink
          to="/dashboard?tab=messages"
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

// Dropdown state using global dropdown manager
const { isOpen, toggle, close } = useDropdown('messages')
const loading = ref(false)
const conversations = ref<any[]>([])

// Use shared message state
const { unreadMessageCount, formattedUnreadCount, fetchUnreadCount } = useMessages()

// Watch for dropdown open/close
watch(isOpen, async (newValue) => {
  if (newValue) {
    await fetchConversations()
    await fetchUnreadCount()
  }
})

// Fetch recent conversations (5 items)
const fetchConversations = async () => {
  loading.value = true
  try {
    const data = await api.get<{ conversations: any[] }>('/api/messages/conversations?limit=5&page=1')
    conversations.value = data.conversations
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
  } finally {
    loading.value = false
  }
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
