<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
    <div class="max-w-md w-full">
      <!-- Card -->
      <div class="bg-[var(--color-surface)] rounded-lg p-8 shadow-xl">
        <!-- Success State -->
        <div v-if="state === 'success'" class="text-center">
          <div class="mb-6">
            <svg
              class="w-16 h-16 text-[var(--color-success-icon)] mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-[var(--color-text)] mb-4">{{ $t('auth.emailVerified') }}</h1>
          <p class="text-[var(--color-text-muted)] mb-6">
            {{ $t('auth.emailVerifiedDesc') }}
          </p>
          <NuxtLink
            to="/login"
            class="inline-block w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {{ $t('auth.goToLogin') }}
          </NuxtLink>
        </div>

        <!-- Error State -->
        <div v-else-if="state === 'error'" class="text-center">
          <div class="mb-6">
            <svg
              class="w-16 h-16 text-[var(--color-danger)] mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-[var(--color-text)] mb-4">{{ $t('auth.verificationFailed') }}</h1>
          <p class="text-[var(--color-text-muted)] mb-6">
            {{ errorMessage }}
          </p>
          <div class="space-y-3">
            <NuxtLink
              to="/login"
              class="inline-block w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {{ $t('auth.goToLogin') }}
            </NuxtLink>
            <button
              @click="resendEmail"
              :disabled="resending"
              class="w-full bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)] text-[var(--color-text)] font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ resending ? $t('common.sending') : $t('auth.resendVerification') }}
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-else class="text-center">
          <div class="mb-6">
            <svg
              class="animate-spin w-16 h-16 text-[var(--color-primary)] mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-[var(--color-text)] mb-4">{{ $t('auth.verifyingEmail') }}</h1>
          <p class="text-[var(--color-text-muted)]">{{ $t('auth.pleaseWait') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

definePageMeta({
  layout: false,
  middleware: 'guest',
})

const route = useRoute()
const { verifyEmail, resendVerificationEmail } = useAuth()

const state = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref('')
const resending = ref(false)
const userEmail = ref('')

// Verify email on mount
onMounted(async () => {
  const token = route.query.token as string

  if (!token) {
    state.value = 'error'
    errorMessage.value = t('auth.tokenNotFound')
    return
  }

  try {
    await verifyEmail(token)
    state.value = 'success'
  } catch (error: any) {
    state.value = 'error'
    if (error.response?.status === 401) {
      errorMessage.value = t('auth.tokenExpired')
    } else {
      errorMessage.value = error.response?.data?.message || t('auth.emailVerificationFailed')
    }
  }
})

// Resend verification email
const resendEmail = async () => {
  if (!userEmail.value) {
    // Prompt for email if not available
    userEmail.value = prompt(t('auth.enterEmailPrompt')) || ''
    if (!userEmail.value) return
  }

  resending.value = true
  try {
    await resendVerificationEmail(userEmail.value)
    alert(t('auth.verificationResent'))
  } catch (error: any) {
    alert(error.response?.data?.message || t('auth.verificationResendFailed'))
  } finally {
    resending.value = false
  }
}
</script>
