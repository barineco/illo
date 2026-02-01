/**
 * User Interaction Tracking Composable
 *
 * Tracks user interactions (mouse, touch, keyboard, scroll) to distinguish
 * real users from headless browsers/bots. Generates and manages interaction
 * tokens that are sent with API requests.
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'

const STORAGE_KEY = 'user_interaction_token'
const INTERACTION_FLAG_KEY = 'user_real_interaction'
const TOKEN_VALIDITY = 300 // 5 minutes in seconds

interface InteractionToken {
  timestamp: number
  signature: string
}

let hasInteraction = ref(false)
let hasRealInteraction = ref(false) // Track actual user events
let interactionToken = ref<string | null>(null)
let eventListenersAttached = false
let tokenGenerationPromise: Promise<string> | null = null

// Eagerly start token generation on client side
if (import.meta.client) {
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (stored && isTokenValid(stored)) {
    interactionToken.value = stored
  } else {
    // Start token generation immediately (don't wait)
    tokenGenerationPromise = generateToken().then(token => {
      interactionToken.value = token
      tokenGenerationPromise = null
      return token
    })
  }
}

/**
 * Generate HMAC-SHA256 signature using Web Crypto API
 */
async function generateHmac(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(message)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Generate interaction token
 */
async function generateToken(): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  // Use HMAC-SHA256 with a secret (should match backend secret)
  const secret = useRuntimeConfig().public.interactionSecret || 'default-secret-change-me'
  console.log('[generateToken] Using secret:', secret.substring(0, 20) + '...')
  const signature = await generateHmac(timestamp.toString(), secret)

  const token = `${timestamp}:${signature}`
  console.log('[generateToken] Generated token:', token)

  // Store in sessionStorage
  if (import.meta.client) {
    sessionStorage.setItem(STORAGE_KEY, token)
  }

  return token
}

/**
 * Handle real user interaction event (mouse, touch, keyboard, scroll)
 */
function handleRealInteraction() {
  if (!hasRealInteraction.value) {
    hasRealInteraction.value = true
    console.log('[handleRealInteraction] Real user interaction detected')

    // Store in sessionStorage
    if (import.meta.client) {
      sessionStorage.setItem(INTERACTION_FLAG_KEY, 'true')
    }

    // Remove event listeners after first interaction
    removeEventListeners()
  }
}

/**
 * Attach event listeners for user interactions
 */
function attachEventListeners() {
  if (eventListenersAttached || !import.meta.client) return

  const events = [
    'mousemove',
    'mousedown',
    'touchstart',
    'touchmove',
    'keydown',
    'scroll',
    'click',
  ]

  events.forEach(event => {
    window.addEventListener(event, handleRealInteraction, { once: true, passive: true })
  })

  eventListenersAttached = true
}

/**
 * Remove event listeners
 */
function removeEventListeners() {
  if (!eventListenersAttached || !import.meta.client) return

  const events = [
    'mousemove',
    'mousedown',
    'touchstart',
    'touchmove',
    'keydown',
    'scroll',
    'click',
  ]

  events.forEach(event => {
    window.removeEventListener(event, handleRealInteraction)
  })

  eventListenersAttached = false
}

/**
 * Check if stored token is valid
 */
function isTokenValid(token: string): boolean {
  try {
    const [timestampStr] = token.split(':')
    const timestamp = parseInt(timestampStr, 10)
    const now = Math.floor(Date.now() / 1000)
    const age = now - timestamp

    console.log('[isTokenValid] timestamp:', timestamp, 'now:', now, 'age:', age, 'valid:', age >= 0 && age <= TOKEN_VALIDITY)

    return age >= 0 && age <= TOKEN_VALIDITY
  } catch (error) {
    console.log('[isTokenValid] Error:', error)
    return false
  }
}

export function useUserInteraction() {
  onMounted(async () => {
    if (!import.meta.client) return

    console.log('[useUserInteraction] onMounted called')

    // Check for existing real interaction flag
    const realInteractionFlag = sessionStorage.getItem(INTERACTION_FLAG_KEY)
    if (realInteractionFlag === 'true') {
      hasRealInteraction.value = true
      console.log('[useUserInteraction] Previous real interaction detected')
    }

    // Check for existing valid token
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored && isTokenValid(stored)) {
      console.log('[useUserInteraction] Using existing token')
      hasInteraction.value = true
      interactionToken.value = stored
    } else {
      // Generate token immediately on page load
      // This ensures the token is available for the first API request
      console.log('[useUserInteraction] Generating new token')
      hasInteraction.value = true
      interactionToken.value = await generateToken()
      console.log('[useUserInteraction] Token generated:', interactionToken.value?.substring(0, 20) + '...')
    }

    // Always attach event listeners to detect real interactions
    // (unless we already detected interaction in this session)
    if (!hasRealInteraction.value) {
      attachEventListeners()
    }
  })

  onBeforeUnmount(() => {
    removeEventListeners()
  })

  /**
   * Get current interaction token
   * Returns null if no interaction has occurred yet
   */
  function getToken(): string | null {
    if (!import.meta.client) {
      console.log('[getToken] Not client side')
      return null
    }

    // First, try to read from sessionStorage
    const stored = sessionStorage.getItem(STORAGE_KEY)
    console.log('[getToken] sessionStorage value:', stored ? 'EXISTS' : 'NULL')
    if (stored && isTokenValid(stored)) {
      console.log('[getToken] Token valid, returning:', stored.substring(0, 20) + '...')
      return stored
    }

    // If sessionStorage doesn't have a valid token, but we have one in memory, use it
    if (interactionToken.value && isTokenValid(interactionToken.value)) {
      console.log('[getToken] Using in-memory token:', interactionToken.value.substring(0, 20) + '...')
      return interactionToken.value
    }

    console.log('[getToken] Token invalid or missing')
    return null
  }

  /**
   * Check if real user interaction has occurred
   */
  function hasRealUserInteraction(): boolean {
    if (!import.meta.client) return false

    // Check both in-memory flag and sessionStorage
    if (hasRealInteraction.value) return true

    const stored = sessionStorage.getItem(INTERACTION_FLAG_KEY)
    if (stored === 'true') {
      hasRealInteraction.value = true
      return true
    }

    return false
  }

  /**
   * Force generate a new token (for testing)
   */
  async function forceGenerateToken(): Promise<string> {
    const token = await generateToken()
    hasInteraction.value = true
    interactionToken.value = token
    return token
  }

  return {
    hasInteraction,
    interactionToken,
    getToken,
    hasRealUserInteraction,
    forceGenerateToken,
  }
}
