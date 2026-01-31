interface User {
  id: string
  username: string
  email: string
  displayName: string | null
  role: string
  avatarUrl: string | null
  coverImageUrl: string | null
  isAdult?: boolean // Age verified (18+)
  supporterTier?: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3' // Supporter tier for benefits
}

interface LoginDto {
  email: string
  password: string
}

interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
  requiresTwoFactor?: boolean
  userId?: string
  rememberMe?: boolean
}

interface Verify2FADto {
  userId: string
  code: string
}

interface Verify2FAResponse {
  accessToken: string
  refreshToken: string
  user: User
  usedBackupCode?: boolean
  message?: string
}

export const useAuth = () => {
  const api = useApi()
  const user = useState<User | null>('user', () => null)

  const {
    refreshAccessToken: doRefreshToken,
    clearTokens,
    setTokens: setTokensInternal,
    hasAccessToken,
    getAccessToken,
    getRefreshToken,
  } = useTokenRefresh()

  // Instance-specific cookie name prevents collision across multiple instances on different ports
  const runtimeConfig = useRuntimeConfig()
  const instanceId = runtimeConfig.public.instanceId || 'default'

  const rememberMeState = useState<boolean>('rememberMe', () => false)

  const getAccessTokenCookie = () => {
    return useCookie(`${instanceId}_accessToken`, { maxAge: 60 * 15 })
  }

  const getRefreshTokenCookie = (rememberMe: boolean = false) => {
    // Remember Me ON: 30 days, OFF: session cookie (deleted when browser closes)
    const maxAge = rememberMe ? 60 * 60 * 24 * 30 : undefined
    return useCookie(`${instanceId}_refreshToken`, { maxAge })
  }

  const accessToken = getAccessTokenCookie()
  const refreshToken = useCookie(`${instanceId}_refreshToken`)

  const isAuthenticated = computed(() => !!user.value && !!accessToken.value)

  const setTokensWithRememberMe = (
    tokens: { accessToken: string; refreshToken: string },
    rememberMe: boolean
  ) => {
    rememberMeState.value = rememberMe

    const accessTokenCookie = getAccessTokenCookie()
    accessTokenCookie.value = tokens.accessToken

    const refreshTokenCookie = getRefreshTokenCookie(rememberMe)
    refreshTokenCookie.value = tokens.refreshToken
  }

  const login = async (credentials: LoginDto, rememberMe: boolean = false) => {
    try {
      const response = await api.post<AuthResponse>('/api/auth/login', {
        ...credentials,
        rememberMe,
      })

      if (response.requiresTwoFactor && response.userId) {
        return { requiresTwoFactor: true, userId: response.userId, user: response.user, rememberMe }
      }

      user.value = response.user
      setTokensWithRememberMe(
        { accessToken: response.accessToken, refreshToken: response.refreshToken },
        rememberMe
      )
      return { user: response.user }
    } catch (error: any) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const verify2FA = async (params: Verify2FADto, rememberMe: boolean = false) => {
    try {
      const response = await api.post<Verify2FAResponse>('/api/auth/2fa/verify', {
        ...params,
        rememberMe,
      })
      user.value = response.user
      setTokensWithRememberMe(
        { accessToken: response.accessToken, refreshToken: response.refreshToken },
        rememberMe
      )

      return {
        success: true,
        usedBackupCode: response.usedBackupCode,
        message: response.message,
      }
    } catch (error: any) {
      console.error('2FA verification failed:', error)
      throw error
    }
  }

  const verifyEmail = async (token: string) => {
    try {
      const response = await api.get<{ message: string }>(`/api/auth/verify-email?token=${token}`)
      return { success: true, message: response.message }
    } catch (error: any) {
      console.error('Email verification failed:', error)
      throw error
    }
  }

  const resendVerificationEmail = async (email: string) => {
    try {
      const response = await api.post<{ message: string }>('/api/auth/resend-verification', { email })
      return { success: true, message: response.message }
    } catch (error: any) {
      console.error('Failed to resend verification email:', error)
      throw error
    }
  }

  const forgotPassword = async (email: string) => {
    try {
      const response = await api.post<{ message: string }>('/api/auth/forgot-password', { email })
      return { success: true, message: response.message }
    } catch (error: any) {
      console.error('Failed to request password reset:', error)
      throw error
    }
  }

  const resetPassword = async (token: string, newPassword: string) => {
    try {
      const response = await api.post<{ message: string }>('/api/auth/reset-password', {
        token,
        newPassword,
      })
      return { success: true, message: response.message }
    } catch (error: any) {
      console.error('Failed to reset password:', error)
      throw error
    }
  }

  const logout = () => {
    user.value = null
    clearTokens()
    navigateTo('/')
  }

  const fetchCurrentUser = async () => {
    if (!hasAccessToken()) {
      return null
    }

    try {
      const currentUser = await api.get<User>('/api/auth/me')
      user.value = currentUser
      return currentUser
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      user.value = null
      return null
    }
  }

  const refreshAccessToken = async () => {
    return doRefreshToken()
  }

  const updateUserProfile = (updatedFields: Partial<User>) => {
    if (user.value) {
      user.value = { ...user.value, ...updatedFields }
    }
  }

  const setToken = (token: string) => {
    accessToken.value = token
  }

  const setTokens = (tokens: { accessToken: string; refreshToken?: string }) => {
    accessToken.value = tokens.accessToken
    if (tokens.refreshToken) {
      refreshToken.value = tokens.refreshToken
    }
  }

  const fetchUserWithToken = async (token: string) => {
    try {
      const runtimeConfig = useRuntimeConfig()
      const baseURL = runtimeConfig.public.apiBase || ''
      const currentUser = await $fetch<User>(`${baseURL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
      user.value = currentUser
      return currentUser
    } catch (error) {
      console.error('Failed to fetch user with token:', error)
      return null
    }
  }

  const fetchUser = fetchCurrentUser

  return {
    user: readonly(user),
    isAuthenticated,
    login,
    logout,
    verify2FA,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    fetchCurrentUser,
    fetchUser,
    fetchUserWithToken,
    refreshAccessToken,
    updateUserProfile,
    setToken,
    setTokens,
    setTokensWithRememberMe,
    getAccessToken: () => accessToken.value,
  }
}
