/**
 * Global dropdown management composable
 * Ensures only one dropdown is open at a time across the entire application
 */

// Global state - only one dropdown can be active at a time
const activeDropdownId = ref<string | null>(null)

export const useDropdown = (dropdownId: string) => {
  const isOpen = computed(() => activeDropdownId.value === dropdownId)

  const open = () => {
    activeDropdownId.value = dropdownId
  }

  const close = () => {
    if (activeDropdownId.value === dropdownId) {
      activeDropdownId.value = null
    }
  }

  const toggle = () => {
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }

  const closeAll = () => {
    activeDropdownId.value = null
  }

  return {
    isOpen,
    open,
    close,
    toggle,
    closeAll,
  }
}

/**
 * Setup global click handler to close dropdowns when clicking outside
 * Call this once in your layout or app component
 */
export const useGlobalDropdownClickHandler = () => {
  const handleGlobalClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const isInsideDropdown = target.closest('[data-dropdown-container]')

    if (!isInsideDropdown) {
      activeDropdownId.value = null
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleGlobalClick, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick, true)
  })
}
