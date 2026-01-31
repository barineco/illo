export default defineNuxtRouteMiddleware((to, from) => {
  const { user } = useAuth()

  // If user is already logged in, redirect to home
  if (user.value) {
    return navigateTo('/')
  }
})
