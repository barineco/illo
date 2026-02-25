import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'

vi.stubGlobal(
  'ref',
  (val: any) => ref(val),
)

import { useCapsLock } from './useCapsLock'

describe('useCapsLock', () => {
  it('initializes as false', () => {
    const { isCapsLockOn } = useCapsLock()
    expect(isCapsLockOn.value).toBe(false)
  })

  it('detects CapsLock on', () => {
    const { isCapsLockOn, handleKeyEvent } = useCapsLock()
    handleKeyEvent({
      getModifierState: (key: string) => key === 'CapsLock',
    } as unknown as KeyboardEvent)
    expect(isCapsLockOn.value).toBe(true)
  })

  it('detects CapsLock off', () => {
    const { isCapsLockOn, handleKeyEvent } = useCapsLock()
    handleKeyEvent({
      getModifierState: () => true,
    } as unknown as KeyboardEvent)
    handleKeyEvent({
      getModifierState: () => false,
    } as unknown as KeyboardEvent)
    expect(isCapsLockOn.value).toBe(false)
  })

  it('resets CapsLock state', () => {
    const { isCapsLockOn, handleKeyEvent, resetCapsLock } = useCapsLock()
    handleKeyEvent({
      getModifierState: () => true,
    } as unknown as KeyboardEvent)
    resetCapsLock()
    expect(isCapsLockOn.value).toBe(false)
  })

  it('handles event without getModifierState', () => {
    const { isCapsLockOn, handleKeyEvent } = useCapsLock()
    handleKeyEvent({} as KeyboardEvent)
    expect(isCapsLockOn.value).toBe(false)
  })
})
