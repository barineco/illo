<template>
  <div class="flex gap-4" style="height: calc(100vh - 320px); min-height: 400px;">
    <!-- Conversations List -->
    <div class="w-80 flex-shrink-0 bg-[var(--color-surface)] rounded-lg overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 class="font-semibold">{{ $t('messages.title') }}</h3>
        <IconButton
          variant="ghost"
          size="sm"
          shape="square"
          :aria-label="$t('messages.newMessage')"
          :title="$t('messages.newMessage')"
          @click="showNewConversation = true"
        >
          <Icon name="PencilSquare" class="w-5 h-5" />
        </IconButton>
      </div>

      <!-- Loading State -->
      <div v-if="loadingConversations" class="flex-1 flex items-center justify-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="conversations.length === 0" class="flex-1 flex flex-col items-center justify-center p-4">
        <Icon name="ChatBubbleLeftRight" class="w-12 h-12 mb-2 text-[var(--color-text-muted)]" />
        <p class="text-sm text-[var(--color-text-muted)] text-center">{{ $t('messages.empty') }}</p>
      </div>

      <!-- Conversations List -->
      <div v-else class="flex-1 overflow-y-auto">
        <button
          v-for="conv in conversations"
          :key="conv.id"
          @click="selectConversation(conv.id)"
          class="w-full p-3 flex items-center gap-3 hover:bg-[var(--color-hover)] transition-colors text-left border-b border-[var(--color-border)] last:border-b-0"
          :class="[
            activeConversationId === conv.id ? 'bg-[var(--color-surface-secondary)]' : '',
            conv.unreadCount > 0 ? 'bg-[var(--color-surface-secondary)]/50' : ''
          ]"
        >
          <div class="w-10 h-10 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden flex-shrink-0 flex items-center justify-center">
            <img
              v-if="conv.participant?.avatarUrl"
              :src="conv.participant.avatarUrl"
              :alt="conv.participant.username"
              class="w-full h-full object-cover"
            />
            <Icon v-else name="UserCircle" class="w-6 h-6 text-[var(--color-text-muted)]" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="font-medium truncate text-sm">
                {{ conv.participant?.displayName || conv.participant?.username }}
              </span>
              <span class="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 ml-2">
                {{ formatRelativeTime(conv.lastMessageAt) }}
              </span>
            </div>
            <p class="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
              {{ conv.lastMessage?.content || $t('messages.noMessages') }}
            </p>
          </div>
          <div v-if="conv.unreadCount > 0" class="flex-shrink-0">
            <span class="min-w-[18px] h-[18px] bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="flex-1 bg-[var(--color-surface)] rounded-lg overflow-hidden flex flex-col">
      <!-- No Conversation Selected -->
      <div v-if="!activeConversationId" class="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
        <Icon name="ChatBubbleLeftRight" class="w-16 h-16 mb-4" />
        <p>{{ $t('dashboard.messages.selectConversation') }}</p>
      </div>

      <!-- Active Conversation -->
      <template v-else>
        <!-- Header -->
        <div class="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <NuxtLink
            v-if="activeConversation?.participant"
            :to="`/users/${activeConversation.participant.username}${activeConversation.participant.domain ? `@${activeConversation.participant.domain}` : ''}`"
            class="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div class="w-10 h-10 rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden flex items-center justify-center">
              <img
                v-if="activeConversation.participant.avatarUrl"
                :src="activeConversation.participant.avatarUrl"
                :alt="activeConversation.participant.username"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="UserCircle" class="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <div class="font-medium">
                {{ activeConversation.participant.displayName || activeConversation.participant.username }}
              </div>
              <div class="text-xs text-[var(--color-text-muted)]">
                @{{ activeConversation.participant.username }}{{ activeConversation.participant.domain ? `@${activeConversation.participant.domain}` : '' }}
              </div>
            </div>
          </NuxtLink>
        </div>

        <!-- Loading Messages -->
        <div v-if="loadingMessages" class="flex-1 flex items-center justify-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
        </div>

        <!-- Messages -->
        <div
          v-else
          ref="messagesContainer"
          class="flex-1 overflow-y-auto p-4 space-y-3"
        >
          <!-- Load More Button -->
          <div v-if="hasMoreMessages" class="text-center">
            <button
              @click="loadMoreMessages"
              :disabled="loadingMoreMessages"
              class="px-4 py-2 text-sm text-[var(--color-primary)] hover:underline disabled:opacity-50"
            >
              {{ loadingMoreMessages ? $t('common.loading') : $t('messages.loadMore') }}
            </button>
          </div>

          <!-- Messages List -->
          <div
            v-for="message in chatMessages"
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
              <p class="whitespace-pre-wrap break-words text-sm">{{ message.content }}</p>
              <p
                class="text-[10px] mt-1"
                :class="message.senderId === currentUserId
                  ? 'text-[var(--color-primary-text)]/70'
                  : 'text-[var(--color-text-muted)]'"
              >
                {{ formatMessageTime(message.createdAt) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Message Input -->
        <div class="p-4 border-t border-[var(--color-border)]">
          <form @submit.prevent="sendMessage" class="flex gap-2">
            <input
              v-model="newChatMessage"
              type="text"
              :placeholder="$t('messages.writeMessage')"
              class="flex-1 px-4 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-sm"
              :disabled="sendingMessage"
            />
            <IconButton
              type="submit"
              variant="primary"
              size="md"
              shape="circle"
              :aria-label="$t('messages.send')"
              :disabled="!newChatMessage.trim() || sendingMessage"
            >
              <Icon name="PaperAirplane" class="w-5 h-5" />
            </IconButton>
          </form>
        </div>
      </template>
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
                  @{{ user.username }}{{ user.domain ? `@${user.domain}` : '' }}
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
                @{{ selectedRecipient.username }}{{ selectedRecipient.domain ? `@${selectedRecipient.domain}` : '' }}
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
            v-model="newConversationMessage"
            :placeholder="$t('messages.writeMessage')"
            rows="4"
            class="w-full px-4 py-2 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
          ></textarea>
        </div>

        <!-- Error Message -->
        <div v-if="createConversationError" class="mb-4 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg">
          <p class="text-sm text-[var(--color-danger-text)]">{{ createConversationError }}</p>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <BaseButton
            variant="secondary"
            size="md"
            shape="rounded"
            @click="showNewConversation = false"
          >
            {{ $t('common.cancel') }}
          </BaseButton>
          <BaseButton
            variant="primary"
            size="md"
            shape="rounded"
            :disabled="!selectedRecipient || !newConversationMessage.trim() || creatingConversation"
            @click="createConversation"
          >
            {{ creatingConversation ? $t('messages.sending') : $t('messages.send') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const { user } = useAuth()
const { fetchUnreadCount: fetchMessageUnreadCount } = useMessages()

// Current user ID
const currentUserId = computed(() => user.value?.id)

// Conversations
interface Participant {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
  domain?: string
}

interface Message {
  id: string
  content: string
  senderId: string
  createdAt: string
}

interface Conversation {
  id: string
  participant?: Participant
  lastMessage?: Message
  lastMessageAt: string
  unreadCount: number
}

const conversations = ref<Conversation[]>([])
const loadingConversations = ref(false)
const activeConversationId = ref<string | null>(null)
const activeConversation = ref<{ participant: Participant } | null>(null)
const chatMessages = ref<Message[]>([])
const loadingMessages = ref(false)
const newChatMessage = ref('')
const sendingMessage = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const messagePage = ref(1)
const totalChatMessages = ref(0)
const loadingMoreMessages = ref(false)

// New conversation modal
const showNewConversation = ref(false)
const searchQuery = ref('')
const searchResults = ref<Participant[]>([])
const selectedRecipient = ref<Participant | null>(null)
const newConversationMessage = ref('')
const creatingConversation = ref(false)
const createConversationError = ref('')

// Has more messages
const hasMoreMessages = computed(() => {
  return chatMessages.value.length < totalChatMessages.value
})

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

// Format message time
const formatMessageTime = (dateString: string) => {
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

// Fetch conversations
const fetchConversations = async () => {
  loadingConversations.value = true
  try {
    const data = await api.get<{ conversations: Conversation[] }>('/api/messages/conversations?limit=50')
    conversations.value = data.conversations
  } catch (error) {
    console.error('Failed to fetch conversations:', error)
  } finally {
    loadingConversations.value = false
  }
}

// Select conversation
const selectConversation = async (conversationId: string) => {
  activeConversationId.value = conversationId
  await fetchChatMessages(conversationId)
}

// Fetch chat messages
const fetchChatMessages = async (conversationId: string) => {
  loadingMessages.value = true
  messagePage.value = 1
  try {
    const data = await api.get<{
      id: string
      participant: Participant
      participants: Participant[]
      messages: Message[]
      totalMessages: number
    }>(`/api/messages/conversations/${conversationId}?page=1&limit=50`)

    activeConversation.value = data
    chatMessages.value = data.messages
    totalChatMessages.value = data.totalMessages

    // Mark as read
    await api.patch(`/api/messages/conversations/${conversationId}/read`)
    fetchMessageUnreadCount()

    // Update conversation unread count in list
    const conv = conversations.value.find(c => c.id === conversationId)
    if (conv) {
      conv.unreadCount = 0
    }

    // Scroll to bottom
    nextTick(() => {
      scrollToBottom()
    })
  } catch (error) {
    console.error('Failed to fetch messages:', error)
  } finally {
    loadingMessages.value = false
  }
}

// Load more messages
const loadMoreMessages = async () => {
  if (loadingMoreMessages.value || !hasMoreMessages.value || !activeConversationId.value) return

  loadingMoreMessages.value = true
  try {
    messagePage.value++
    const data = await api.get<{ messages: Message[]; totalMessages: number }>(
      `/api/messages/conversations/${activeConversationId.value}?page=${messagePage.value}&limit=50`,
    )

    // Prepend older messages
    chatMessages.value = [...data.messages, ...chatMessages.value]
    totalChatMessages.value = data.totalMessages
  } catch (error) {
    console.error('Failed to load more messages:', error)
    messagePage.value--
  } finally {
    loadingMoreMessages.value = false
  }
}

// Send message
const sendMessage = async () => {
  if (!newChatMessage.value.trim() || sendingMessage.value || !activeConversationId.value) return

  sendingMessage.value = true
  const content = newChatMessage.value.trim()
  newChatMessage.value = ''

  try {
    const message = await api.post<Message>(
      `/api/messages/conversations/${activeConversationId.value}/messages`,
      { content },
    )

    chatMessages.value.push(message)
    totalChatMessages.value++

    // Update conversation in list
    const conv = conversations.value.find(c => c.id === activeConversationId.value)
    if (conv) {
      conv.lastMessage = message
      conv.lastMessageAt = message.createdAt
    }

    // Scroll to bottom
    nextTick(() => {
      scrollToBottom()
    })
  } catch (error) {
    console.error('Failed to send message:', error)
    newChatMessage.value = content
  } finally {
    sendingMessage.value = false
  }
}

// Scroll to bottom
const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Search users for new conversation
let searchTimeout: ReturnType<typeof setTimeout>
const searchUsers = () => {
  clearTimeout(searchTimeout)
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    try {
      const data = await api.get<{ users?: { users: Participant[] } }>(
        `/api/search?q=${encodeURIComponent(searchQuery.value)}&type=users&limit=5`,
      )
      searchResults.value = data.users?.users || []
    } catch (error) {
      console.error('Failed to search users:', error)
    }
  }, 300)
}

// Select recipient
const selectRecipient = (user: Participant) => {
  selectedRecipient.value = user
  searchQuery.value = ''
  searchResults.value = []
}

// Create conversation
const createConversation = async () => {
  if (!selectedRecipient.value || !newConversationMessage.value.trim()) return

  creatingConversation.value = true
  createConversationError.value = ''
  try {
    const data = await api.post<{ conversation: Conversation; message: Message }>('/api/messages/conversations', {
      recipientId: selectedRecipient.value.id,
      initialMessage: newConversationMessage.value.trim(),
    })

    // Close modal and refresh
    showNewConversation.value = false
    selectedRecipient.value = null
    newConversationMessage.value = ''

    // Add to conversations list and select it
    await fetchConversations()
    selectConversation(data.conversation.id)
  } catch (error: any) {
    console.error('Failed to create conversation:', error)
    createConversationError.value = error?.data?.message || error?.message || t('messages.createError')
  } finally {
    creatingConversation.value = false
  }
}

// Polling for new messages
let pollingInterval: ReturnType<typeof setInterval>

const pollNewMessages = async () => {
  if (loadingMessages.value || !activeConversationId.value) return

  try {
    const data = await api.get<{ messages: Message[]; totalMessages: number }>(
      `/api/messages/conversations/${activeConversationId.value}?page=1&limit=50`,
    )

    // Check for new messages
    if (data.messages.length > 0) {
      const newMessages = data.messages.filter(
        (m) => !chatMessages.value.some((existing) => existing.id === m.id),
      )

      if (newMessages.length > 0) {
        chatMessages.value.push(...newMessages)
        totalChatMessages.value = data.totalMessages

        // Mark as read
        await api.patch(`/api/messages/conversations/${activeConversationId.value}/read`)
        fetchMessageUnreadCount()

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

// Initial fetch
onMounted(() => {
  fetchConversations()

  // Start polling for messages
  pollingInterval = setInterval(pollNewMessages, 10000)
})

onUnmounted(() => {
  clearInterval(pollingInterval)
})

// Expose refresh method
defineExpose({
  refresh: fetchConversations,
})
</script>
