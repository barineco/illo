<template>
  <div class="complete-page">
    <div class="complete-container">
      <!-- Error State -->
      <div v-if="error" class="error-state">
        <ExclamationCircleIcon class="error-icon" />
        <h1 class="error-title">{{ $t('auth.bluesky.authFailed') }}</h1>
        <p class="error-message">{{ error }}</p>
        <NuxtLink to="/login" class="btn-link">
          {{ $t('auth.backToLogin') }}
        </NuxtLink>
      </div>

      <!-- Username Selection Form -->
      <div v-else class="form-state">
        <div class="bluesky-badge">
          <BlueskyIcon class="bluesky-icon" />
        </div>
        <h1 class="form-title">{{ $t('auth.bluesky.completeRegistration') }}</h1>
        <p class="form-description">{{ $t('auth.bluesky.chooseUsername') }}</p>

        <!-- Bluesky Handle Display -->
        <div v-if="blueskyHandle" class="bluesky-handle">
          <span class="handle-label">{{ $t('auth.bluesky.linkedAccount') }}</span>
          <span class="handle-value">@{{ blueskyHandle }}</span>
        </div>

        <form @submit.prevent="handleSubmit" class="username-form">
          <div class="form-group">
            <label for="username" class="form-label">{{ $t('auth.username') }}</label>
            <input
              id="username"
              v-model="username"
              type="text"
              class="form-input"
              :placeholder="$t('auth.usernamePlaceholder')"
              :class="{ 'input-error': usernameError }"
              @input="validateUsername"
            />
            <p v-if="usernameError" class="error-text">{{ usernameError }}</p>
            <p v-else class="hint-text">{{ $t('auth.usernameHint') }}</p>
          </div>

          <!-- Terms of Service Status -->
          <div v-if="tosAgreed" class="tos-accepted">
            <CheckCircleIcon class="tos-accepted-icon" />
            {{ $t('auth.tosAccepted') }}
          </div>

          <button
            type="submit"
            class="submit-btn"
            :disabled="isSubmitting || !!usernameError || !username"
          >
            <span v-if="isSubmitting" class="spinner-small"></span>
            <span v-else>{{ $t('auth.bluesky.createAccount') }}</span>
          </button>
        </form>

        <!-- Terms of Service Modal -->
        <TermsOfServiceModal
          :is-open="showTosModal"
          @close="showTosModal = false"
          @accept="handleTosAccept"
          @decline="handleTosDecline"
        />

        <NuxtLink to="/login" class="cancel-link">
          {{ $t('common.cancel') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/20/solid'
import { ExclamationCircleIcon } from '@heroicons/vue/24/outline'
import BlueskyIcon from '~/components/icons/BlueskyIcon.vue'

definePageMeta({
  layout: false,
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { setTokens, fetchUserWithToken } = useAuth()
const api = useApi()

const token = computed(() => route.query.token as string | undefined)
const error = ref('')
const username = ref('')
const usernameError = ref('')
const isSubmitting = ref(false)
const blueskyHandle = ref('')
const tosAgreed = ref(false)
const showTosModal = ref(false)

// Flag to track if we're waiting for ToS acceptance before submitting
const pendingSubmit = ref(false)

const handleTosAccept = (_version: number) => {
  tosAgreed.value = true
  showTosModal.value = false

  // If we were waiting to submit, do it now
  if (pendingSubmit.value) {
    pendingSubmit.value = false
    submitRegistration()
  }
}

const handleTosDecline = () => {
  showTosModal.value = false
  pendingSubmit.value = false
}

// Decode token to get Bluesky handle for display
onMounted(() => {
  if (!token.value) {
    error.value = t('auth.bluesky.invalidToken')
    return
  }

  // Try to decode the JWT to get the handle (for display only)
  try {
    const parts = token.value.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]))
      if (payload.handle) {
        blueskyHandle.value = payload.handle
        // Pre-fill username suggestion from handle
        const suggestedUsername = payload.handle
          .replace('.bsky.social', '')
          .replace(/\.[^.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
        if (suggestedUsername.length >= 3) {
          username.value = suggestedUsername
        }
      }
    }
  } catch {
    // Ignore decode errors - server will validate the token
  }
})

const validateUsername = () => {
  const value = username.value.trim().toLowerCase()

  if (!value) {
    usernameError.value = ''
    return
  }

  if (value.length < 3) {
    usernameError.value = t('auth.usernameTooShort')
    return
  }

  if (value.length > 30) {
    usernameError.value = t('auth.usernameTooLong')
    return
  }

  if (!/^[a-z]/.test(value)) {
    usernameError.value = t('auth.usernameMustStartWithLetter')
    return
  }

  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    usernameError.value = t('auth.usernameInvalidChars')
    return
  }

  usernameError.value = ''
}

const handleSubmit = async () => {
  if (!token.value || !username.value || usernameError.value) {
    return
  }

  // If ToS not agreed, show modal first
  if (!tosAgreed.value) {
    pendingSubmit.value = true
    showTosModal.value = true
    return
  }

  await submitRegistration()
}

const submitRegistration = async () => {
  isSubmitting.value = true
  error.value = ''

  try {
    const response = await api.post<{
      pendingApproval: boolean
      accessToken?: string
      refreshToken?: string
      message?: string
    }>('/api/bluesky/complete-registration', {
      token: token.value,
      username: username.value.trim().toLowerCase(),
      tosAccepted: true,
    })

    if (response.pendingApproval) {
      // User needs approval - redirect to pending page
      router.replace('/auth/pending-approval?via=bluesky')
    } else if (response.accessToken) {
      // User is active - save tokens and fetch user with explicit token
      setTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken })
      await fetchUserWithToken(response.accessToken)
      router.replace('/?welcome=true')
    }
  } catch (err: any) {
    const errorMessage = err.data?.message || err.message || t('auth.bluesky.registrationFailed')
    error.value = errorMessage
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.complete-page {
  min-height: 100vh;
  background: var(--color-background);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.complete-container {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 2.5rem;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
}

.error-icon {
  width: 3rem;
  height: 3rem;
  color: var(--color-danger-text);
}

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.error-message {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.form-state {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bluesky-badge {
  width: 4rem;
  height: 4rem;
  background: var(--color-bluesky);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.bluesky-icon {
  width: 2rem;
  height: 2rem;
  color: white;
}

.form-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
  text-align: center;
}

.form-description {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  text-align: center;
  margin-bottom: 1.5rem;
}

.bluesky-handle {
  background: var(--color-surface-secondary);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.handle-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.handle-value {
  font-size: 0.95rem;
  color: var(--color-text);
  font-weight: 500;
}

.username-form {
  width: 100%;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}

.form-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  color: var(--color-text);
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input.input-error {
  border-color: var(--color-danger-border);
}

.error-text {
  font-size: 0.75rem;
  color: var(--color-danger-text);
  margin-top: 0.5rem;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

.submit-btn {
  width: 100%;
  padding: 0.875rem;
  background: var(--color-bluesky);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-bluesky-hover);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-small {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.cancel-link {
  display: block;
  text-align: center;
  margin-top: 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  text-decoration: none;
}

.cancel-link:hover {
  color: var(--color-text);
}

.btn-link {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: var(--color-primary-text);
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-link:hover {
  background: var(--color-primary-hover);
}

.tos-agreement {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.tos-checkbox {
  margin-top: 0.25rem;
  width: 1rem;
  height: 1rem;
  border-radius: 0.25rem;
  border: 1px solid var(--color-border);
  accent-color: var(--color-primary);
}

.tos-label {
  font-size: 0.875rem;
  color: var(--color-text);
}

.tos-link {
  color: var(--color-primary);
  text-decoration: none;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.tos-link:hover {
  text-decoration: underline;
}

.tos-accepted {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-success-icon);
  margin-bottom: 1.5rem;
}

.tos-accepted-icon {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
