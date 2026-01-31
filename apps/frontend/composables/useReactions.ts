import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'

export interface ReactionSummary {
  emoji: string
  count: number
  userReacted: boolean
}

export interface ReactionResponse {
  reactions: Array<{ emoji: string; count: number }>
  total: number
}

export interface UserReactionsResponse {
  emojis: string[]
}

export function useReactions(artworkId: string) {
  const api = useApi()

  // State
  const reactions = ref<ReactionSummary[]>([])
  const userEmojis = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Pending reactions for optimistic UI
  const pendingReactions = ref<Map<string, 'add' | 'remove'>>(new Map())

  // Total reaction count
  const totalCount = computed(() => {
    return reactions.value.reduce((sum, r) => sum + r.count, 0)
  })

  const fetchReactions = async () => {
    if (!artworkId) return

    isLoading.value = true
    error.value = null

    try {
      const [reactionsData, userReactionsData] = await Promise.all([
        api.get<ReactionResponse>(`/api/reactions/${artworkId}`),
        api.get<UserReactionsResponse>(`/api/reactions/${artworkId}/check`),
      ])

      userEmojis.value = userReactionsData.emojis || []

      reactions.value = reactionsData.reactions.map(r => ({
        emoji: r.emoji,
        count: r.count,
        userReacted: userEmojis.value.includes(r.emoji),
      }))
    } catch (e: any) {
      error.value = e.message || 'Failed to load reactions'
      console.error('Failed to fetch reactions:', e)
    } finally {
      isLoading.value = false
    }
  }

  const updateLocalState = (emoji: string, action: 'add' | 'remove') => {
    const existingIndex = reactions.value.findIndex(r => r.emoji === emoji)

    if (action === 'add') {
      if (existingIndex >= 0) {
        // Increment existing reaction
        reactions.value[existingIndex].count++
        reactions.value[existingIndex].userReacted = true
      } else {
        // Add new reaction
        reactions.value.push({
          emoji,
          count: 1,
          userReacted: true,
        })
      }
      if (!userEmojis.value.includes(emoji)) {
        userEmojis.value.push(emoji)
      }
    } else {
      if (existingIndex >= 0) {
        // Decrement existing reaction
        reactions.value[existingIndex].count--
        reactions.value[existingIndex].userReacted = false

        // Remove if count is 0
        if (reactions.value[existingIndex].count <= 0) {
          reactions.value.splice(existingIndex, 1)
        }
      }
      const userIndex = userEmojis.value.indexOf(emoji)
      if (userIndex >= 0) {
        userEmojis.value.splice(userIndex, 1)
      }
    }
  }

  const flushPendingReactions = async () => {
    if (pendingReactions.value.size === 0) return

    const pending = new Map(pendingReactions.value)
    pendingReactions.value.clear()

    for (const [emoji, action] of pending) {
      try {
        if (action === 'add') {
          await api.post(`/api/reactions/${artworkId}`, { emoji })
        } else {
          await api.delete(`/api/reactions/${artworkId}/${encodeURIComponent(emoji)}`)
        }
      } catch (e) {
        console.error(`Failed to ${action} reaction:`, e)
        // Revert optimistic update on error
        updateLocalState(emoji, action === 'add' ? 'remove' : 'add')
      }
    }
  }

  const debouncedFlush = useDebounceFn(flushPendingReactions, 500)

  const toggleReaction = (emoji: string) => {
    const isCurrentlyReacted = userEmojis.value.includes(emoji)
    const action = isCurrentlyReacted ? 'remove' : 'add'

    const pendingAction = pendingReactions.value.get(emoji)
    if (pendingAction && pendingAction !== action) {
      pendingReactions.value.delete(emoji)
    } else {
      pendingReactions.value.set(emoji, action)
    }

    updateLocalState(emoji, action)
    debouncedFlush()
  }

  const addReaction = (emoji: string) => {
    if (userEmojis.value.includes(emoji)) {
      toggleReaction(emoji)
      return
    }

    pendingReactions.value.set(emoji, 'add')
    updateLocalState(emoji, 'add')
    debouncedFlush()
  }

  const hasReacted = (emoji: string): boolean => {
    return userEmojis.value.includes(emoji)
  }

  const getReactionCount = (emoji: string): number => {
    const reaction = reactions.value.find(r => r.emoji === emoji)
    return reaction?.count || 0
  }

  return {
    reactions,
    userEmojis,
    isLoading,
    error,
    totalCount,
    fetchReactions,
    toggleReaction,
    addReaction,
    hasReacted,
    getReactionCount,
  }
}
