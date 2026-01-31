/**
 * Age Verification Composable
 *
 * Provides age verification state management for R-18/R-18G content.
 * Uses cookie-based verification for guest users and user.isAdult for authenticated users.
 */

export const useAgeVerification = () => {
  const { user } = useAuth()
  const runtimeConfig = useRuntimeConfig()
  const instanceId = runtimeConfig.public.instanceId || 'default'

  // Cookie: 7 days retention
  const ageVerifiedCookie = useCookie(`${instanceId}_ageVerified`, {
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  /**
   * Check if user can view adult content without age verification modal
   * @returns true = can view, false = needs age verification
   */
  const canViewAdultContent = computed(() => {
    // 1. Logged in user with isAdult flag
    if (user.value?.isAdult) {
      return true
    }

    // 2. Cookie-based verification for guest users
    if (ageVerifiedCookie.value === 'true') {
      return true
    }

    return false
  })

  /**
   * Mark age verification as complete (saves to cookie)
   */
  const confirmAgeVerification = () => {
    ageVerifiedCookie.value = 'true'
  }

  /**
   * Clear age verification (for testing or logout)
   */
  const clearAgeVerification = () => {
    ageVerifiedCookie.value = null
  }

  return {
    canViewAdultContent,
    confirmAgeVerification,
    clearAgeVerification,
  }
}
