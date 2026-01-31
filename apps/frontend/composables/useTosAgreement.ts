/**
 * Terms of Service agreement management composable
 * Handles ToS version tracking and acceptance
 */
export interface TosSettings {
  tosVersion: number
  tosUpdatedAt: string | null
}

export interface TosStatus {
  needsAcceptance: boolean
  currentVersion: number
  acceptedVersion: number | null
  acceptedAt: string | null
}

export const useTosAgreement = () => {
  const api = useApi()

  /**
   * Get ToS settings (public endpoint)
   */
  const getTosSettings = async (): Promise<TosSettings> => {
    return api.get<TosSettings>('/api/tos')
  }

  /**
   * Get user's ToS acceptance status (requires auth)
   */
  const getTosStatus = async (): Promise<TosStatus> => {
    return api.get<TosStatus>('/api/tos/status')
  }

  /**
   * Accept ToS (requires auth)
   */
  const acceptTos = async (version: number): Promise<{ success: boolean }> => {
    return api.post<{ success: boolean }>('/api/tos/accept', { version })
  }

  return {
    getTosSettings,
    getTosStatus,
    acceptTos,
  }
}
