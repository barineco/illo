// Global message state shared across components
const unreadMessageCount = ref(0)

export function useMessages() {
  const api = useApi()

  const fetchUnreadCount = async () => {
    try {
      const data = await api.get<{ count: number }>('/api/messages/unread-count')
      unreadMessageCount.value = data.count
    } catch (error) {
      console.error('Failed to fetch unread message count:', error)
    }
  }

  const setUnreadCount = (count: number) => {
    unreadMessageCount.value = Math.max(0, count)
  }

  const resetUnreadCount = () => {
    unreadMessageCount.value = 0
  }

  const formattedUnreadCount = computed(() => {
    if (unreadMessageCount.value > 30) {
      return '30+'
    }
    return unreadMessageCount.value.toString()
  })

  return {
    unreadMessageCount: readonly(unreadMessageCount),
    formattedUnreadCount,
    fetchUnreadCount,
    setUnreadCount,
    resetUnreadCount,
  }
}
