type RateLimitTier = 'NORMAL' | 'WARNING' | 'SOFT_LIMIT' | 'HARD_LIMIT'

export function useRateLimitState() {
  // Using useState for SSR compatibility
  const isLimited = useState('rateLimitIsLimited', () => false)
  const tier = useState<RateLimitTier>('rateLimitTier', () => 'NORMAL')
  const resetAt = useState<number | null>('rateLimitResetAt', () => null)
  const toastShown = useState('rateLimitToastShown', () => false)

  function checkExpiry() {
    if (resetAt.value && Date.now() >= resetAt.value) {
      clearLimit()
    }
  }

  function clearLimit() {
    isLimited.value = false
    tier.value = 'NORMAL'
    resetAt.value = null
    toastShown.value = false
  }

  function setLimited(newTier: RateLimitTier, newResetAt: number | null) {
    isLimited.value = true
    tier.value = newTier
    resetAt.value = newResetAt
  }

  function markToastShown() {
    toastShown.value = true
  }

  /**
   * Process rate limit info from API response
   * The artwork response will include these fields when rate limited:
   * - images with degraded: true
   * We detect this and show the toast
   */
  function processArtworkResponse(artwork: { images?: Array<{ degraded?: boolean }> }) {
    if (!artwork.images) return

    const hasDegradedImages = artwork.images.some((img) => img.degraded === true)

    if (hasDegradedImages && !isLimited.value) {
      // We're being rate limited
      setLimited('SOFT_LIMIT', null) // Reset time comes from headers which we can't access here

      // Show toast only once per penalty period
      if (!toastShown.value && import.meta.client) {
        const { warning } = useToast()
        const { t } = useI18n()
        warning(t('rateLimit.qualityDegraded'), 6000)
        markToastShown()
      }
    }
  }

  onMounted(() => {
    if (import.meta.client) {
      const checkInterval = setInterval(checkExpiry, 10000)
      onUnmounted(() => clearInterval(checkInterval))
    }
  })

  return {
    isLimited: readonly(isLimited),
    tier: readonly(tier),
    resetAt: readonly(resetAt),
    toastShown: readonly(toastShown),
    setLimited,
    clearLimit,
    markToastShown,
    checkExpiry,
    processArtworkResponse,
  }
}
