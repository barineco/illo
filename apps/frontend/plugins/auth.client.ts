export default defineNuxtPlugin(async () => {
  const { fetchCurrentUser } = useAuth()
  const { refreshAccessToken, hasAccessToken, hasRefreshToken } = useTokenRefresh()

  // Restore user session on app initialization
  if (process.client) {
    try {
      // Case 1: Access token exists - fetch user directly
      if (hasAccessToken()) {
        await fetchCurrentUser()
      }
      // Case 2: No access token but refresh token exists - try to refresh first
      else if (hasRefreshToken()) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          await fetchCurrentUser()
        }
      }
      // Case 3: Neither token exists - user is not authenticated (no action needed)
    } catch (error) {
      // Silent fail - user is not authenticated
      console.debug('Session restoration failed:', error)
    }
  }
})
