<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-xl p-8 max-w-md w-full mx-4 relative">
        <h2 class="text-2xl font-bold mb-6">{{ $t('passkey.setup') }}</h2>

        <!-- Step 1: Name Input -->
        <div v-if="step === 1" class="space-y-4">
          <p class="text-[var(--color-text-muted)] text-sm">
            {{ $t('passkey.setupDescription') }}
          </p>

          <div>
            <label for="passkey-name" class="block text-sm font-medium mb-2">
              {{ $t('passkey.name') }}
            </label>
            <input
              id="passkey-name"
              v-model="passkeyName"
              type="text"
              :placeholder="$t('passkey.namePlaceholder')"
              :disabled="registering"
              class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
              @keyup.enter="register"
            />
          </div>

          <!-- Error Message -->
          <div v-if="error" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3">
            <p class="text-[var(--color-danger-text)] text-sm">{{ error }}</p>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3">
            <BaseButton
              variant="outline"
              size="md"
              shape="rounded"
              :disabled="registering"
              class="flex-1"
              @click="close"
            >
              {{ $t('common.cancel') }}
            </BaseButton>
            <BaseButton
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="!passkeyName.trim() || registering"
              :loading="registering"
              class="flex-1"
              @click="register"
            >
              {{ $t('passkey.register') }}
            </BaseButton>
          </div>
        </div>

        <!-- Step 2: Success -->
        <div v-else-if="step === 2" class="space-y-4">
          <div class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-4 text-center">
            <Icon name="CheckCircle" class="w-12 h-12 text-[var(--color-success-text)] mx-auto mb-2" />
            <p class="text-[var(--color-success-text)] font-medium">{{ $t('passkey.registered') }}</p>
          </div>

          <div class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
            <p class="text-sm text-[var(--color-text-muted)] mb-1">{{ $t('passkey.name') }}</p>
            <p class="font-medium">{{ registeredPasskey?.name }}</p>
            <p class="text-sm text-[var(--color-text-muted)] mt-2">
              {{ registeredPasskey?.credentialBackedUp ? $t('passkey.synced') : $t('passkey.deviceOnly') }}
            </p>
          </div>

          <BaseButton
            variant="primary"
            size="md"
            shape="rounded"
            full-width
            @click="closeWithSuccess"
          >
            {{ $t('common.done') }}
          </BaseButton>
        </div>

        <!-- Close Button -->
        <IconButton
          v-if="!registering && step !== 2"
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
interface PasskeyInfo {
  id: string
  name: string
  credentialDeviceType: string
  credentialBackedUp: boolean
  transports: string[]
  createdAt: string
  lastUsedAt: string | null
}

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const { t } = useI18n()
const { registerPasskey: doRegisterPasskey } = usePasskey()

// State
const step = ref(1) // 1: Name Input, 2: Success
const passkeyName = ref('')
const registering = ref(false)
const error = ref('')
const registeredPasskey = ref<PasskeyInfo | null>(null)

// Register Passkey
const register = async () => {
  if (!passkeyName.value.trim() || registering.value) return

  registering.value = true
  error.value = ''

  try {
    const passkey = await doRegisterPasskey(passkeyName.value.trim())
    registeredPasskey.value = passkey
    step.value = 2
  } catch (err: any) {
    // Handle specific WebAuthn errors
    if (err.name === 'NotAllowedError') {
      error.value = t('passkey.cancelled')
    } else if (err.name === 'InvalidStateError') {
      error.value = t('passkey.alreadyRegistered')
    } else if (err.name === 'NotSupportedError') {
      error.value = t('passkey.notSupported')
    } else {
      error.value = err.data?.message || err.message || t('passkey.registrationFailed')
    }
  } finally {
    registering.value = false
  }
}

// Close Modal
const close = () => {
  if (!registering.value) {
    emit('close')
  }
}

// Close with Success
const closeWithSuccess = () => {
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
      passkeyName.value = ''
      registering.value = false
      error.value = ''
      registeredPasskey.value = null
    }
  }
)
</script>
