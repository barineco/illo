export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

const MAX_TOASTS = 5
const DEFAULT_DURATION = 4000

// Global state for toasts
const toasts = ref<Toast[]>([])

export function useToast() {
  const add = (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? DEFAULT_DURATION,
    }

    // Add to the end (newest at bottom)
    toasts.value.push(newToast)

    // If exceeds max, remove the oldest (first)
    if (toasts.value.length > MAX_TOASTS) {
      toasts.value.shift()
    }

    // Auto remove after duration
    const duration = newToast.duration ?? DEFAULT_DURATION
    if (duration > 0) {
      setTimeout(() => {
        remove(id)
      }, duration)
    }

    return id
  }

  const remove = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (message: string, duration?: number) => {
    return add({ type: 'success', message, duration })
  }

  const error = (message: string, duration?: number) => {
    return add({ type: 'error', message, duration })
  }

  const info = (message: string, duration?: number) => {
    return add({ type: 'info', message, duration })
  }

  const warning = (message: string, duration?: number) => {
    return add({ type: 'warning', message, duration })
  }

  const clear = () => {
    toasts.value = []
  }

  return {
    toasts: readonly(toasts),
    add,
    addToast: add, // Alias for backward compatibility
    remove,
    success,
    error,
    info,
    warning,
    clear,
  }
}
