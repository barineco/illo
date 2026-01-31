<template>
  <div class="space-y-6">
    <!-- Passkeys Section -->
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t('security.passkeys') }}</h2>

      <!-- Not Supported Warning -->
      <div v-if="!passkeySupported" class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-text)] rounded-lg p-4 mb-4">
        <p class="text-[var(--color-warning-text)] text-sm">
          {{ $t('passkey.notSupported') }}
        </p>
      </div>

      <!-- Loading State -->
      <div v-else-if="loadingPasskeys" class="text-[var(--color-text-muted)]">
        {{ $t('common.loading') }}
      </div>

      <!-- Passkeys List -->
      <div v-else class="space-y-4">
        <p class="text-[var(--color-text-muted)] text-sm">
          {{ $t('passkey.description') }}
        </p>

        <!-- Passkey Items -->
        <div
          v-for="passkey in passkeys"
          :key="passkey.id"
          class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4"
        >
          <div class="flex justify-between items-start">
            <div>
              <p class="font-medium">{{ passkey.name }}</p>
              <p class="text-sm text-[var(--color-text-muted)] mt-1">
                {{ passkey.credentialBackedUp ? $t('passkey.synced') : $t('passkey.deviceOnly') }}
                <span v-if="passkey.lastUsedAt"> • {{ $t('security.lastUsed') }}: {{ formatDate(passkey.lastUsedAt) }}</span>
              </p>
              <p class="text-xs text-[var(--color-text-muted)] mt-1">
                {{ $t('security.created') }}: {{ formatDate(passkey.createdAt) }}
              </p>
            </div>
            <div class="flex gap-2">
              <BaseButton
                variant="outline"
                size="sm"
                shape="rounded"
                :disabled="renamingPasskeyId === passkey.id || deletingPasskeyId === passkey.id"
                @click="startRenamePasskey(passkey)"
              >
                {{ $t('common.rename') }}
              </BaseButton>
              <BaseButton
                variant="danger"
                size="sm"
                shape="rounded"
                :disabled="deletingPasskeyId === passkey.id"
                :loading="deletingPasskeyId === passkey.id"
                @click="confirmDeletePasskey(passkey)"
              >
                {{ $t('common.delete') }}
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- No Passkeys Message -->
        <div v-if="passkeys.length === 0" class="text-[var(--color-text-muted)] text-sm">
          {{ $t('passkey.noPasskeys') }}
        </div>

        <!-- Add Passkey Button -->
        <BaseButton
          variant="primary"
          size="md"
          shape="rounded"
          @click="showPasskeySetupModal = true"
        >
          {{ $t('passkey.add') }}
        </BaseButton>
      </div>

      <!-- Error Message -->
      <div v-if="errorPasskeys" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3 mt-4">
        <p class="text-[var(--color-danger-text)] text-sm">{{ errorPasskeys }}</p>
      </div>

      <!-- Success Message -->
      <div v-if="successPasskeys" class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-3 mt-4">
        <p class="text-[var(--color-success-text)] text-sm">{{ successPasskeys }}</p>
      </div>
    </div>

    <!-- Two-Factor Authentication Section -->
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t('security.twoFactor') }}</h2>

      <!-- Loading State -->
      <div v-if="loading2FA" class="text-[var(--color-text-muted)]">
        {{ $t('common.loading') }}
      </div>

      <!-- 2FA Enabled State -->
      <div v-else-if="twoFactorStatus?.enabled" class="space-y-4">
        <div class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-4">
          <p class="text-[var(--color-success-text)] font-medium">{{ $t('security.twoFactorEnabledStatus') }}</p>
          <p class="text-[var(--color-text-muted)] text-sm mt-1">
            {{ $t('security.securityEnhanced') }}
          </p>
        </div>

        <div class="flex gap-3">
          <BaseButton
            variant="outline"
            size="md"
            shape="rounded"
            @click="showBackupCodesModal = true"
          >
            {{ $t('security.showBackupCodes') }}
          </BaseButton>
          <BaseButton
            variant="danger"
            size="md"
            shape="rounded"
            @click="showDisable2FAModal = true"
          >
            {{ $t('twoFactor.disable') }}
          </BaseButton>
        </div>
      </div>

      <!-- 2FA Disabled State -->
      <div v-else class="space-y-4">
        <p class="text-[var(--color-text-muted)] text-sm mb-4">
          {{ $t('security.twoFactorDescription') }}
        </p>
        <BaseButton
          variant="primary"
          size="md"
          shape="rounded"
          @click="showSetup2FAModal = true"
        >
          {{ $t('security.enableTwoFactor') }}
        </BaseButton>
      </div>

      <!-- Error Message -->
      <div v-if="error2FA" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3 mt-4">
        <p class="text-[var(--color-danger-text)] text-sm">{{ error2FA }}</p>
      </div>
    </div>

    <!-- Active Sessions Section -->
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t('security.activeSessions') }}</h2>

      <!-- Loading State -->
      <div v-if="loadingSessions" class="text-[var(--color-text-muted)]">
        {{ $t('common.loading') }}
      </div>

      <!-- Sessions List -->
      <div v-else-if="sessions.length > 0" class="space-y-3">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4"
        >
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <p class="font-medium">{{ session.deviceName }}</p>
                <span
                  v-if="session.isCurrent"
                  class="px-2 py-0.5 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] text-[var(--color-success-text)] text-xs rounded"
                >
                  {{ $t('security.currentSession') }}
                </span>
              </div>
              <p class="text-sm text-[var(--color-text-muted)] mt-1">
                {{ session.deviceType }}
                <span v-if="session.ipAddress"> • {{ session.ipAddress }}</span>
                <span v-if="session.location"> • {{ session.location }}</span>
              </p>
              <p class="text-xs text-[var(--color-text-muted)] mt-1">
                {{ $t('security.created') }}: {{ formatDate(session.createdAt) }} •
                {{ $t('security.lastUsed') }}: {{ formatDate(session.lastUsedAt) }}
              </p>
            </div>
            <BaseButton
              v-if="!session.isCurrent"
              variant="danger"
              size="sm"
              shape="rounded"
              :disabled="revokingSessionId === session.id"
              :loading="revokingSessionId === session.id"
              @click="revokeSessionById(session.id)"
            >
              {{ $t('common.delete') }}
            </BaseButton>
          </div>
        </div>

        <!-- Revoke All Button -->
        <div class="pt-4 border-t border-[var(--color-border)]">
          <BaseButton
            variant="danger"
            size="md"
            shape="rounded"
            :disabled="revokingAll"
            :loading="revokingAll"
            @click="revokeAllOtherSessions"
          >
            {{ $t('security.revokeAllOtherSessions') }}
          </BaseButton>
        </div>
      </div>

      <!-- No Sessions -->
      <div v-else class="text-[var(--color-text-muted)] text-sm">
        {{ $t('security.noActiveSessions') }}
      </div>

      <!-- Error Message -->
      <div v-if="errorSessions" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-3 mt-4">
        <p class="text-[var(--color-danger-text)] text-sm">{{ errorSessions }}</p>
      </div>

      <!-- Success Message -->
      <div v-if="successSessions" class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-3 mt-4">
        <p class="text-[var(--color-success-text)] text-sm">{{ successSessions }}</p>
      </div>
    </div>

    <!-- Password Change Section -->
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t('security.changePassword') }}</h2>
      <p class="text-[var(--color-text-muted)] text-sm mb-4">
        {{ $t('security.changePasswordDescription') }}
      </p>
      <BaseButton
        variant="primary"
        size="md"
        shape="rounded"
        @click="showChangePasswordModal = true"
      >
        {{ $t('security.changePasswordButton') }}
      </BaseButton>
    </div>

    <!-- Modals -->
    <TwoFactorSetupModal
      :is-open="showSetup2FAModal"
      @close="showSetup2FAModal = false"
      @success="on2FAEnabled"
    />

    <DisableTwoFactorModal
      :is-open="showDisable2FAModal"
      @close="showDisable2FAModal = false"
      @success="on2FADisabled"
    />

    <BackupCodesModal
      :is-open="showBackupCodesModal"
      @close="showBackupCodesModal = false"
    />

    <ChangePasswordModal
      :is-open="showChangePasswordModal"
      @close="showChangePasswordModal = false"
      @success="onPasswordChanged"
    />

    <PasskeySetupModal
      :is-open="showPasskeySetupModal"
      @close="showPasskeySetupModal = false"
      @success="onPasskeyAdded"
    />

    <!-- Rename Passkey Dialog -->
    <Teleport to="body">
      <div
        v-if="showRenamePasskeyModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
        @click.self="showRenamePasskeyModal = false"
      >
        <div class="bg-[var(--color-surface)] rounded-xl p-6 max-w-sm w-full mx-4">
          <h3 class="text-lg font-bold mb-4">{{ $t('passkey.rename') }}</h3>
          <input
            v-model="renamePasskeyName"
            type="text"
            class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] mb-4"
            :placeholder="$t('passkey.namePlaceholder')"
            @keyup.enter="doRenamePasskey"
          />
          <div class="flex gap-3">
            <BaseButton
              variant="outline"
              size="md"
              shape="rounded"
              class="flex-1"
              :disabled="renamingPasskeyId !== null"
              @click="showRenamePasskeyModal = false"
            >
              {{ $t('common.cancel') }}
            </BaseButton>
            <BaseButton
              variant="primary"
              size="md"
              shape="rounded"
              class="flex-1"
              :disabled="!renamePasskeyName.trim() || renamingPasskeyId !== null"
              :loading="renamingPasskeyId !== null"
              @click="doRenamePasskey"
            >
              {{ $t('common.save') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
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

const { t } = useI18n()
const { user } = useAuth()
const { getSessions, revokeSession, revokeAllSessions } = useSession()
const {
  isSupported: passkeySupported,
  getPasskeys,
  renamePasskey,
  deletePasskey: deletePasskeyApi,
} = usePasskey()
const api = useApi()

// Passkey State
const loadingPasskeys = ref(true)
const errorPasskeys = ref('')
const successPasskeys = ref('')
const passkeys = ref<PasskeyInfo[]>([])
const showPasskeySetupModal = ref(false)
const showRenamePasskeyModal = ref(false)
const renamePasskeyName = ref('')
const renamePasskeyTarget = ref<PasskeyInfo | null>(null)
const renamingPasskeyId = ref<string | null>(null)
const deletingPasskeyId = ref<string | null>(null)

// 2FA State
const loading2FA = ref(true)
const error2FA = ref('')
const twoFactorStatus = ref<{ enabled: boolean } | null>(null)
const showSetup2FAModal = ref(false)
const showDisable2FAModal = ref(false)
const showBackupCodesModal = ref(false)

// Password Change State
const showChangePasswordModal = ref(false)

// Sessions State
const loadingSessions = ref(true)
const errorSessions = ref('')
const successSessions = ref('')
const sessions = ref<any[]>([])
const revokingSessionId = ref<string | null>(null)
const revokingAll = ref(false)

// Fetch 2FA Status
const fetch2FAStatus = async () => {
  loading2FA.value = true
  error2FA.value = ''
  try {
    const response = await api.get<{ enabled: boolean }>('/api/auth/2fa/status')
    twoFactorStatus.value = response
  } catch (err: any) {
    error2FA.value = err.response?.data?.message || t('security.fetch2FAStatusFailed')
  } finally {
    loading2FA.value = false
  }
}

// Fetch Sessions
const fetchSessions = async () => {
  loadingSessions.value = true
  errorSessions.value = ''
  successSessions.value = ''
  try {
    sessions.value = await getSessions()
  } catch (err: any) {
    errorSessions.value = err.response?.data?.message || t('security.fetchSessionsFailed')
  } finally {
    loadingSessions.value = false
  }
}

// Revoke Single Session
const revokeSessionById = async (sessionId: string) => {
  revokingSessionId.value = sessionId
  errorSessions.value = ''
  successSessions.value = ''
  try {
    await revokeSession(sessionId)
    successSessions.value = t('security.sessionRevoked')
    await fetchSessions()
  } catch (err: any) {
    errorSessions.value = err.response?.data?.message || t('security.revokeSessionFailed')
  } finally {
    revokingSessionId.value = null
  }
}

// Revoke All Other Sessions
const revokeAllOtherSessions = async () => {
  if (!confirm(t('security.confirmRevokeAll'))) {
    return
  }

  revokingAll.value = true
  errorSessions.value = ''
  successSessions.value = ''
  try {
    await revokeAllSessions()
    successSessions.value = t('security.allSessionsRevoked')
    await fetchSessions()
  } catch (err: any) {
    errorSessions.value = err.response?.data?.message || t('security.revokeSessionFailed')
  } finally {
    revokingAll.value = false
  }
}

// Format Date
const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 2FA Event Handlers
const on2FAEnabled = async () => {
  await fetch2FAStatus()
}

const on2FADisabled = async () => {
  await fetch2FAStatus()
}

// Password Change Event Handler
const onPasswordChanged = async () => {
  // Optionally refresh sessions if other sessions were revoked
  await fetchSessions()
}

// Fetch Passkeys
const fetchPasskeys = async () => {
  if (!passkeySupported.value) {
    loadingPasskeys.value = false
    return
  }

  loadingPasskeys.value = true
  errorPasskeys.value = ''
  successPasskeys.value = ''
  try {
    passkeys.value = await getPasskeys()
  } catch (err: any) {
    errorPasskeys.value = err.data?.message || t('passkey.fetchFailed')
  } finally {
    loadingPasskeys.value = false
  }
}

// Start Rename Passkey
const startRenamePasskey = (passkey: PasskeyInfo) => {
  renamePasskeyTarget.value = passkey
  renamePasskeyName.value = passkey.name
  showRenamePasskeyModal.value = true
}

// Do Rename Passkey
const doRenamePasskey = async () => {
  if (!renamePasskeyTarget.value || !renamePasskeyName.value.trim()) return

  renamingPasskeyId.value = renamePasskeyTarget.value.id
  errorPasskeys.value = ''
  successPasskeys.value = ''
  try {
    await renamePasskey(renamePasskeyTarget.value.id, renamePasskeyName.value.trim())
    successPasskeys.value = t('passkey.renamed')
    showRenamePasskeyModal.value = false
    await fetchPasskeys()
  } catch (err: any) {
    errorPasskeys.value = err.data?.message || t('passkey.renameFailed')
  } finally {
    renamingPasskeyId.value = null
    renamePasskeyTarget.value = null
  }
}

// Confirm Delete Passkey
const confirmDeletePasskey = async (passkey: PasskeyInfo) => {
  if (!confirm(t('passkey.confirmDelete', { name: passkey.name }))) {
    return
  }

  deletingPasskeyId.value = passkey.id
  errorPasskeys.value = ''
  successPasskeys.value = ''
  try {
    await deletePasskeyApi(passkey.id)
    successPasskeys.value = t('passkey.deleted')
    await fetchPasskeys()
  } catch (err: any) {
    errorPasskeys.value = err.data?.message || t('passkey.deleteFailed')
  } finally {
    deletingPasskeyId.value = null
  }
}

// Passkey Added Event Handler
const onPasskeyAdded = async () => {
  await fetchPasskeys()
}

// Initialize
onMounted(() => {
  fetch2FAStatus()
  fetchSessions()
  fetchPasskeys()
})
</script>
