<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Page Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">{{ $t('messages.title') }}</h1>
      <button
        @click="showNewConversation = true"
        class="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg hover:opacity-90 transition-opacity"
      >
        <Icon name="PencilSquare" class="w-5 h-5" />
        {{ $t('messages.newMessage') }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="conversations.length === 0" class="text-center py-12">
      <Icon name="ChatBubbleLeftRight" class="w-16 h-16 mx-auto mb-4 text-[var(--color-text-muted)]" />
      <p class="text-[var(--color-text-muted)] mb-4">{{ $t('messages.empty') }}</p>
      <button
        @click="showNewConversation = true"
        class="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg hover:opacity-90 transition-opacity"
      >
        {{ $t('messages.startConversation') }}
      </button>
    </div>

    <!-- Conversations List -->
    <div v-else class="space-y-2">
      <NuxtLink
        v-for="conv in conversations"
        :key="conv.id"
        :to="`/messages/${conv.id}`"
        class="block p-4 rounded-lg transition-colors hover:bg-[var(--color-hover)]"
        :class="conv.unreadCount > 0 ? 'bg-[var(--color-surface-secondary)]' : 'bg-[var(--color-surface)]'"
      >
        <div class="flex items-center gap-3">
          <!-- Avatar -->
          <div class="w-12 h-12 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden flex-shrink-0 flex items-center justify-center">
            <img
              v-if="conv.participant?.avatarUrl"
              :src="conv.participant.avatarUrl"
              :alt="conv.participant.username"
              class="w-full h-full object-cover"
            />
            <Icon v-else name="UserCircle" class="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="font-medium truncate">
                {{ conv.participant?.displayName || conv.participant?.username }}
                <span v-if="conv.participant?.domain" class="text-[var(--color-text-muted)]">
                  @{{ conv.participant.domain }}
                </span>
              </span>
              <span class="text-xs text-[var(--color-text-muted)] flex-shrink-0 ml-2">
                {{ formatRelativeTime(conv.lastMessageAt) }}
              </span>
            </div>
            <p class="text-sm text-[var(--color-text-muted)] truncate mt-1">
              {{ conv.lastMessage?.content || $t('messages.noMessages') }}
            </p>
          </div>

          <!-- Unread Badge -->
          <div
            v-if="conv.unreadCount > 0"
            class="flex-shrink-0 min-w-[24px] h-6 bg-[var(--color-primary)] text-white text-xs font-bold rounded-full flex items-center justify-center px-2"
          >
            {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
          </div>
        </div>
      </NuxtLink>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
        <button
          @click="currentPage--"
          :disabled="currentPage === 1"
          class="px-4 py-2 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ $t('common.previous') }}
        </button>
        <span class="px-4 py-2">{{ currentPage }} / {{ totalPages }}</span>
        <button
          @click="currentPage++"
          :disabled="currentPage === totalPages"
          class="px-4 py-2 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {{ $t('common.next') }}
        </button>
      </div>
    </div>

    <!-- New Conversation Modal -->
    <div
      v-if="showNewConversation"
      class="fixed inset-0 bg-[var(--color-overlay-light)] flex items-center justify-center z-50"
      @click.self="showNewConversation = false"
    >
      <div class="bg-[var(--color-surface)] rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-xl font-bold mb-4">{{ $t('messages.newConversation') }}</h2>

        <!-- User Search -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">{{ $t('messages.recipient') }}</label>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('messages.searchUser')"
            class="w-full px-4 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            @input="searchUsers"
          />

          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="mt-2 border border-[var(--color-border)] rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <button
              v-for="user in searchResults"
              :key="user.id"
              @click="selectRecipient(user)"
              class="w-full flex items-center gap-3 p-3 hover:bg-[var(--color-hover)] transition-colors text-left"
              :class="selectedRecipient?.id === user.id ? 'bg-[var(--color-surface-secondary)]' : ''"
            >
              <div class="w-10 h-10 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden flex-shrink-0 flex items-center justify-center">
                <img
                  v-if="user.avatarUrl"
                  :src="user.avatarUrl"
                  :alt="user.username"
                  class="w-full h-full object-cover"
                />
                <Icon v-else name="UserCircle" class="w-6 h-6 text-[var(--color-text-muted)]" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-medium truncate">{{ user.displayName || user.username }}</div>
                <div class="text-sm text-[var(--color-text-muted)] truncate">
                  {{ user.handle || `@${user.username}${user.domain ? `@${user.domain}` : ''}` }}
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Selected Recipient -->
        <div v-if="selectedRecipient" class="mb-4 p-3 bg-[var(--color-surface-secondary)] rounded-lg">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden flex-shrink-0 flex items-center justify-center">
              <img
                v-if="selectedRecipient.avatarUrl"
                :src="selectedRecipient.avatarUrl"
                :alt="selectedRecipient.username"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="UserCircle" class="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ selectedRecipient.displayName || selectedRecipient.username }}</div>
              <div class="text-sm text-[var(--color-text-muted)] truncate">
                {{ selectedRecipient.handle || `@${selectedRecipient.username}${selectedRecipient.domain ? `@${selectedRecipient.domain}` : ''}` }}
              </div>
            </div>
            <button
              @click="selectedRecipient = null"
              class="p-1 hover:bg-[var(--color-hover)] rounded flex-shrink-0"
            >
              <Icon name="XMark" class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Message -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">{{ $t('messages.message') }}</label>
          <textarea
            v-model="newMessage"
            :placeholder="$t('messages.writeMessage')"
            rows="4"
            class="w-full px-4 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          ></textarea>
        </div>

        <!-- Error Message -->
        <div v-if="createError" class="mb-4 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg">
          <p class="text-sm text-[var(--color-danger-text)]">{{ createError }}</p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            @click="showNewConversation = false"
            class="px-4 py-2 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded-lg transition-colors"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            @click="createConversation"
            :disabled="!selectedRecipient || !newMessage.trim() || creating"
            class="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {{ creating ? $t('messages.sending') : $t('messages.send') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const api = useApi()
const router = useRouter()
const { fetchUnreadCount } = useMessages()

// State
const loading = ref(false)
const conversations = ref<any[]>([])
const currentPage = ref(1)
const totalPages = ref(1)
const showNewConversation = ref(false)
const searchQuery = ref('')
const searchResults = ref<any[]>([])
const selectedRecipient = ref<any>(null)
const newMessage = ref('')
const creating = ref(false)

// Fetch conversations
const fetchConversations = async () => {
  loading.value = true
  try {
    const data = await api.get<{ conversations: any[]; total: number }>(
      `/api/messages/conversations?page=${currentPage.value}&limit=20`,
    )
    conversations.value = data.conversations
    totalPages.value = Math.ceil(data.total / 20)
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
  } finally {
    loading.value = false
  }
}

// Search users using the same API as SearchAutocomplete
let searchTimeout: ReturnType<typeof setTimeout>
const searchUsers = () => {
  clearTimeout(searchTimeout)
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    try {
      const data = await api.get<{ users?: { users: any[] } }>(
        `/api/search?q=${encodeURIComponent(searchQuery.value)}&type=users&limit=5`,
      )
      searchResults.value = data.users?.users || []
    } catch (error) {
      console.error('Failed to search users:', error)
    }
  }, 300)
}

// Select recipient
const selectRecipient = (user: any) => {
  selectedRecipient.value = user
  searchQuery.value = ''
  searchResults.value = []
}

// Create conversation error message
const createError = ref('')

// Create conversation
const createConversation = async () => {
  if (!selectedRecipient.value || !newMessage.value.trim()) return

  creating.value = true
  createError.value = ''
  try {
    const data = await api.post<{ conversation: any; message: any }>('/api/messages/conversations', {
      recipientId: selectedRecipient.value.id,
      initialMessage: newMessage.value.trim(),
    })

    // Navigate to the conversation
    showNewConversation.value = false
    await router.push(`/messages/${data.conversation.id}`)
    fetchUnreadCount()
  } catch (error: any) {
    console.error('Failed to create conversation:', error)
    createError.value = error?.data?.message || error?.message || t('messages.createError')
  } finally {
    creating.value = false
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

// Watch for page changes
watch(currentPage, () => {
  fetchConversations()
})

// Initial fetch
onMounted(() => {
  fetchConversations()
})
</script>
