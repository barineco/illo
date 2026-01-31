<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-xl p-8 max-w-md w-full mx-4">
        <h2 class="text-2xl font-bold mb-6">{{ $t('twoFactor.setup') }}</h2>

        <!-- Step 1: QR Code Display -->
        <div v-if="step === 1" class="space-y-4">
          <!-- Loading State -->
          <div v-if="loading" class="text-center py-8">
            <p class="text-[var(--color-text-muted)]">{{ $t('twoFactor.generatingQRCode') }}</p>
          </div>

          <!-- QR Code Display -->
          <div v-else-if="qrCodeUrl" class="space-y-4">
            <p class="text-[var(--color-text-muted)] text-sm">
              {{ $t('twoFactor.setupDescription') }}
            </p>

            <!-- QR Code Image -->
            <div class="bg-white p-4 rounded-lg flex justify-center">
              <img :src="qrCodeUrl" alt="QR Code" class="w-64 h-64" />
            </div>

            <!-- Manual Entry Secret -->
            <div class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
              <p class="text-sm text-[var(--color-text-muted)] mb-2">
                {{ $t('twoFactor.manualEntry') }}
              </p>
              <code class="text-[var(--color-primary)] font-mono break-all">
                {{ secret }}
              </code>
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3">
              <BaseButton
                variant="outline"
                size="md"
                shape="rounded"
                class="flex-1"
                @click="close"
              >
                {{ $t('common.cancel') }}
              </BaseButton>
              <BaseButton
                variant="primary"
                size="lg"
                shape="rounded"
                class="flex-1"
                @click="step = 2"
              >
                {{ $t('common.next') }}
              </BaseButton>
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3">
            <p class="text-[var(--color-danger-text)] text-sm">{{ error }}</p>
          </div>
        </div>

        <!-- Step 2: Verification -->
        <div v-else-if="step === 2" class="space-y-4">
          <p class="text-[var(--color-text-muted)] text-sm">
            {{ $t('twoFactor.verificationCodeHint') }}
          </p>

          <!-- Code Input -->
          <div>
            <label for="verification-code" class="block text-sm font-medium mb-2">
              {{ $t('twoFactor.verificationCode') }}
            </label>
            <input
              id="verification-code"
              v-model="verificationCode"
              type="text"
              inputmode="numeric"
              pattern="[0-9]{6}"
              maxlength="6"
              :disabled="verifying"
              placeholder="000000"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50 text-center text-2xl tracking-widest font-mono"
              @input="validateCode"
            />
          </div>

          <!-- Backup Codes Display -->
          <div v-if="backupCodes.length > 0" class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-text)] rounded-lg p-4">
            <p class="text-[var(--color-warning-text)] font-medium mb-2 flex items-center gap-2">
              <Icon name="ExclamationTriangle" class="w-5 h-5" /> {{ $t('twoFactor.backupCodes') }}
            </p>
            <p class="text-sm text-[var(--color-text-muted)] mb-3">
              {{ $t('twoFactor.backupCodesDescription') }}
            </p>
            <div class="grid grid-cols-2 gap-2 bg-[var(--color-background)] rounded p-3">
              <code
                v-for="(code, index) in backupCodes"
                :key="index"
                class="text-sm font-mono text-[var(--color-text)]"
              >
                {{ code }}
              </code>
            </div>
            <BaseButton
              variant="outline"
              size="md"
              shape="rounded"
              full-width
              class="mt-3"
              @click="copyBackupCodes"
            >
              {{ copied ? $t('twoFactor.copied') : $t('twoFactor.copyBackupCodes') }}
            </BaseButton>
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
              :disabled="verifying || success !== ''"
              class="flex-1"
              @click="step = 1"
            >
              {{ $t('common.back') }}
            </BaseButton>
            <BaseButton
              v-if="!success"
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="verifying || verificationCode.length !== 6"
              :loading="verifying"
              class="flex-1"
              @click="verifyAndEnable"
            >
              {{ $t('twoFactor.enable') }}
            </BaseButton>
            <BaseButton
              v-else
              variant="primary"
              size="md"
              shape="rounded"
              class="flex-1"
              @click="closeWithRefresh"
            >
              {{ $t('common.done') }}
            </BaseButton>
          </div>
        </div>

        <!-- Close Button -->
        <IconButton
          v-if="!verifying && !success"
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
const step = ref(1) // 1: QR Code, 2: Verification
const loading = ref(false)
const verifying = ref(false)
const error = ref('')
const success = ref('')

// QR Code Data
const qrCodeUrl = ref('')
const secret = ref('')

// Verification
const verificationCode = ref('')
const backupCodes = ref<string[]>([])
const copied = ref(false)

interface SetupResponse {
  qrCode: string
  secret: string
}

interface EnableResponse {
  backupCodes: string[]
}

// Setup 2FA
const setup2FA = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await api.post<SetupResponse>('/api/auth/2fa/setup')
    qrCodeUrl.value = response.qrCode
    secret.value = response.secret
  } catch (err: any) {
    error.value = err.response?.data?.message || t('twoFactor.setupFailed')
  } finally {
    loading.value = false
  }
}

// Validate Code Input
const validateCode = (event: Event) => {
  const input = event.target as HTMLInputElement
  input.value = input.value.replace(/\D/g, '').slice(0, 6)
  verificationCode.value = input.value
}

// Verify and Enable 2FA
const verifyAndEnable = async () => {
  verifying.value = true
  error.value = ''
  success.value = ''
  try {
    const response = await api.post<EnableResponse>('/api/auth/2fa/enable', {
      secret: secret.value,
      token: verificationCode.value,
    })
    backupCodes.value = response.backupCodes || []
    success.value = t('twoFactor.twoFactorEnabled')
  } catch (err: any) {
    error.value = err.response?.data?.message || t('twoFactor.invalidCode')
  } finally {
    verifying.value = false
  }
}

// Copy Backup Codes
const copyBackupCodes = async () => {
  try {
    await navigator.clipboard.writeText(backupCodes.value.join('\n'))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy backup codes:', err)
  }
}

// Close Modal
const close = () => {
  if (!verifying.value && !success.value) {
    emit('close')
  }
}

// Close with Refresh
const closeWithRefresh = () => {
  emit('success')
  emit('close')
}

// Watch for Modal Open
watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      // Reset state
      step.value = 1
      loading.value = false
      verifying.value = false
      error.value = ''
      success.value = ''
      qrCodeUrl.value = ''
      secret.value = ''
      verificationCode.value = ''
      backupCodes.value = []
      copied.value = false

      // Setup 2FA
      setup2FA()
    }
  }
)
</script>
