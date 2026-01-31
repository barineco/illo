/**
 * Composable for fetching and managing signed image URLs
 *
 * Signed URLs provide time-limited access tokens for images,
 * protecting against unauthorized embedding and direct URL sharing.
 *
 * When signed URLs are disabled on the backend, falls back to regular image URLs.
 */
export const useSignedImageUrl = (imageId: Ref<string> | string, thumbnail: boolean = false) => {
  const api = useApi()
  const config = useRuntimeConfig()

  const signedUrl = ref('')
  const expiresAt = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  // Resolve imageId to a reactive value
  const resolvedImageId = computed(() => {
    return typeof imageId === 'string' ? imageId : imageId.value
  })

  /**
   * Fetch a new signed URL from the backend
   */
  async function fetchSignedUrl() {
    const id = resolvedImageId.value
    if (!id) {
      signedUrl.value = ''
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const params = thumbnail ? '?thumb=true' : ''
      const result = await api.get<{ url: string; expiresAt: number }>(
        `/api/images/${id}/signed-url${params}`
      )

      signedUrl.value = result.url
      expiresAt.value = result.expiresAt

      // Schedule refresh 30 seconds before expiration
      scheduleRefresh()
    } catch (err: any) {
      // If signed URLs are disabled (403), fall back to direct URL
      if (err?.status === 403 || err?.data?.statusCode === 403) {
        // Fall back to regular image URL
        const thumbParam = thumbnail ? '?thumb=true' : ''
        signedUrl.value = `${api.baseURL}/api/images/${id}${thumbParam}`
        error.value = null
      } else {
        error.value = err?.message || 'Failed to fetch signed URL'
        console.error('[useSignedImageUrl] Error:', err)
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Schedule automatic refresh before the URL expires
   */
  function scheduleRefresh() {
    // Clear existing timer
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }

    if (expiresAt.value <= 0) return

    const now = Math.floor(Date.now() / 1000)
    const refreshIn = (expiresAt.value - now - 30) * 1000 // 30 seconds before expiration

    if (refreshIn > 0) {
      refreshTimer = setTimeout(() => {
        fetchSignedUrl()
      }, refreshIn)
    }
  }

  /**
   * Manual refresh function
   */
  function refresh() {
    return fetchSignedUrl()
  }

  /**
   * Clear the timer on cleanup
   */
  function cleanup() {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  // Watch for imageId changes
  watch(resolvedImageId, (newId, oldId) => {
    if (newId !== oldId) {
      cleanup()
      if (newId) {
        fetchSignedUrl()
      } else {
        signedUrl.value = ''
        expiresAt.value = 0
      }
    }
  })

  // Initial fetch on mount (client-side only)
  onMounted(() => {
    if (resolvedImageId.value) {
      fetchSignedUrl()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    signedUrl: readonly(signedUrl),
    expiresAt: readonly(expiresAt),
    isLoading: readonly(isLoading),
    error: readonly(error),
    refresh,
  }
}

/**
 * Composable for generating signed image URLs without automatic refresh
 * Useful for one-time URL generation or manual management
 */
export const useSignedImageUrlOnce = () => {
  const api = useApi()

  /**
   * Get a signed URL for an image (one-time fetch, no auto-refresh)
   * @param imageId - Image ID
   * @param thumbnail - Whether to get thumbnail (320px)
   * @param original - Whether to get original full-size image (for viewer)
   */
  async function getSignedUrl(imageId: string, thumbnail: boolean = false, original: boolean = false): Promise<string> {
    try {
      const params = new URLSearchParams()
      if (thumbnail) params.append('thumb', 'true')
      if (original) params.append('original', 'true')

      const queryString = params.toString()
      const url = `/api/images/${imageId}/signed-url${queryString ? '?' + queryString : ''}`

      const result = await api.get<{ url: string; expiresAt: number }>(url)
      return result.url
    } catch (err: any) {
      // If signed URLs are disabled, fall back to direct URL
      if (err?.status === 403 || err?.data?.statusCode === 403) {
        const params = new URLSearchParams()
        if (thumbnail) params.append('thumb', 'true')
        if (original) params.append('original', 'true')

        const queryString = params.toString()
        return `${api.baseURL}/api/images/${imageId}${queryString ? '?' + queryString : ''}`
      }
      throw err
    }
  }

  return {
    getSignedUrl,
  }
}
