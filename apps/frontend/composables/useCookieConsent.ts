/**
 * Cookie consent management composable
 * Manages user's consent to cookies with long-term storage
 */
export const useCookieConsent = () => {
  const runtimeConfig = useRuntimeConfig()
  const instanceId = runtimeConfig.public.instanceId || 'default'

  // Cookie consent - 1 year retention
  const cookieConsentCookie = useCookie(`${instanceId}_cookieConsent`, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
    sameSite: 'lax',
  })

  const hasConsented = computed(() => cookieConsentCookie.value === 'accepted')

  const acceptCookies = () => {
    cookieConsentCookie.value = 'accepted'
  }

  const resetConsent = () => {
    cookieConsentCookie.value = null
  }

  return {
    hasConsented,
    acceptCookies,
    resetConsent,
  }
}
