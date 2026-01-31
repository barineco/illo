<template>
  <div class="max-w-4xl mx-auto px-4 py-8 h-[calc(100vh-180px)] flex flex-col">
    <!-- Header -->
    <div class="flex items-center gap-4 pb-4 border-b border-[var(--color-border)] flex-shrink-0">
      <NuxtLink
        to="/messages"
        class="p-2 hover:bg-[var(--color-hover)] rounded-full transition-colors"
      >
        <Icon name="ArrowLeft" class="w-5 h-5" />
      </NuxtLink>

      <NuxtLink
        v-if="conversation?.participant"
        :to="`/users/${conversation.participant.username}${conversation.participant.domain ? `@${conversation.participant.domain}` : ''}`"
        class="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <div class="w-10 h-10 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden">
          <img
            v-if="conversation.participant.avatarUrl"
            :src="conversation.participant.avatarUrl"
            :alt="conversation.participant.username"
            class="w-full h-full object-cover"
          />
        </div>
        <div>
          <div class="font-medium">
            {{ conversation.participant.displayName || conversation.participant.username }}
          </div>
          <div class="text-sm text-[var(--color-text-muted)]">
            @{{ conversation.participant.username }}{{ conversation.participant.domain ? `@${conversation.participant.domain}` : '' }}
          </div>
        </div>
      </NuxtLink>

      <!-- Encryption Status Indicator -->
      <div class="ml-auto flex items-center gap-2">
        <div
          v-if="encryptionStatus"
          class="flex items-center gap-1 text-sm"
          :class="{
            'text-green-600 dark:text-green-400': encryptionStatus.encryptionSupported,
            'text-yellow-600 dark:text-yellow-400': !encryptionStatus.encryptionSupported,
          }"
          :title="encryptionStatusTooltip"
        >
          <Icon
            :name="encryptionStatus.encryptionSupported ? 'LockClosed' : 'LockOpen'"
            class="w-4 h-4"
          />
        </div>
      </div>
    </div>

    <!-- Encryption Warning Banner -->
    <div
      v-if="encryptionStatus && !encryptionStatus.encryptionSupported && encryptionStatus.unsupportedDomains.length > 0"
      class="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4 flex-shrink-0"
    >
      <div class="flex items-start gap-3">
        <Icon name="ExclamationTriangle" class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div class="text-sm">
          <p class="font-medium text-yellow-800 dark:text-yellow-200">
            {{ $t('messages.encryption.notSupported') }}
          </p>
          <p class="text-yellow-700 dark:text-yellow-300 mt-1">
            {{ $t('messages.encryption.notSupportedDescription', { domains: encryptionStatus.unsupportedDomains.join(', ') }) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
    </div>

    <!-- Messages -->
    <div
      v-else
      ref="messagesContainer"
      class="flex-1 overflow-y-auto py-4 space-y-4"
    >
      <!-- Load More Button -->
      <div v-if="hasMoreMessages" class="text-center">
        <button
          @click="loadMoreMessages"
          :disabled="loadingMore"
          class="px-4 py-2 text-sm text-[var(--color-primary)] hover:underline disabled:opacity-50"
        >
          {{ loadingMore ? $t('common.loading') : $t('messages.loadMore') }}
        </button>
      </div>

      <!-- Messages List -->
      <div
        v-for="message in messages"
        :key="message.id"
        class="flex"
        :class="message.senderId === currentUserId ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[70%] rounded-2xl px-4 py-2"
          :class="message.senderId === currentUserId
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
            : 'bg-[var(--color-surface-secondary)]'"
        >
          <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
          <p
            class="text-xs mt-1"
            :class="message.senderId === currentUserId
              ? 'text-[var(--color-primary-text)]/70'
              : 'text-[var(--color-text-muted)]'"
          >
            {{ formatTime(message.createdAt) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Message Input -->
    <div class="pt-4 border-t border-[var(--color-border)] flex-shrink-0">
      <form @submit.prevent="sendMessage" class="flex gap-2">
        <input
          v-model="newMessage"
          type="text"
          :placeholder="$t('messages.writeMessage')"
          class="flex-1 px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          :disabled="sending"
        />
        <button
          type="submit"
          :disabled="!newMessage.trim() || sending"
          class="p-3 bg-[var(--color-primary)] text-[var(--color-primary-text)] rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          <Icon name="PaperAirplane" class="w-5 h-5" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const { fetchUnreadCount } = useMessages()
const { user } = useAuth()

// Get conversation ID from route
const conversationId = computed(() => route.params.id as string)

// Encryption status type
interface EncryptionStatus {
  encryptionSupported: boolean
  status: 'all_local' | 'all_supported' | 'partial' | 'none'
  supportedDomains: string[]
  unsupportedDomains: string[]
}

// State
const loading = ref(false)
const conversation = ref<any>(null)
const messages = ref<any[]>([])
const newMessage = ref('')
const sending = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const currentPage = ref(1)
const totalMessages = ref(0)
const loadingMore = ref(false)
const encryptionStatus = ref<EncryptionStatus | null>(null)

// Current user ID from auth
const currentUserId = computed(() => user.value?.id)

// Encryption status tooltip
const encryptionStatusTooltip = computed(() => {
  if (!encryptionStatus.value) return ''
  switch (encryptionStatus.value.status) {
    case 'all_local':
      return t('messages.encryption.statusAllLocal')
    case 'all_supported':
      return t('messages.encryption.statusAllSupported')
    case 'partial':
      return t('messages.encryption.statusPartial')
    case 'none':
      return t('messages.encryption.statusNone')
    default:
      return ''
  }
})

// Has more messages
const hasMoreMessages = computed(() => {
  return messages.value.length < totalMessages.value
})

// Fetch conversation
const fetchConversation = async () => {
  loading.value = true
  try {
    const data = await api.get<{
      id: string
      participant: any
      participants: any[]
      messages: any[]
      totalMessages: number
    }>(`/api/messages/conversations/${conversationId.value}?page=1&limit=50`)

    conversation.value = data
    messages.value = data.messages
    totalMessages.value = data.totalMessages

    // Fetch encryption status
    fetchEncryptionStatus()

    // Mark as read
    await api.patch(`/api/messages/conversations/${conversationId.value}/read`)
    fetchUnreadCount()

    // Scroll to bottom after render
    nextTick(() => {
      scrollToBottom()
    })
  } catch (error) {
    console.error('Failed to fetch conversation:', error)
  } finally {
    loading.value = false
  }
}

// Fetch encryption status
const fetchEncryptionStatus = async () => {
  try {
    const data = await api.get<EncryptionStatus>(
      `/api/messages/conversations/${conversationId.value}/encryption-status`,
    )
    encryptionStatus.value = data
  } catch (error) {
    console.error('Failed to fetch encryption status:', error)
    encryptionStatus.value = null
  }
}

// Load more messages
const loadMoreMessages = async () => {
  if (loadingMore.value || !hasMoreMessages.value) return

  loadingMore.value = true
  try {
    currentPage.value++
    const data = await api.get<{ messages: any[]; totalMessages: number }>(
      `/api/messages/conversations/${conversationId.value}?page=${currentPage.value}&limit=50`,
    )

    // Prepend older messages
    messages.value = [...data.messages, ...messages.value]
    totalMessages.value = data.totalMessages
  } catch (error) {
    console.error('Failed to load more messages:', error)
    currentPage.value--
  } finally {
    loadingMore.value = false
  }
}

// Send message
const sendMessage = async () => {
  if (!newMessage.value.trim() || sending.value) return

  sending.value = true
  const content = newMessage.value.trim()
  newMessage.value = ''

  try {
    const message = await api.post<any>(
      `/api/messages/conversations/${conversationId.value}/messages`,
      { content },
    )

    messages.value.push(message)
    totalMessages.value++

    // Scroll to bottom
    nextTick(() => {
      scrollToBottom()
    })
  } catch (error) {
    console.error('Failed to send message:', error)
    newMessage.value = content // Restore message on error
  } finally {
    sending.value = false
  }
}

// Scroll to bottom
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Format time
const formatTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Polling for new messages
let pollingInterval: ReturnType<typeof setInterval>

const pollNewMessages = async () => {
  if (loading.value || !conversation.value) return

  try {
    const data = await api.get<{ messages: any[]; totalMessages: number }>(
      `/api/messages/conversations/${conversationId.value}?page=1&limit=50`,
    )

    // Check for new messages
    if (data.messages.length > 0) {
      const lastLocalId = messages.value[messages.value.length - 1]?.id
      const newMessages = data.messages.filter(
        (m) => !messages.value.some((existing) => existing.id === m.id),
      )

      if (newMessages.length > 0) {
        messages.value.push(...newMessages)
        totalMessages.value = data.totalMessages

        // Mark as read
        await api.patch(`/api/messages/conversations/${conversationId.value}/read`)
        fetchUnreadCount()

        // Scroll to bottom if near bottom
        nextTick(() => {
          if (messagesContainer.value) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
            if (scrollHeight - scrollTop - clientHeight < 100) {
              scrollToBottom()
            }
          }
        })
      }
    }
  } catch (error) {
    console.error('Failed to poll messages:', error)
  }
}

// Watch for route changes
watch(conversationId, () => {
  fetchConversation()
})

// Initial fetch and polling
onMounted(() => {
  fetchConversation()
  pollingInterval = setInterval(pollNewMessages, 10000) // Poll every 10 seconds
})

onUnmounted(() => {
  clearInterval(pollingInterval)
})
</script>
