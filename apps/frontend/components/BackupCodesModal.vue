<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-xl p-8 max-w-md w-full mx-4">
        <h2 class="text-2xl font-bold mb-6">{{ $t('twoFactor.backupCodes') }}</h2>

        <div class="space-y-4">
          <!-- Warning Message -->
          <div class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-text)] rounded-lg p-4">
            <p class="text-[var(--color-warning-text)] font-medium mb-2 flex items-center gap-2">
              <Icon name="ExclamationTriangle" class="w-5 h-5" /> {{ $t('important') }}
            </p>
            <p class="text-sm text-[var(--color-text-muted)]">
              {{ $t('twoFactor.backupCodesImportant') }}
            </p>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="text-center py-8">
            <p class="text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
          </div>

          <!-- Backup Codes Display -->
          <div v-else-if="showFullCodes && fullBackupCodes.length > 0" class="space-y-4">
            <!-- Full codes (after regeneration) -->
            <div class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
              <div class="grid grid-cols-2 gap-3">
                <code
                  v-for="(code, index) in fullBackupCodes"
                  :key="index"
                  class="text-sm font-mono text-[var(--color-text)] bg-[var(--color-surface)] px-3 py-2 rounded"
                >
                  {{ code }}
                </code>
              </div>
            </div>

            <!-- Copy Button -->
            <BaseButton
              variant="primary"
              size="md"
              shape="rounded"
              full-width
              @click="copyFullCodes"
            >
              {{ copied ? $t('twoFactor.copied') : $t('twoFactor.copyBackupCodes') }}
            </BaseButton>
          </div>

          <!-- Masked Codes Display (existing codes) -->
          <div v-else-if="maskedCodes.length > 0" class="space-y-4">
            <div class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
              <p class="text-sm text-[var(--color-text-muted)] mb-3">
                {{ $t('twoFactor.available') }}: {{ remainingCount }} / {{ totalCount }}
              </p>
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="(item, index) in maskedCodes"
                  :key="index"
                  class="flex items-center gap-2"
                >
                  <code
                    class="text-sm font-mono bg-[var(--color-surface)] px-3 py-2 rounded flex-1"
                    :class="item.isUsed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text)]'"
                  >
                    {{ item.masked }}
                  </code>
                  <span v-if="item.isUsed" class="text-xs text-[var(--color-text-muted)]">{{ $t('twoFactor.used') }}</span>
                </div>
              </div>
            </div>

            <!-- Regenerate Button -->
            <BaseButton
              variant="outline"
              size="md"
              shape="rounded"
              full-width
              :disabled="regenerating"
              :loading="regenerating"
              @click="confirmRegenerate"
            >
              {{ $t('twoFactor.regenerateBackupCodes') }}
            </BaseButton>
            <p class="text-xs text-[var(--color-text-muted)] text-center flex items-center justify-center gap-1">
              <Icon name="ExclamationTriangle" class="w-4 h-4" /> {{ $t('twoFactor.regenerateWarning') }}
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

          <!-- Close Button -->
          <BaseButton
            variant="outline"
            size="md"
            shape="rounded"
            full-width
            :disabled="regenerating"
            @click="close"
          >
            {{ $t('common.close') }}
          </BaseButton>
        </div>

        <!-- Close Button (X) -->
        <IconButton
          v-if="!regenerating"
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
}>()

const { t } = useI18n()
const api = useApi()

// State
const loading = ref(false)
const regenerating = ref(false)
const error = ref('')
const success = ref('')
const copied = ref(false)

// Masked codes (existing)
const maskedCodes = ref<Array<{ masked: string; isUsed: boolean; usedAt: Date | null }>>([])
const totalCount = ref(0)
const remainingCount = ref(0)

// Full codes (after regeneration)
const showFullCodes = ref(false)
const fullBackupCodes = ref<string[]>([])

interface BackupCodeInfo {
  masked: string
  isUsed: boolean
  usedAt: Date | null
}

interface BackupCodesResponse {
  codes: BackupCodeInfo[]
  totalCount: number
  remainingCount: number
}

interface RegenerateResponse {
  backupCodes: string[]
}

const fetchBackupCodes = async () => {
  loading.value = true
  error.value = ''
  showFullCodes.value = false
  try {
    const response = await api.get<BackupCodesResponse>('/api/auth/2fa/backup-codes')
    maskedCodes.value = response.codes || []
    totalCount.value = response.totalCount || 0
    remainingCount.value = response.remainingCount || 0
  } catch (err: any) {
    error.value = err.response?.data?.message || t('twoFactor.fetchBackupCodesFailed')
  } finally {
    loading.value = false
  }
}

const confirmRegenerate = async () => {
  if (!confirm(t('twoFactor.confirmRegenerate'))) {
    return
  }

  regenerating.value = true
  error.value = ''
  success.value = ''
  try {
    const response = await api.post<RegenerateResponse>('/api/auth/2fa/regenerate-backup-codes')
    fullBackupCodes.value = response.backupCodes || []
    showFullCodes.value = true
    success.value = t('twoFactor.regenerated')
  } catch (err: any) {
    error.value = err.response?.data?.message || t('twoFactor.regenerateFailed')
  } finally {
    regenerating.value = false
  }
}

const copyFullCodes = async () => {
  try {
    await navigator.clipboard.writeText(fullBackupCodes.value.join('\n'))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy backup codes:', err)
    error.value = t('twoFactor.copyFailed')
  }
}

const close = () => {
  if (!regenerating.value) {
    emit('close')
  }
}

watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      loading.value = false
      regenerating.value = false
      error.value = ''
      success.value = ''
      copied.value = false
      maskedCodes.value = []
      totalCount.value = 0
      remainingCount.value = 0
      showFullCodes.value = false
      fullBackupCodes.value = []

      fetchBackupCodes()
    }
  }
)
</script>
