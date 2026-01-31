interface SessionInfo {
  id: string
  deviceName: string
  deviceType: string
  ipAddress: string | null
  location: string | null
  createdAt: string
  lastUsedAt: string
  expiresAt: string
  isCurrent: boolean
}

interface LoginAttempt {
  ipAddress: string
  userAgent: string | null
  success: boolean
  failureReason: string | null
  createdAt: string
}

export const useSession = () => {
  const api = useApi()

  /**
   * Get all active sessions for the current user
   */
  const getSessions = async (): Promise<SessionInfo[]> => {
    try {
      const response = await api.get<{ sessions: SessionInfo[] }>('/api/sessions')
      return response.sessions
    } catch (error: any) {
      console.error('Failed to fetch sessions:', error)
      throw error
    }
  }

  /**
   * Revoke a specific session
   */
  const revokeSession = async (sessionId: string): Promise<void> => {
    try {
      await api.delete(`/api/sessions/${sessionId}`)
    } catch (error: any) {
      console.error('Failed to revoke session:', error)
      throw error
    }
  }

  /**
   * Revoke all sessions except the current one
   */
  const revokeAllSessions = async (): Promise<{ count: number }> => {
    try {
      const response = await api.post<{ count: number; message: string }>(
        '/api/sessions/revoke-all',
        {},
      )
      return { count: response.count }
    } catch (error: any) {
      console.error('Failed to revoke all sessions:', error)
      throw error
    }
  }

  /**
   * Revoke all sessions including the current one (complete logout)
   */
  const revokeAllSessionsIncludingCurrent = async (): Promise<{ count: number }> => {
    try {
      const response = await api.post<{ count: number; message: string }>(
        '/api/sessions/revoke-all-including-current',
        {},
      )
      return { count: response.count }
    } catch (error: any) {
      console.error('Failed to revoke all sessions including current:', error)
      throw error
    }
  }

  /**
   * Get recent login attempts for the current user
   */
  const getLoginAttempts = async (limit: number = 10): Promise<LoginAttempt[]> => {
    try {
      const attempts = await api.get<LoginAttempt[]>(
        `/api/sessions/login-attempts?limit=${limit}`,
      )
      return attempts
    } catch (error: any) {
      console.error('Failed to fetch login attempts:', error)
      throw error
    }
  }

  return {
    getSessions,
    revokeSession,
    revokeAllSessions,
    revokeAllSessionsIncludingCurrent,
    getLoginAttempts,
  }
}
