<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-xl p-8 max-w-md w-full mx-4">
        <h2 class="text-2xl font-bold mb-6">{{ $t('twoFactor.disableTitle') }}</h2>

        <div class="space-y-4">
          <!-- Warning Message -->
          <div class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-text)] rounded-lg p-4">
            <p class="text-[var(--color-warning-text)] font-medium mb-2 flex items-center gap-2">
              <Icon name="ExclamationTriangle" class="w-5 h-5" /> {{ $t('warning') }}
            </p>
            <p class="text-sm text-[var(--color-text-muted)]">
              {{ $t('twoFactor.disableWarning') }}
            </p>
          </div>

          <!-- Code Input -->
          <div>
            <label for="disable-code" class="block text-sm font-medium mb-2">
              {{ $t('twoFactor.verificationCode') }}
            </label>
            <input
              id="disable-code"
              v-model="verificationCode"
              type="text"
              inputmode="numeric"
              pattern="[0-9]{6}"
              maxlength="6"
              :disabled="disabling"
              placeholder="000000"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 text-center text-2xl tracking-widest font-mono"
              @input="validateCode"
            />
            <p class="text-xs text-[var(--color-text-muted)] mt-2">
              {{ $t('twoFactor.verificationCodeHint') }}
            </p>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3">
            <p class="text-[var(--color-danger-text)] text-sm">{{ error }}</p>
          </div>

          <!-- Success Message -->
          <div v-if="success" class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-3">
            <p class="text-[var(--color-success-text)] text-sm">{{ success }}</p>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3">
            <BaseButton
              variant="outline"
              size="md"
              shape="rounded"
              :disabled="disabling || !!success"
              class="flex-1"
              @click="close"
            >
              {{ $t('common.cancel') }}
            </BaseButton>
            <BaseButton
              v-if="!success"
              variant="danger"
              size="md"
              shape="rounded"
              :disabled="disabling || verificationCode.length !== 6"
              :loading="disabling"
              class="flex-1"
              @click="disable2FA"
            >
              {{ $t('twoFactor.disable') }}
            </BaseButton>
          </div>
        </div>

        <!-- Close Button -->
        <IconButton
          v-if="!disabling && !success"
          variant="ghost"
          size="sm"
          shape="rounded"
          class="absolute top-4 right-4"
          :aria-label="$t('common.close')"
          @click="close"
        >
          <Icon name="XMark" class="w-6 h-6" />
        </IconButton>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const api = useApi()

// State
const disabling = ref(false)
const error = ref('')
const success = ref('')
const verificationCode = ref('')

// Validate Code Input
const validateCode = (event: Event) => {
  const input = event.target as HTMLInputElement
  input.value = input.value.replace(/\D/g, '').slice(0, 6)
  verificationCode.value = input.value
}

// Disable 2FA
const disable2FA = async () => {
  disabling.value = true
  error.value = ''
  success.value = ''
  try {
    await api.post('/api/auth/2fa/disable', {
      code: verificationCode.value,
    })
    success.value = t('twoFactor.twoFactorDisabled')

    // Close after delay
    setTimeout(() => {
      emit('success')
      emit('close')
    }, 1500)
  } catch (err: any) {
    error.value = err.response?.data?.message || t('twoFactor.invalidCode')
  } finally {
    disabling.value = false
  }
}

// Close Modal
const close = () => {
  if (!disabling.value && !success.value) {
    emit('close')
  }
}

// Watch for Modal Open
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      // Reset state
      disabling.value = false
      error.value = ''
      success.value = ''
      verificationCode.value = ''
    }
  }
)
</script>
