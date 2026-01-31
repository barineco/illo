<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
    <div class="max-w-md w-full">
      <!-- Card -->
      <div class="bg-[var(--color-surface)] rounded-lg p-8 shadow-xl">
        <!-- Success State -->
        <div v-if="success" class="text-center">
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
          <h1 class="text-2xl font-bold text-[var(--color-text)] mb-4">{{ $t('auth.passwordResetComplete') }}</h1>
          <p class="text-[var(--color-text-muted)] mb-6">
            {{ $t('auth.passwordResetCompleteDesc') }}
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
            <h1 class="text-2xl font-bold text-[var(--color-text)] mb-2">{{ $t('auth.newPasswordTitle') }}</h1>
            <p class="text-[var(--color-text-muted)] text-sm">{{ $t('auth.newPasswordDesc') }}</p>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- New Password Input -->
            <div>
              <label for="password" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {{ $t('auth.newPassword') }}
              </label>
              <div class="relative">
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  minlength="8"
                  :placeholder="$t('auth.passwordHint')"
                  class="w-full px-4 py-3 pr-12 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-focus-ring)] transition-colors"
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
            </div>

            <!-- Confirm Password Input -->
            <div>
              <label
                for="confirmPassword"
                class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
              >
                {{ $t('auth.passwordConfirm') }}
              </label>
              <div class="relative">
                <input
                  id="confirmPassword"
                  v-model="confirmPassword"
                  :type="showPasswordConfirm ? 'text' : 'password'"
                  required
                  minlength="8"
                  :placeholder="$t('auth.confirmPasswordPlaceholder')"
                  class="w-full px-4 py-3 pr-12 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-focus-ring)] transition-colors"
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
              <div v-if="confirmPassword && password !== confirmPassword" class="flex items-center gap-1.5 text-[var(--color-danger-text)] text-xs mt-1">
                <ExclamationTriangleIcon class="w-4 h-4 flex-shrink-0" />
                {{ $t('auth.passwordMismatch') }}
              </div>
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
              :disabled="loading || !isPasswordValid"
              class="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading ? $t('auth.resetting') : $t('auth.resetPassword') }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

const { t } = useI18n()
const { isCapsLockOn, handleKeyEvent, resetCapsLock } = useCapsLock()

definePageMeta({
  layout: false,
  middleware: 'guest',
})

const route = useRoute()
const router = useRouter()
const { resetPassword } = useAuth()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showPasswordConfirm = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const success = ref(false)

const isPasswordValid = computed(() => {
  return (
    password.value.length >= 8 &&
    confirmPassword.value.length >= 8 &&
    password.value === confirmPassword.value
  )
})

const handleSubmit = async () => {
  const token = route.query.token as string

  if (!token) {
    errorMessage.value = t('auth.resetTokenNotFound')
    return
  }

  if (!isPasswordValid.value) {
    errorMessage.value = t('auth.passwordValidationError')
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await resetPassword(token, password.value)
    success.value = true
    // Redirect to login after 3 seconds
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  } catch (error: any) {
    if (error.response?.status === 401) {
      errorMessage.value = t('auth.resetTokenExpired')
    } else {
      errorMessage.value =
        error.response?.data?.message || t('auth.passwordResetFailed')
    }
  } finally {
    loading.value = false
  }
}

// Check if token exists on mount
onMounted(() => {
  if (!route.query.token) {
    errorMessage.value = t('auth.resetTokenNotFound')
  }
})
</script>
