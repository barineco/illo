/**
 * Redirect /@username to /users/username
 * This provides compatibility with Mastodon-style user URLs
 */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/@')) {
    const username = to.path.slice(2)

    if (username) {
      return navigateTo({
        path: `/users/${username}`,
        query: to.query,
      })
    }
  }
})
