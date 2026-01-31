<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="bg-[var(--color-surface)] rounded-xl p-8 shadow-lg">
        <!-- Registration Success State -->
        <div v-if="registrationSuccess" class="text-center">
          <div class="mb-6">
            <EnvelopeIcon class="w-16 h-16 text-[var(--color-success-icon)] mx-auto" />
          </div>
          <h1 class="text-2xl font-bold mb-4">{{ $t('auth.registrationSuccess') }}</h1>
          <p class="text-[var(--color-text-muted)] mb-6">
            {{ $t('auth.verificationSent') }}<br />
            {{ $t('auth.verificationInstruction') }}
          </p>
          <div class="space-y-3">
            <button
              @click="resendVerification"
              :disabled="resending"
              class="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ resending ? $t('common.sending') : $t('auth.resendVerification') }}
            </button>
            <NuxtLink
              to="/login"
              class="block w-full text-center text-[var(--color-primary)] hover:underline"
            >
              {{ $t('auth.goToLogin') }}
            </NuxtLink>
          </div>
        </div>

        <!-- Registration Form -->
        <div v-else>
          <h1 class="text-2xl font-bold mb-6 text-center">{{ $t('auth.registerTitle') }}</h1>

          <form @submit.prevent="handleRegister" class="space-y-4">
          <!-- Username -->
          <div>
            <label for="username" class="block text-sm font-medium mb-2">
              {{ $t('auth.username') }} <span class="text-[var(--color-danger-text)]">*</span>
            </label>
            <input
              id="username"
              v-model="username"
              type="text"
              required
              :disabled="loading"
              placeholder="username"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            />
            <p class="text-xs text-[var(--color-text-muted)] mt-1">{{ $t('auth.usernameHint') }}</p>
          </div>

          <!-- Display Name -->
          <div>
            <label for="displayName" class="block text-sm font-medium mb-2">
              {{ $t('auth.displayName') }}
            </label>
            <input
              id="displayName"
              v-model="displayName"
              type="text"
              :disabled="loading"
              :placeholder="$t('auth.displayNameOptional')"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            />
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium mb-2">
              {{ $t('auth.email') }} <span class="text-[var(--color-danger-text)]">*</span>
            </label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              :disabled="loading"
              placeholder="email@example.com"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            />
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium mb-2">
              {{ $t('auth.password') }} <span class="text-[var(--color-danger-text)]">*</span>
            </label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                :disabled="loading"
                :placeholder="$t('auth.passwordHint')"
                class="w-full px-4 py-2 pr-10 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                @keydown="handleKeyEvent"
                @keyup="handleKeyEvent"
                @blur="resetCapsLock"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                tabindex="-1"
              >
                <EyeSlashIcon v-if="showPassword" class="w-5 h-5" />
                <EyeIcon v-else class="w-5 h-5" />
              </button>
            </div>
            <p class="text-xs text-[var(--color-text-muted)] mt-1">{{ $t('auth.passwordHint') }}</p>
          </div>

          <!-- Password Confirm -->
          <div>
            <label for="passwordConfirm" class="block text-sm font-medium mb-2">
              {{ $t('auth.passwordConfirm') }} <span class="text-[var(--color-danger-text)]">*</span>
            </label>
            <div class="relative">
              <input
                id="passwordConfirm"
                v-model="passwordConfirm"
                :type="showPasswordConfirm ? 'text' : 'password'"
                required
                :disabled="loading"
                :placeholder="$t('auth.passwordConfirmPlaceholder')"
                class="w-full px-4 py-2 pr-10 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
                @keydown="handleKeyEvent"
                @keyup="handleKeyEvent"
                @blur="resetCapsLock"
              />
              <button
                type="button"
                @click="showPasswordConfirm = !showPasswordConfirm"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                tabindex="-1"
              >
                <EyeSlashIcon v-if="showPasswordConfirm" class="w-5 h-5" />
                <EyeIcon v-else class="w-5 h-5" />
              </button>
            </div>
            <div v-if="isCapsLockOn" class="flex items-center gap-1.5 text-[var(--color-warning-text)] text-xs mt-1">
              <ExclamationTriangleIcon class="w-4 h-4 flex-shrink-0" />
              {{ $t('auth.capsLockWarning') }}
            </div>
            <div v-if="passwordConfirm && password !== passwordConfirm" class="flex items-center gap-1.5 text-[var(--color-danger-text)] text-xs mt-1">
              <ExclamationTriangleIcon class="w-4 h-4 flex-shrink-0" />
              {{ $t('auth.passwordMismatch') }}
            </div>
          </div>

          <!-- Terms of Service Status -->
          <div v-if="tosAgreed" class="flex items-center gap-2 text-sm text-[var(--color-success-icon)]">
            <CheckCircleIcon class="w-5 h-5" />
            {{ $t('auth.tosAccepted') }}
          </div>

          <!-- Error Message -->
          <div v-if="error" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3">
            <p class="text-[var(--color-danger-text)] text-sm">{{ error }}</p>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading || !isFormFieldsValid"
            class="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">{{ $t('auth.registering') }}</span>
            <span v-else>{{ $t('auth.registerButton') }}</span>
          </button>
          </form>

          <!-- Bluesky OAuth Registration -->
          <div v-if="blueskyEnabled" class="mt-6">
            <div class="flex items-center gap-4 mb-4">
              <div class="flex-1 h-px bg-[var(--color-border)]"></div>
              <span class="text-sm text-[var(--color-text-muted)]">{{ $t('auth.bluesky.orDivider') }}</span>
              <div class="flex-1 h-px bg-[var(--color-border)]"></div>
            </div>

            <div class="mb-3 text-sm text-[var(--color-text-muted)] text-center">
              {{ $t('auth.bluesky.quickRegisterHint') }}
            </div>

            <div class="flex flex-col gap-3">
              <input
                v-model="blueskyHandle"
                type="text"
                class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                :placeholder="$t('auth.bluesky.handlePlaceholder')"
                @keydown.enter="handleBlueskyRegister"
              />
              <button
                type="button"
                class="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-bluesky)] hover:bg-[var(--color-bluesky-hover)] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="blueskyLoading || !blueskyHandle"
                @click="handleBlueskyRegister"
              >
                <BlueskyIcon class="w-5 h-5 text-white" />
                {{ blueskyLoading ? $t('auth.registering') : $t('auth.bluesky.registerWithBluesky') }}
              </button>
            </div>
            <div v-if="blueskyError" class="mt-2 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3">
              <p class="text-[var(--color-danger-text)] text-sm">{{ blueskyError }}</p>
            </div>
          </div>

          <!-- Login Link -->
          <div class="mt-6 text-center text-sm text-[var(--color-text-muted)]">
            {{ $t('auth.hasAccount') }}
            <NuxtLink to="/login" class="text-[var(--color-primary)] hover:underline">
              {{ $t('auth.loginButton') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Terms of Service Modal -->
    <TermsOfServiceModal
      :is-open="showTosModal"
      @close="showTosModal = false"
      @accept="handleTosAccept"
      @decline="handleTosDecline"
    />
  </div>
</template>

<script setup lang="ts">
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/20/solid'
import { EnvelopeIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

const { t } = useI18n()
const { isCapsLockOn, handleKeyEvent, resetCapsLock } = useCapsLock()

definePageMeta({
  middleware: 'guest', // Only allow guests (non-authenticated users)
})

const api = useApi()
const { resendVerificationEmail } = useAuth()

const username = ref('')
const displayName = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)
const showPasswordConfirm = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const registrationSuccess = ref(false)
const resending = ref(false)
const tosAgreed = ref(false)
const showTosModal = ref(false)

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

const handleBlueskyRegister = async () => {
  if (!blueskyHandle.value) return

  blueskyLoading.value = true
  blueskyError.value = ''

  try {
    const response = await api.post<{ url: string }>('/api/bluesky/authorize', {
      handle: blueskyHandle.value,
      mode: 'register',
    })

    // Redirect to Bluesky authorization
    window.location.href = response.url
  } catch (err: any) {
    blueskyError.value = err.response?.data?.message || err.data?.message || t('auth.bluesky.authFailed')
  } finally {
    blueskyLoading.value = false
  }
}

// Check if form fields are valid (excluding ToS)
const isFormFieldsValid = computed(() => {
  return username.value.length >= 3 &&
    email.value.length > 0 &&
    password.value.length >= 8 &&
    password.value === passwordConfirm.value
})

// Check if entire form is valid (including ToS)
const isFormValid = computed(() => {
  return isFormFieldsValid.value && tosAgreed.value
})

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

const handleRegister = async () => {
  if (loading.value) return

  // Client-side validation
  if (username.value.length < 3) {
    error.value = t('auth.usernameMinLength')
    return
  }

  if (password.value.length < 8) {
    error.value = t('auth.passwordMinLength')
    return
  }

  if (password.value !== passwordConfirm.value) {
    error.value = t('auth.passwordMismatch')
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
  try {
    loading.value = true
    error.value = null

    // Register - DO NOT auto-login
    await api.post('/api/auth/register', {
      username: username.value,
      displayName: displayName.value || username.value,
      email: email.value,
      password: password.value,
      tosAccepted: true,
    })

    // Show success message and wait for email verification
    registrationSuccess.value = true
  } catch (e: any) {
    console.error('Registration failed:', e)
    error.value =
      e.response?.data?.message || e.message || t('auth.registrationFailed')
  } finally {
    loading.value = false
  }
}

const resendVerification = async () => {
  resending.value = true
  try {
    await resendVerificationEmail(email.value)
    alert(t('auth.verificationResent'))
  } catch (e: any) {
    alert(e.response?.data?.message || t('auth.verificationResendFailed'))
  } finally {
    resending.value = false
  }
}
</script>
