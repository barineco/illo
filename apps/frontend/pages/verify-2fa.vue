<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4">
    <div class="max-w-md w-full">
      <!-- Card -->
      <div class="bg-[var(--color-surface)] rounded-lg p-8 shadow-xl">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-[var(--color-text)] mb-2">{{ $t('auth.twoFactorTitle') }}</h1>
          <p class="text-[var(--color-text-muted)] text-sm">
            {{ $t('auth.twoFactorDesc') }}
          </p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Code Input -->
          <div>
            <label for="code" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {{ $t('auth.authCode') }}
            </label>
            <input
              id="code"
              v-model="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              required
              :maxlength="isBackupCode ? 8 : 6"
              :placeholder="$t('auth.codePlaceholder')"
              autofocus
              class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-center text-2xl tracking-widest placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-focus-ring)] transition-colors"
              @input="formatCode"
            />
            <p class="text-xs text-[var(--color-text-muted)] mt-2 text-center">
              {{ isBackupCode ? $t('auth.backupCodeLabel') : $t('auth.totpCodeLabel') }}
            </p>
          </div>

          <!-- Error Message -->
          <div
            v-if="errorMessage"
            class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] px-4 py-3 rounded-lg text-sm"
          >
            {{ errorMessage }}
          </div>

          <!-- Backup Code Warning -->
          <div
            v-if="usedBackupCode"
            class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-text)] text-[var(--color-warning-text)] px-4 py-3 rounded-lg text-sm"
          >
            {{ $t('auth.backupCodeUsed') }}
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading || !code"
            class="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-primary-text)] font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? $t('auth.verifying') : $t('auth.loginButton') }}
          </button>

          <!-- Toggle Backup Code -->
          <div class="text-center">
            <button
              type="button"
              @click="showBackupCodeHelp"
              class="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
            >
              {{ $t('auth.cantAccessAuthApp') }}
            </button>
          </div>

          <!-- Back to Login -->
          <div class="text-center pt-4 border-t border-[var(--color-border)]">
            <NuxtLink
              to="/login"
              class="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {{ $t('auth.backToLogin') }}
            </NuxtLink>
          </div>
        </form>
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
const { verify2FA } = useAuth()

const code = ref('')
const loading = ref(false)
const errorMessage = ref('')
const usedBackupCode = ref(false)

const userId = computed(() => route.query.userId as string)
const rememberMe = computed(() => route.query.rememberMe === 'true')

const isBackupCode = computed(() => code.value.length > 6)

// Format code to only allow numbers
const formatCode = (event: Event) => {
  const input = event.target as HTMLInputElement
  code.value = input.value.replace(/[^0-9]/g, '')
}

const handleSubmit = async () => {
  if (!userId.value) {
    errorMessage.value = t('auth.userIdNotFound')
    return
  }

  if (!code.value || (code.value.length !== 6 && code.value.length !== 8)) {
    errorMessage.value = t('auth.invalidCodeFormat')
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await verify2FA(
      {
        userId: userId.value,
        code: code.value,
      },
      rememberMe.value
    )

    if (result.usedBackupCode) {
      usedBackupCode.value = true
      // Show warning briefly before redirect
      setTimeout(() => {
        navigateTo('/')
      }, 2000)
    } else {
      // Immediate redirect for normal 2FA
      navigateTo('/')
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      errorMessage.value = t('auth.invalidAuthCode')
    } else {
      errorMessage.value = error.response?.data?.message || t('auth.twoFactorFailed')
    }
    code.value = '' // Clear code on error
  } finally {
    loading.value = false
  }
}

const showBackupCodeHelp = () => {
  alert(t('auth.backupCodeHelp'))
}

// Validate userId on mount
onMounted(() => {
  if (!userId.value) {
    errorMessage.value = t('auth.userIdNotFound')
  }
})
</script>
