/**
 * Composable to detect Caps Lock state on keyboard events
 */
export function useCapsLock() {
  const isCapsLockOn = ref(false)

  const handleKeyEvent = (event: KeyboardEvent) => {
    // getModifierState is supported in modern browsers
    if (typeof event.getModifierState === 'function') {
      isCapsLockOn.value = event.getModifierState('CapsLock')
    }
  }

  const resetCapsLock = () => {
    isCapsLockOn.value = false
  }

  return {
    isCapsLockOn,
    handleKeyEvent,
    resetCapsLock,
  }
}
