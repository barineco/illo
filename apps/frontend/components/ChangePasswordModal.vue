<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-xl p-8 max-w-md w-full mx-4">
        <h2 class="text-2xl font-bold mb-6">{{ $t('security.changePassword') }}</h2>

        <div class="space-y-4">
          <!-- Current Password -->
          <div>
            <label for="current-password" class="block text-sm font-medium mb-2">
              {{ $t('security.currentPassword') }}
            </label>
            <input
              id="current-password"
              v-model="currentPassword"
              type="password"
              :disabled="changing"
              :placeholder="$t('security.currentPasswordPlaceholder')"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            />
          </div>

          <!-- New Password -->
          <div>
            <label for="new-password" class="block text-sm font-medium mb-2">
              {{ $t('security.newPassword') }}
            </label>
            <input
              id="new-password"
              v-model="newPassword"
              type="password"
              :disabled="changing"
              :placeholder="$t('security.newPasswordPlaceholder')"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            />
          </div>

          <!-- Confirm New Password -->
          <div>
            <label for="confirm-password" class="block text-sm font-medium mb-2">
              {{ $t('security.confirmNewPassword') }}
            </label>
            <input
              id="confirm-password"
              v-model="confirmPassword"
              type="password"
              :disabled="changing"
              :placeholder="$t('security.confirmNewPasswordPlaceholder')"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
            />
          </div>

          <!-- Revoke Other Sessions Checkbox -->
          <div class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
            <label class="flex items-start cursor-pointer">
              <input
                v-model="revokeOtherSessions"
                type="checkbox"
                :disabled="changing"
                class="mt-0.5 mr-3"
              />
              <div>
                <p class="font-medium text-sm">{{ $t('security.revokeOtherDevices') }}</p>
                <p class="text-xs text-[var(--color-text-muted)] mt-1">
                  {{ $t('security.revokeOtherDevicesDesc') }}
                </p>
              </div>
            </label>
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
              :disabled="changing || !!success"
              class="flex-1"
              @click="close"
            >
              {{ $t('common.cancel') }}
            </BaseButton>
            <BaseButton
              v-if="!success"
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="changing || !isFormValid"
              :loading="changing"
              class="flex-1"
              @click="changePassword"
            >
              {{ $t('security.changePasswordButton') }}
            </BaseButton>
          </div>
        </div>

        <!-- Close Button -->
        <IconButton
          v-if="!changing && !success"
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
const changing = ref(false)
const error = ref('')
const success = ref('')

// Form Fields
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const revokeOtherSessions = ref(true) // Default to checked

// Form Validation
const isFormValid = computed(() => {
  return (
    currentPassword.value.length > 0 &&
    newPassword.value.length >= 8 &&
    confirmPassword.value.length > 0 &&
    newPassword.value === confirmPassword.value
  )
})

// Change Password
const changePassword = async () => {
  changing.value = true
  error.value = ''
  success.value = ''

  // Client-side validation
  if (newPassword.value !== confirmPassword.value) {
    error.value = t('auth.passwordMismatch')
    changing.value = false
    return
  }

  if (newPassword.value.length < 8) {
    error.value = t('auth.passwordMinLength')
    changing.value = false
    return
  }

  if (currentPassword.value === newPassword.value) {
    error.value = t('security.passwordMustBeDifferent')
    changing.value = false
    return
  }

  try {
    await api.post('/api/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      revokeOtherSessions: revokeOtherSessions.value,
    })

    success.value = t('security.passwordChanged')

    // Close after delay
    setTimeout(() => {
      emit('success')
      emit('close')
    }, 1500)
  } catch (err: any) {
    error.value = err.response?.data?.message || t('security.passwordChangeFailed')
  } finally {
    changing.value = false
  }
}

// Close Modal
const close = () => {
  if (!changing.value && !success.value) {
    emit('close')
  }
}

// Watch for Modal Open
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      // Reset state
      changing.value = false
      error.value = ''
      success.value = ''
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
      revokeOtherSessions.value = true
    }
  }
)
</script>
