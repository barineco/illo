<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
    <div class="max-w-md w-full">
      <!-- Card -->
      <div class="bg-[var(--color-surface)] rounded-lg p-8 shadow-xl">
        <!-- Success State -->
        <div v-if="sent" class="text-center">
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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-[var(--color-text)] mb-4">{{ $t('auth.emailSent') }}</h1>
          <p class="text-[var(--color-text-muted)] mb-6">
            {{ $t('auth.passwordResetEmailSent') }}
          </p>
          <NuxtLink
            to="/login"
            class="inline-block w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {{ $t('auth.goToLogin') }}
          </NuxtLink>
        </div>

        <!-- Form State -->
        <div v-else>
          <div class="text-center mb-8">
            <h1 class="text-2xl font-bold text-[var(--color-text)] mb-2">{{ $t('auth.passwordResetTitle') }}</h1>
            <p class="text-[var(--color-text-muted)] text-sm">
              {{ $t('auth.passwordResetDesc') }}
            </p>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Email Input -->
            <div>
              <label for="email" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {{ $t('auth.email') }}
              </label>
              <input
                id="email"
                v-model="email"
                type="email"
                required
                placeholder="your@email.com"
                class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-focus-ring)] transition-colors"
              />
            </div>

            <!-- Error Message -->
            <div
              v-if="errorMessage"
              class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] px-4 py-3 rounded-lg text-sm"
            >
              {{ errorMessage }}
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              :disabled="loading"
              class="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading ? $t('common.sending') : $t('auth.sendResetEmail') }}
            </button>

            <!-- Back to Login -->
            <div class="text-center">
              <NuxtLink
                to="/login"
                class="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
              >
                {{ $t('auth.backToLogin') }}
              </NuxtLink>
            </div>
          </form>
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

const { forgotPassword } = useAuth()

const email = ref('')
const loading = ref(false)
const errorMessage = ref('')
const sent = ref(false)

const handleSubmit = async () => {
  if (!email.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    await forgotPassword(email.value)
    sent.value = true
  } catch (error: any) {
    errorMessage.value =
      error.response?.data?.message || t('auth.passwordResetRequestFailed')
  } finally {
    loading.value = false
  }
}
</script>
