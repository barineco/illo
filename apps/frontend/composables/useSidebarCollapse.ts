/**
 * Sidebar collapse state management composable
 * Handles user preference and responsive auto-collapse behavior
 */

// Breakpoint for tablet (768px)
const TABLET_BREAKPOINT = 768

// Transition duration in ms (should match CSS duration-300 = 300ms)
const TRANSITION_DURATION = 300

// Global state for sidebar collapse
const userCollapsed = ref(false)
const isSmallScreen = ref(false)

// Delayed state for text visibility (prevents text wrapping during transition)
const showText = ref(true)
let textVisibilityTimer: ReturnType<typeof setTimeout> | null = null

const initializeFromStorage = () => {
  if (import.meta.client) {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) {
      userCollapsed.value = stored === 'true'
      showText.value = !userCollapsed.value
    }
  }
}

const saveToStorage = (value: boolean) => {
  if (import.meta.client) {
    localStorage.setItem('sidebar-collapsed', String(value))
  }
}

const checkScreenSize = () => {
  if (import.meta.client) {
    isSmallScreen.value = window.innerWidth < TABLET_BREAKPOINT
  }
}

export const useSidebarCollapse = () => {
  const isCollapsed = computed(() => isSmallScreen.value || userCollapsed.value)
  const canToggle = computed(() => !isSmallScreen.value)

  const updateTextVisibility = (collapsed: boolean) => {
    if (textVisibilityTimer) {
      clearTimeout(textVisibilityTimer)
      textVisibilityTimer = null
    }

    if (collapsed) {
      // Hide text immediately when collapsing
      showText.value = false
    } else {
      // Show text after transition completes when expanding
      textVisibilityTimer = setTimeout(() => {
        showText.value = true
      }, TRANSITION_DURATION)
    }
  }

  const toggle = () => {
    if (canToggle.value) {
      const newValue = !userCollapsed.value
      userCollapsed.value = newValue
      saveToStorage(newValue)
      updateTextVisibility(newValue)
    }
  }

  const expand = () => {
    if (canToggle.value) {
      userCollapsed.value = false
      saveToStorage(false)
      updateTextVisibility(false)
    }
  }

  const collapse = () => {
    if (canToggle.value) {
      userCollapsed.value = true
      saveToStorage(true)
      updateTextVisibility(true)
    }
  }

  return {
    isCollapsed,
    canToggle,
    isSmallScreen: computed(() => isSmallScreen.value),
    showText: computed(() => showText.value),
    toggle,
    expand,
    collapse,
  }
}

/**
 * Setup responsive listener for sidebar collapse
 * Call this once in your layout component
 */
export const useSidebarCollapseListener = () => {
  onMounted(() => {
    initializeFromStorage()
    checkScreenSize()

    window.addEventListener('resize', checkScreenSize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', checkScreenSize)
  })
}
