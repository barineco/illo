/**
 * Token refresh composable
 *
 * Provides token refresh functionality separated from useAuth to avoid circular dependencies.
 * Handles:
 * - Token refresh with duplicate request prevention
 * - Token state management (access/refresh tokens)
 * - Cookie management
 */

// Singleton state for refresh coordination across multiple requests
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

export const useTokenRefresh = () => {
  const config = useRuntimeConfig()
  const instanceId = config.public.instanceId || 'default'

  // Access token always has 15 minute maxAge
  const accessToken = useCookie(`${instanceId}_accessToken`, { maxAge: 60 * 15 })
  // Refresh token maxAge is set during login based on rememberMe setting
  // Here we just read the existing cookie value
  const refreshToken = useCookie(`${instanceId}_refreshToken`)

  /**
   * Refresh access token with duplicate prevention
   * Multiple concurrent calls will share the same refresh promise
   */
  const refreshAccessToken = async (): Promise<boolean> => {
    // No refresh token available
    if (!refreshToken.value) {
      return false
    }

    // If already refreshing, wait for the existing promise
    if (isRefreshing && refreshPromise) {
      return refreshPromise
    }

    isRefreshing = true

    refreshPromise = (async () => {
      try {
        let baseURL = ''
        if (import.meta.server) {
          baseURL =
            process.env.API_BASE_SERVER ||
            config.apiBaseServer ||
            config.public.apiBase ||
            ''
        } else {
          baseURL = config.public.apiBase || ''
        }

        const response = await $fetch<{ accessToken: string }>(
          `${baseURL}/api/auth/refresh`,
          {
            method: 'POST',
            body: { refreshToken: refreshToken.value },
          }
        )

        accessToken.value = response.accessToken
        return true
      } catch (error) {
        console.error('Token refresh failed:', error)
        // Clear tokens on refresh failure
        accessToken.value = null
        refreshToken.value = null
        return false
      } finally {
        isRefreshing = false
        refreshPromise = null
      }
    })()

    return refreshPromise
  }

  /**
   * Check if access token exists
   */
  const hasAccessToken = () => !!accessToken.value

  /**
   * Check if refresh token exists
   */
  const hasRefreshToken = () => !!refreshToken.value

  /**
   * Clear both tokens (for logout)
   */
  const clearTokens = () => {
    accessToken.value = null
    refreshToken.value = null
  }

  /**
   * Get current access token value
   */
  const getAccessToken = () => accessToken.value

  /**
   * Get current refresh token value
   */
  const getRefreshToken = () => refreshToken.value

  /**
   * Set tokens (for login)
   */
  const setTokens = (tokens: {
    accessToken: string
    refreshToken?: string
  }) => {
    accessToken.value = tokens.accessToken
    if (tokens.refreshToken) {
      refreshToken.value = tokens.refreshToken
    }
  }

  return {
    refreshAccessToken,
    hasAccessToken,
    hasRefreshToken,
    clearTokens,
    getAccessToken,
    getRefreshToken,
    setTokens,
  }
}
