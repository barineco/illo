// Global notification state shared between NotificationDropdown and Dashboard
const unreadCount = ref(0)

export function useNotifications() {
  const api = useApi()

  const fetchUnreadCount = async () => {
    try {
      const data = await api.get<{ count: number }>('/api/notifications/unread-count')
      unreadCount.value = data.count
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  const setUnreadCount = (count: number) => {
    unreadCount.value = Math.max(0, count)
  }

  const decrementUnreadCount = () => {
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }

  const resetUnreadCount = () => {
    unreadCount.value = 0
  }

  const formattedUnreadCount = computed(() => {
    if (unreadCount.value > 30) {
      return '30+'
    }
    return unreadCount.value.toString()
  })

  return {
    unreadCount: readonly(unreadCount),
    formattedUnreadCount,
    fetchUnreadCount,
    setUnreadCount,
    decrementUnreadCount,
    resetUnreadCount,
  }
}
