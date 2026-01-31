import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'

interface PasskeyInfo {
  id: string
  name: string
  credentialDeviceType: string
  credentialBackedUp: boolean
  transports: string[]
  createdAt: string
  lastUsedAt: string | null
}

interface PasskeyAuthResponse {
  accessToken: string
  refreshToken: string
  user: any
  message: string
}

export const usePasskey = () => {
  const api = useApi()
  const { setTokensWithRememberMe } = useAuth()
  const user = useState<any>('user')

  /**
   * Check if WebAuthn is supported in this browser
   */
  const isSupported = computed(() => {
    if (import.meta.server) return false
    return !!window.PublicKeyCredential
  })

  /**
   * Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
   */
  const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
    if (!isSupported.value) return false
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
      return false
    }
  }

  /**
   * Register a new passkey for the current user
   * @param name User-defined name for the passkey (e.g., "MacBook Pro")
   */
  const registerPasskey = async (name: string): Promise<PasskeyInfo> => {
    // 1. Get registration options from server
    const { options } = await api.post<{
      options: PublicKeyCredentialCreationOptionsJSON
    }>('/api/auth/passkeys/register/start')

    // 2. Create credential using browser API
    const credential = await startRegistration({ optionsJSON: options })

    // 3. Send to server for verification
    const { passkey } = await api.post<{ passkey: PasskeyInfo }>(
      '/api/auth/passkeys/register/finish',
      { name, response: credential },
    )

    return passkey
  }

  /**
   * Authenticate with passkey (passwordless login)
   * @param email Optional email to hint which passkeys to use
   * @param rememberMe Whether to keep the session for 30 days
   */
  const authenticateWithPasskey = async (
    email?: string,
    rememberMe: boolean = false,
  ): Promise<PasskeyAuthResponse> => {
    // 1. Get authentication options from server
    const { options } = await api.post<{
      options: PublicKeyCredentialRequestOptionsJSON
    }>('/api/auth/passkeys/authenticate/start', { email })

    // 2. Get credential using browser API
    const credential = await startAuthentication({ optionsJSON: options })

    // 3. Send to server for verification (include the challenge for server-side validation)
    const response = await api.post<PasskeyAuthResponse>(
      '/api/auth/passkeys/authenticate/finish',
      { response: credential, challenge: options.challenge, rememberMe },
    )

    // 4. Store tokens and user
    setTokensWithRememberMe(
      { accessToken: response.accessToken, refreshToken: response.refreshToken },
      rememberMe,
    )
    user.value = response.user

    return response
  }

  /**
   * Get all passkeys for the current user
   */
  const getPasskeys = async (): Promise<PasskeyInfo[]> => {
    const { passkeys } = await api.get<{ passkeys: PasskeyInfo[] }>(
      '/api/auth/passkeys',
    )
    return passkeys
  }

  /**
   * Rename a passkey
   * @param id Passkey ID
   * @param name New name for the passkey
   */
  const renamePasskey = async (
    id: string,
    name: string,
  ): Promise<PasskeyInfo> => {
    const { passkey } = await api.patch<{ passkey: PasskeyInfo }>(
      `/api/auth/passkeys/${id}`,
      { name },
    )
    return passkey
  }

  /**
   * Delete a passkey
   * @param id Passkey ID
   */
  const deletePasskey = async (id: string): Promise<void> => {
    await api.delete(`/api/auth/passkeys/${id}`)
  }

  /**
   * Get passkey status for the current user
   */
  const getPasskeyStatus = async (): Promise<{
    hasPasskeys: boolean
    count: number
  }> => {
    return api.get('/api/auth/passkeys/status')
  }

  return {
    isSupported,
    isPlatformAuthenticatorAvailable,
    registerPasskey,
    authenticateWithPasskey,
    getPasskeys,
    renamePasskey,
    deletePasskey,
    getPasskeyStatus,
  }
}
