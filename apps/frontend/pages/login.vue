<template>
  <div class="login-page">
    <div class="login-container">
      <h1 class="login-title">{{ $t('auth.loginTitle') }}</h1>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">{{ $t('auth.email') }}</label>
          <input
            id="email"
            v-model="credentials.email"
            type="email"
            required
            class="input-field"
            placeholder="email@example.com"
          />
        </div>

        <div class="form-group">
          <label for="password">{{ $t('auth.password') }}</label>
          <div class="password-input-wrapper">
            <input
              id="password"
              v-model="credentials.password"
              :type="showPassword ? 'text' : 'password'"
              required
              class="input-field password-input"
              :placeholder="$t('auth.password')"
              @keydown="handleKeyEvent"
              @keyup="handleKeyEvent"
              @blur="resetCapsLock"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="password-toggle"
              tabindex="-1"
            >
              <EyeSlashIcon v-if="showPassword" class="toggle-icon" />
              <EyeIcon v-else class="toggle-icon" />
            </button>
          </div>
          <div v-if="isCapsLockOn" class="caps-lock-warning">
            <ExclamationTriangleIcon class="warning-icon" />
            {{ $t('auth.capsLockWarning') }}
          </div>
        </div>

        <div class="form-group-checkbox">
          <label class="checkbox-label">
            <input
              v-model="rememberMe"
              type="checkbox"
              class="checkbox-input"
            />
            <span class="checkbox-text">{{ $t('auth.rememberMe') }}</span>
          </label>
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
          <div v-if="showResendLink" class="resend-link">
            <button @click="resendVerification" type="button" class="link-button">
              {{ $t('auth.resendVerification') }}
            </button>
          </div>
        </div>

        <button
          type="submit"
          class="btn-login"
          :disabled="isLoading"
        >
          {{ isLoading ? $t('auth.loggingIn') : $t('auth.loginButton') }}
        </button>
      </form>

      <!-- Forgot Password Link -->
      <div class="forgot-password-link">
        <NuxtLink to="/forgot-password" class="link">
          {{ $t('auth.forgotPassword') }}
        </NuxtLink>
      </div>

      <!-- Passkey Login -->
      <div v-if="passkeySupported" class="passkey-section">
        <div class="divider">
          <span>{{ $t('auth.orDivider') }}</span>
        </div>

        <button
          type="button"
          class="btn-passkey"
          :disabled="passkeyLoading"
          @click="handlePasskeyLogin"
        >
          <FingerPrintIcon class="passkey-icon" />
          {{ passkeyLoading ? $t('auth.authenticating') : $t('auth.loginWithPasskey') }}
        </button>

        <div v-if="passkeyError" class="error-message passkey-error">
          {{ passkeyError }}
        </div>
      </div>

      <!-- Bluesky OAuth Login -->
      <div v-if="blueskyEnabled" class="oauth-section">
        <div class="divider">
          <span>{{ $t('auth.bluesky.orDivider') }}</span>
        </div>

        <div class="bluesky-login">
          <div class="bluesky-input-group">
            <input
              v-model="blueskyHandle"
              type="text"
              class="input-field bluesky-input"
              :placeholder="$t('auth.bluesky.handlePlaceholder')"
              @keydown.enter="handleBlueskyLogin"
            />
            <button
              type="button"
              class="btn-bluesky"
              :disabled="blueskyLoading || !blueskyHandle"
              @click="handleBlueskyLogin"
            >
              <BlueskyIcon class="bluesky-icon" />
              {{ blueskyLoading ? $t('auth.loggingIn') : $t('auth.bluesky.loginWithBluesky') }}
            </button>
          </div>
          <div v-if="blueskyError" class="error-message bluesky-error">
            {{ blueskyError }}
          </div>
        </div>
      </div>

      <!-- Register Link -->
      <div class="register-link">
        <span>{{ $t('auth.noAccount') }}</span>
        <NuxtLink to="/register" class="link">
          {{ $t('auth.registerButton') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid'
import { EyeIcon, EyeSlashIcon, FingerPrintIcon } from '@heroicons/vue/24/outline'

const { t } = useI18n()

definePageMeta({
  layout: false,
  middleware: 'guest',
})

const router = useRouter()
const api = useApi()
const { login, resendVerificationEmail } = useAuth()
const { isCapsLockOn, handleKeyEvent, resetCapsLock } = useCapsLock()
const { isSupported: passkeySupported, authenticateWithPasskey } = usePasskey()

const credentials = ref({
  email: '',
  password: '',
})

const rememberMe = ref(false)
const showPassword = ref(false)
const isLoading = ref(false)
const error = ref('')
const showResendLink = ref(false)

// Passkey
const passkeyLoading = ref(false)
const passkeyError = ref('')

// Bluesky OAuth
const blueskyEnabled = ref(false)
const blueskyHandle = ref('')
const blueskyLoading = ref(false)
const blueskyError = ref('')

// Check if Bluesky OAuth is enabled
onMounted(async () => {
  try {
    const status = await api.get<{ enabled: boolean }>('/api/bluesky/status')
    blueskyEnabled.value = status.enabled
  } catch {
    blueskyEnabled.value = false
  }
})

// Handle Passkey Login
const handlePasskeyLogin = async () => {
  passkeyLoading.value = true
  passkeyError.value = ''

  try {
    // Use email if entered for passkey hints, otherwise empty
    const emailHint = credentials.value.email || undefined
    await authenticateWithPasskey(emailHint, true)
    navigateTo('/')
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      passkeyError.value = t('passkey.cancelled')
    } else if (err.name === 'NotSupportedError') {
      passkeyError.value = t('passkey.notSupported')
    } else {
      passkeyError.value = err.data?.message || err.message || t('passkey.authFailed')
    }
  } finally {
    passkeyLoading.value = false
  }
}

const handleBlueskyLogin = async () => {
  if (!blueskyHandle.value) return

  blueskyLoading.value = true
  blueskyError.value = ''

  try {
    const response = await api.post<{ url: string }>('/api/bluesky/authorize', {
      handle: blueskyHandle.value,
      mode: 'login',
    })

    // Redirect to Bluesky authorization
    window.location.href = response.url
  } catch (err: any) {
    blueskyError.value = err.response?.data?.message || err.data?.message || t('auth.bluesky.authFailed')
  } finally {
    blueskyLoading.value = false
  }
}

const handleLogin = async () => {
  isLoading.value = true
  error.value = ''
  showResendLink.value = false

  try {
    const result = await login(credentials.value, rememberMe.value)

    // Check if 2FA is required
    if ('requiresTwoFactor' in result && result.requiresTwoFactor) {
      // Pass rememberMe to 2FA page via query param
      router.push(`/verify-2fa?userId=${result.userId}&rememberMe=${rememberMe.value}`)
      return
    }

    // Normal login success
    navigateTo('/')
  } catch (err: any) {
    const errorMessage = err.response?.data?.message || err.data?.message || t('auth.loginFailed')
    error.value = errorMessage

    // Check if error is due to unverified email
    if (errorMessage.includes('未認証') || errorMessage.includes('verify')) {
      showResendLink.value = true
      error.value = t('auth.emailUnverified')
    }
  } finally {
    isLoading.value = false
  }
}

const resendVerification = async () => {
  if (!credentials.value.email) {
    alert(t('auth.enterEmail'))
    return
  }

  try {
    await resendVerificationEmail(credentials.value.email)
    alert(t('auth.verificationResent'))
    showResendLink.value = false
  } catch (err: any) {
    alert(err.response?.data?.message || t('auth.verificationResendFailed'))
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--color-background);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-container {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 2.5rem;
}

.login-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
  margin-bottom: 2rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.input-field {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.75rem;
  color: var(--color-text);
  font-size: 1rem;
}

.input-field:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group-checkbox {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.checkbox-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.checkbox-text {
  font-weight: 500;
}

.error-message {
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-border);
  border-radius: 6px;
  padding: 0.75rem;
  color: var(--color-danger-text);
  font-size: 0.875rem;
  text-align: center;
}

.btn-login {
  background: var(--color-primary);
  color: var(--color-primary-text);
  border: none;
  border-radius: 6px;
  padding: 0.875rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-login:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-login:disabled {
  background: var(--color-surface-secondary);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.resend-link {
  margin-top: 0.75rem;
}

.link-button {
  background: none;
  border: none;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0;
}

.link-button:hover {
  color: var(--color-primary-hover);
}

.forgot-password-link {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.875rem;
}

.forgot-password-link .link {
  color: var(--color-primary);
  text-decoration: none;
}

.forgot-password-link .link:hover {
  text-decoration: underline;
}

.register-link {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.register-link .link {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.register-link .link:hover {
  text-decoration: underline;
}

.caps-lock-warning {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--color-warning-text);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.warning-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.password-input-wrapper {
  position: relative;
}

.password-input {
  width: 100%;
  padding-right: 2.5rem;
}

.password-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: color 0.2s;
}

.password-toggle:hover {
  color: var(--color-text);
}

.toggle-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Bluesky OAuth */
.oauth-section {
  margin-top: 1.5rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}

.divider span {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.bluesky-login {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bluesky-input-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bluesky-input {
  flex: 1;
}

.btn-bluesky {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--color-bluesky);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.btn-bluesky:hover:not(:disabled) {
  background: var(--color-bluesky-hover);
}

.btn-bluesky:disabled {
  background: var(--color-bluesky-disabled);
  cursor: not-allowed;
}

.bluesky-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: white;
}

.bluesky-error {
  margin-top: 0.5rem;
}

/* Passkey */
.passkey-section {
  margin-top: 1.5rem;
}

.btn-passkey {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  background: var(--color-surface-secondary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.875rem 1rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.btn-passkey:hover:not(:disabled) {
  background: var(--color-background);
  border-color: var(--color-primary);
}

.btn-passkey:disabled {
  background: var(--color-surface-secondary);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.passkey-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.passkey-error {
  margin-top: 0.75rem;
}
</style>
