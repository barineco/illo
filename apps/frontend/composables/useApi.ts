export const useApi = () => {
  const config = useRuntimeConfig()
  // SSR: use server-only apiBaseServer (internal Docker URL)
  // Client: use public.apiBase (relative path or public URL)
  // Note: Server-side環境変数はprocess.envから直接読む（Nuxtのビルド時に固定されないように）
  let baseURL = ''
  if (import.meta.server) {
    baseURL = process.env.API_BASE_SERVER || config.apiBaseServer || config.public.apiBase || ''
  } else {
    baseURL = config.public.apiBase || ''
  }

  const instanceId = config.public.instanceId || 'default'

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {}

    const token = useCookie(`${instanceId}_accessToken`)
    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`
    }

    // Add user interaction token on client side
    if (import.meta.client) {
      const { getToken, hasRealUserInteraction } = useUserInteraction()
      const interactionToken = getToken()
      const realInteraction = hasRealUserInteraction()

      console.log('[useApi] Interaction token:', interactionToken ? 'PRESENT' : 'MISSING')
      console.log('[useApi] Real user interaction:', realInteraction)

      if (interactionToken) {
        headers['X-User-Interaction-Token'] = interactionToken
      }
      headers['X-Real-User-Interaction'] = realInteraction ? 'true' : 'false'

      const { getFingerprint } = useDeviceFingerprint()
      const fingerprint = getFingerprint()
      if (fingerprint) {
        headers['X-Device-Fingerprint'] = fingerprint
      }
    }

    return headers
  }

  /**
   * Extract status code from various error formats
   */
  const getStatusCode = (error: any): number | undefined => {
    return error?.statusCode || error?.response?.status || error?.status
  }

  /**
   * Execute request with automatic token refresh on 401
   * @param requestFn Function that performs the actual request
   * @param retried Whether this is a retry after token refresh
   */
  const executeWithRetry = async <T>(
    requestFn: () => Promise<T>,
    retried: boolean = false
  ): Promise<T> => {
    try {
      return await requestFn()
    } catch (error: any) {
      const statusCode = getStatusCode(error)

      // On 401 error and not yet retried, try to refresh token
      if (statusCode === 401 && !retried) {
        // Only attempt refresh on client side
        if (import.meta.client) {
          const { refreshAccessToken, hasRefreshToken } = useTokenRefresh()

          if (hasRefreshToken()) {
            const refreshed = await refreshAccessToken()
            if (refreshed) {
              // Retry the original request
              return executeWithRetry(requestFn, true)
            }
          }
        }
      }

      // Re-throw the error if refresh failed or other error
      throw error
    }
  }

  /**
   * Execute XHR request with automatic token refresh on 401
   */
  const executeXhrWithRetry = <T>(
    method: 'POST' | 'PUT',
    endpoint: string,
    formData: FormData,
    onProgress: (percent: number) => void,
    retried: boolean = false
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      })

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response as T)
          } catch {
            reject(new Error('Invalid JSON response'))
          }
        } else if (xhr.status === 401 && !retried) {
          // Try to refresh token on 401
          const { refreshAccessToken, hasRefreshToken } = useTokenRefresh()

          if (hasRefreshToken()) {
            const refreshed = await refreshAccessToken()
            if (refreshed) {
              // Retry with new token
              executeXhrWithRetry<T>(method, endpoint, formData, onProgress, true)
                .then(resolve)
                .catch(reject)
              return
            }
          }
          // Refresh failed or no refresh token
          try {
            const errorData = JSON.parse(xhr.responseText)
            reject({ data: errorData, status: xhr.status })
          } catch {
            reject(new Error(`Request failed with status ${xhr.status}`))
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText)
            reject({ data: errorData, status: xhr.status })
          } catch {
            reject(new Error(`Request failed with status ${xhr.status}`))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'))
      })

      xhr.open(method, `${baseURL}${endpoint}`)

      const authHeaders = getAuthHeaders()
      Object.entries(authHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value)
      })

      xhr.send(formData)
    })
  }

  const api = {
    // Expose baseURL for direct fetch usage
    baseURL,

    async get<T>(endpoint: string, options?: { params?: Record<string, any> }): Promise<T> {
      return executeWithRetry(async () => {
        const headers = {
          ...getAuthHeaders(),
          Accept: 'application/json',
        }

        return await $fetch<T>(`${baseURL}${endpoint}`, {
          method: 'GET',
          headers,
          params: options?.params,
          // Prevent inheriting request headers in SSR
          ...(import.meta.server ? { context: undefined } : {}),
        })
      })
    },

    async post<T>(endpoint: string, body?: any): Promise<T> {
      return executeWithRetry(async () => {
        return await $fetch<T>(`${baseURL}${endpoint}`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            Accept: 'application/json',
          },
          body,
        })
      })
    },

    async put<T>(endpoint: string, body?: any): Promise<T> {
      return executeWithRetry(async () => {
        return await $fetch<T>(`${baseURL}${endpoint}`, {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            Accept: 'application/json',
          },
          body,
        })
      })
    },

    async patch<T>(endpoint: string, body?: any): Promise<T> {
      return executeWithRetry(async () => {
        return await $fetch<T>(`${baseURL}${endpoint}`, {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            Accept: 'application/json',
          },
          body,
        })
      })
    },

    async delete<T>(endpoint: string): Promise<T> {
      return executeWithRetry(async () => {
        return await $fetch<T>(`${baseURL}${endpoint}`, {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders(),
            Accept: 'application/json',
          },
        })
      })
    },

    async uploadFormData<T>(endpoint: string, formData: FormData): Promise<T> {
      return executeWithRetry(async () => {
        return await $fetch<T>(`${baseURL}${endpoint}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        })
      })
    },

    async updateFormData<T>(endpoint: string, formData: FormData): Promise<T> {
      return executeWithRetry(async () => {
        return await $fetch<T>(`${baseURL}${endpoint}`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: formData,
        })
      })
    },

    /**
     * Upload FormData with progress tracking using XMLHttpRequest
     * @param endpoint API endpoint
     * @param formData FormData to upload
     * @param onProgress Callback for progress updates (0-100)
     */
    uploadFormDataWithProgress<T>(
      endpoint: string,
      formData: FormData,
      onProgress: (percent: number) => void
    ): Promise<T> {
      return executeXhrWithRetry<T>('POST', endpoint, formData, onProgress)
    },

    /**
     * Update FormData with progress tracking using XMLHttpRequest
     * @param endpoint API endpoint
     * @param formData FormData to upload
     * @param onProgress Callback for progress updates (0-100)
     */
    updateFormDataWithProgress<T>(
      endpoint: string,
      formData: FormData,
      onProgress: (percent: number) => void
    ): Promise<T> {
      return executeXhrWithRetry<T>('PUT', endpoint, formData, onProgress)
    },
  }

  return api
}
