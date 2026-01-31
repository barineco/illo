export default defineNuxtRouteMiddleware(async (to, from) => {
  const { isAuthenticated, fetchCurrentUser, user, refreshAccessToken } = useAuth()
  const runtimeConfig = useRuntimeConfig()
  const instanceId = runtimeConfig.public.instanceId || 'default'
  const accessToken = useCookie(`${instanceId}_accessToken`)
  const refreshToken = useCookie(`${instanceId}_refreshToken`)

  if (accessToken.value && !user.value) {
    try {
      await fetchCurrentUser()
    } catch (error) {
      if (refreshToken.value) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          try {
            await fetchCurrentUser()
          } catch {
            return navigateTo('/login')
          }
        } else {
          return navigateTo('/login')
        }
      } else {
        return navigateTo('/login')
      }
    }
  }

  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }
})
