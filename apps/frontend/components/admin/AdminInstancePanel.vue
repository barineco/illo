<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-[var(--color-danger-text)] mb-4">{{ error }}</p>
      <BaseButton
        variant="primary"
        size="md"
        shape="rounded"
        @click="fetchInstanceInfo"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Settings Content -->
    <div v-else class="space-y-6">
      <!-- Success Message -->
      <div v-if="successMessage" class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-4">
        <p class="text-[var(--color-success-text)]">{{ successMessage }}</p>
      </div>

      <!-- Error Message -->
      <div v-if="submitError" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-4">
        <p class="text-[var(--color-danger-text)]">{{ submitError }}</p>
      </div>

      <!-- Instance Information -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h2 class="text-xl font-bold mb-4">{{ $t('admin.instanceInfo') }}</h2>
        <div class="space-y-4">
          <!-- Instance Name -->
          <div>
            <label for="instanceName" class="block text-sm text-[var(--color-text-muted)] mb-1">
              {{ $t('admin.instanceName') }}
            </label>
            <div class="flex gap-3">
              <input
                id="instanceName"
                v-model="editForm.instanceName"
                type="text"
                class="flex-1 px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                :placeholder="$t('admin.instanceNamePlaceholder')"
              />
            </div>
          </div>

          <!-- Description -->
          <div>
            <label for="instanceDescription" class="block text-sm text-[var(--color-text-muted)] mb-1">
              {{ $t('admin.description') }}
            </label>
            <textarea
              id="instanceDescription"
              v-model="editForm.description"
              rows="3"
              class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              :placeholder="$t('admin.descriptionPlaceholder')"
            />
          </div>

          <!-- Save Button -->
          <div class="flex justify-end">
            <BaseButton
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="savingBranding || !hasUnsavedChanges"
              :loading="savingBranding"
              @click="saveBranding"
            >
              {{ $t('common.save') }}
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Instance Mode -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h2 class="text-xl font-bold mb-4">{{ $t('admin.instanceMode') }}</h2>

        <div class="space-y-4">
          <!-- Current Mode -->
          <div>
            <div class="text-sm text-[var(--color-text-muted)] mb-2">{{ $t('admin.currentMode') }}</div>
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info-border)]">
                {{ getModeLabel(instanceInfo?.instanceMode) }}
              </span>
            </div>
          </div>

          <!-- Federation Mode Notice (shown right after current mode) -->
          <div v-if="instanceInfo?.instanceMode !== 'PERSONAL'" class="bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-lg p-4">
            <p class="text-[var(--color-info-text)] text-sm">
              {{ $t('admin.federationModeNotice') }}
            </p>
          </div>

          <!-- Mode Description -->
          <div class="bg-[var(--color-surface-secondary)] rounded-lg p-4">
            <p class="text-sm text-[var(--color-text)] mb-3">
              <strong class="text-[var(--color-text)]">{{ getModeLabel(instanceInfo?.instanceMode) }}</strong>
            </p>
            <p class="text-sm text-[var(--color-text-muted)]">
              {{ getModeDescription(instanceInfo?.instanceMode) }}
            </p>
          </div>

          <!-- Registration Settings -->
          <div v-if="instanceInfo?.instanceMode === 'FEDERATION_ONLY'" class="space-y-4">
            <h3 class="text-md font-medium">{{ $t('admin.registrationSettings') }}</h3>

            <!-- Allow Registration Toggle -->
            <div class="flex items-center justify-between bg-[var(--color-background)] rounded-lg p-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium text-sm">{{ $t('admin.allowRegistration') }}</span>
                </div>
                <p class="text-xs text-[var(--color-text-muted)]">
                  {{ $t('admin.allowRegistrationDesc') }}
                </p>
              </div>
              <ToggleSwitch
                :model-value="instanceInfo?.allowRegistration ?? false"
                :disabled="updatingSettings"
                class="ml-4"
                @change="toggleAllowRegistration"
              />
            </div>

            <!-- Require Approval Toggle -->
            <div class="flex items-center justify-between bg-[var(--color-background)] rounded-lg p-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium text-sm">{{ $t('admin.requireApproval') }}</span>
                </div>
                <p class="text-xs text-[var(--color-text-muted)]">
                  {{ $t('admin.requireApprovalDesc') }}
                </p>
              </div>
              <ToggleSwitch
                :model-value="instanceInfo?.requireApproval ?? false"
                :disabled="updatingSettings"
                class="ml-4"
                @change="toggleRequireApproval"
              />
            </div>

          </div>

          <!-- SEO Settings (shown for all modes) -->
          <div class="space-y-4 mt-6 pt-6 border-t border-[var(--color-border)]">
            <h3 class="text-md font-medium">{{ $t('admin.seoSettings') }}</h3>

            <!-- Search Engine Indexing Toggle -->
            <div class="flex items-center justify-between bg-[var(--color-background)] rounded-lg p-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-medium text-sm">{{ $t('admin.allowSearchEngineIndexing') }}</span>
                </div>
                <p class="text-xs text-[var(--color-text-muted)]">
                  {{ $t('admin.allowSearchEngineIndexingDesc') }}
                </p>
              </div>
              <ToggleSwitch
                :model-value="instanceInfo?.allowSearchEngineIndexing ?? false"
                :disabled="updatingSettings"
                class="ml-4"
                @change="toggleSearchEngineIndexing"
              />
            </div>
          </div>

          <!-- Terms of Service Settings -->
          <div class="space-y-4 mt-6 pt-6 border-t border-[var(--color-border)]">
            <h3 class="text-md font-medium">{{ $t('admin.tosSettings.title') }}</h3>

            <div class="bg-[var(--color-background)] rounded-lg p-4 space-y-4">
              <!-- Info about file-based management -->
              <div class="text-sm text-[var(--color-text-muted)]">
                <p class="mb-2">{{ $t('admin.tosSettings.fileBasedInfo') }}</p>
                <ul class="list-disc list-inside space-y-1 text-xs">
                  <li><code class="bg-[var(--color-surface)] px-1 rounded">content/legal/tos-ja.md</code></li>
                  <li><code class="bg-[var(--color-surface)] px-1 rounded">content/legal/tos-en.md</code></li>
                  <li><code class="bg-[var(--color-surface)] px-1 rounded">content/legal/privacy-ja.md</code></li>
                  <li><code class="bg-[var(--color-surface)] px-1 rounded">content/legal/privacy-en.md</code></li>
                </ul>
              </div>

              <!-- Links to view pages -->
              <div class="flex gap-4">
                <NuxtLink
                  to="/tos"
                  target="_blank"
                  class="text-sm text-[var(--color-primary)] hover:underline"
                >
                  {{ $t('tos.viewTerms') }} →
                </NuxtLink>
                <NuxtLink
                  to="/privacy"
                  target="_blank"
                  class="text-sm text-[var(--color-primary)] hover:underline"
                >
                  {{ $t('tos.viewPrivacy') }} →
                </NuxtLink>
              </div>

              <!-- Current Version Display -->
              <div class="flex items-center justify-between bg-[var(--color-surface)] rounded-lg p-3">
                <div>
                  <span class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.tosSettings.currentVersion') }}:</span>
                  <span class="ml-2 font-medium">v{{ tosVersion }}</span>
                </div>
                <div v-if="tosUpdatedAt" class="text-xs text-[var(--color-text-muted)]">
                  {{ $t('admin.tosSettings.lastUpdated') }}: {{ formatDate(tosUpdatedAt) }}
                </div>
              </div>

              <!-- Increment Version Button -->
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm">{{ $t('admin.tosSettings.incrementVersion') }}</p>
                  <p class="text-xs text-[var(--color-text-muted)]">
                    {{ $t('admin.tosSettings.incrementVersionDesc') }}
                  </p>
                </div>
                <BaseButton
                  variant="secondary"
                  size="sm"
                  shape="rounded"
                  :disabled="savingTos"
                  :loading="savingTos"
                  @click="incrementTosVersion"
                >
                  {{ $t('admin.tosSettings.incrementVersionButton') }}
                </BaseButton>
              </div>
            </div>
          </div>

          <!-- Mode Change Section -->
          <div v-if="instanceInfo?.instanceMode === 'PERSONAL'" class="mt-6 pt-6 border-t border-[var(--color-border)]">
            <h3 class="text-lg font-medium mb-3">{{ $t('admin.modeChange') }}</h3>
            <div class="bg-[var(--color-warning-bg)] border border-[var(--color-warning-text)] rounded-lg p-4 mb-4">
              <p class="text-[var(--color-warning-text)] text-sm font-medium mb-2 flex items-center gap-2">
                <Icon name="ExclamationTriangle" class="w-5 h-5" /> {{ $t('admin.importantNotes') }}
              </p>
              <ul class="text-sm text-[var(--color-warning-text)] space-y-1 list-disc list-inside">
                <li v-html="$t('admin.modeChangeWarning1')"></li>
                <li>{{ $t('admin.modeChangeWarning2') }}</li>
                <li>{{ $t('admin.modeChangeWarning3') }}</li>
                <li>{{ $t('admin.modeChangeWarning4') }}</li>
              </ul>
            </div>

            <div class="flex items-center gap-4">
              <BaseButton
                variant="primary"
                size="lg"
                shape="rounded"
                :disabled="isChangingMode"
                @click="showConfirmDialog = true"
              >
                {{ $t('admin.changeToFederation') }}
              </BaseButton>
            </div>
          </div>

        </div>
      </div>

      <!-- Confirmation Dialog -->
      <Teleport to="body">
        <div
          v-if="showConfirmDialog"
          class="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50 p-4"
          @click.self="showConfirmDialog = false"
        >
          <div class="bg-[var(--color-surface)] rounded-lg p-6 max-w-md w-full">
            <h3 class="text-xl font-bold mb-4">{{ $t('admin.modeChangeConfirm') }}</h3>

            <!-- Success Message in Modal -->
            <div v-if="modalSuccessMessage" class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-4 mb-4">
              <p class="text-[var(--color-success-text)]">{{ modalSuccessMessage }}</p>
            </div>

            <!-- Error Message in Modal -->
            <div v-if="modalErrorMessage" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-4 mb-4">
              <p class="text-[var(--color-danger-text)]">{{ modalErrorMessage }}</p>
            </div>

            <p v-if="!modalSuccessMessage" class="text-[var(--color-text)] mb-6" v-html="$t('admin.modeChangeConfirmMessage')">
            </p>
            <div v-if="!modalSuccessMessage" class="flex gap-3 justify-end">
              <BaseButton
                variant="secondary"
                size="md"
                shape="rounded"
                @click="showConfirmDialog = false"
              >
                {{ $t('common.cancel') }}
              </BaseButton>
              <BaseButton
                variant="primary"
                size="md"
                shape="rounded"
                :disabled="isChangingMode"
                :loading="isChangingMode"
                @click="handleModeChange"
              >
                {{ $t('admin.confirmChange') }}
              </BaseButton>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()

// State
const loading = ref(true)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const submitError = ref<string | null>(null)
const isChangingMode = ref(false)
const showConfirmDialog = ref(false)
const modalSuccessMessage = ref<string | null>(null)
const modalErrorMessage = ref<string | null>(null)
const updatingSettings = ref(false)

// ToS Settings State
const tosVersion = ref(1)
const tosUpdatedAt = ref<string | null>(null)
const savingTos = ref(false)

// Branding Edit State
const savingBranding = ref(false)
const editForm = ref({
  instanceName: '',
  description: '',
})

interface InstanceInfo {
  instanceName: string
  instanceMode: string
  description?: string
  allowRegistration: boolean
  requireApproval: boolean
  allowSearchEngineIndexing: boolean
}

const instanceInfo = ref<InstanceInfo | null>(null)

const hasUnsavedChanges = computed(() => {
  if (!instanceInfo.value) return false
  return (
    editForm.value.instanceName !== instanceInfo.value.instanceName ||
    editForm.value.description !== (instanceInfo.value.description || '')
  )
})

const fetchInstanceInfo = async () => {
  try {
    loading.value = true
    error.value = null

    const data = await api.get<{ instanceInfo: InstanceInfo }>('/api/setup/status')
    instanceInfo.value = data.instanceInfo

    if (data.instanceInfo) {
      editForm.value.instanceName = data.instanceInfo.instanceName
      editForm.value.description = data.instanceInfo.description || ''
    }
  } catch (e: any) {
    console.error('Failed to fetch instance info:', e)
    error.value = e.message || t('admin.fetchInstanceInfoFailed')
  } finally {
    loading.value = false
  }
}

const saveBranding = async () => {
  if (!hasUnsavedChanges.value) return

  try {
    savingBranding.value = true

    const data = await api.patch<{
      instanceName: string
      description: string | null
    }>('/api/setup/branding', {
      instanceName: editForm.value.instanceName,
      description: editForm.value.description,
    })

    if (instanceInfo.value) {
      instanceInfo.value.instanceName = data.instanceName
      instanceInfo.value.description = data.description || undefined
    }

    successMessage.value = t('admin.brandingSaved')
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (e: any) {
    console.error('Failed to save branding:', e)
    submitError.value = e.message || t('admin.settingsChangeFailed')
    setTimeout(() => {
      submitError.value = null
    }, 5000)
  } finally {
    savingBranding.value = false
  }
}

const getModeLabel = (mode?: string) => {
  switch (mode) {
    case 'PERSONAL':
      return t('admin.modePersonal')
    case 'FEDERATION_ONLY':
      return t('admin.modeFederation')
    case 'FULL_FEDIVERSE':
      return t('admin.modeFullFediverse')
    default:
      return t('admin.modeUnknown')
  }
}

const getModeDescription = (mode?: string) => {
  switch (mode) {
    case 'PERSONAL':
      return t('admin.modePersonalDesc')
    case 'FEDERATION_ONLY':
      return t('admin.modeFederationDesc')
    case 'FULL_FEDIVERSE':
      return t('admin.modeFullFediverseDesc')
    default:
      return ''
  }
}

const handleModeChange = async () => {
  try {
    isChangingMode.value = true
    modalErrorMessage.value = null
    modalSuccessMessage.value = null

    await api.patch('/api/setup/mode', {
      instanceMode: 'FEDERATION_ONLY',
    })

    modalSuccessMessage.value = t('admin.modeChangeSuccessReloading')

    setTimeout(async () => {
      await fetchInstanceInfo()

      showConfirmDialog.value = false
      modalSuccessMessage.value = null

      successMessage.value = t('admin.modeChangeComplete')

      setTimeout(() => {
        successMessage.value = null
      }, 5000)
    }, 2000)
  } catch (e: any) {
    console.error('Failed to change mode:', e)
    modalErrorMessage.value = e.message || t('admin.modeChangeFailed')
  } finally {
    isChangingMode.value = false
  }
}

const toggleAllowRegistration = async () => {
  try {
    updatingSettings.value = true
    const newValue = !instanceInfo.value?.allowRegistration

    await api.patch('/api/setup/registration', {
      allowRegistration: newValue,
    })

    if (instanceInfo.value) {
      instanceInfo.value.allowRegistration = newValue
    }

    successMessage.value = newValue ? t('admin.registrationAllowed') : t('admin.registrationDisallowed')
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (e: any) {
    console.error('Failed to toggle allow registration:', e)
    submitError.value = e.message || t('admin.settingsChangeFailed')
    setTimeout(() => {
      submitError.value = null
    }, 5000)
  } finally {
    updatingSettings.value = false
  }
}

const toggleRequireApproval = async () => {
  try {
    updatingSettings.value = true
    const newValue = !instanceInfo.value?.requireApproval

    await api.patch('/api/setup/registration', {
      requireApproval: newValue,
    })

    if (instanceInfo.value) {
      instanceInfo.value.requireApproval = newValue
    }

    successMessage.value = newValue ? t('admin.approvalEnabled') : t('admin.approvalDisabled')
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (e: any) {
    console.error('Failed to toggle require approval:', e)
    submitError.value = e.message || t('admin.settingsChangeFailed')
    setTimeout(() => {
      submitError.value = null
    }, 5000)
  } finally {
    updatingSettings.value = false
  }
}

const toggleSearchEngineIndexing = async () => {
  try {
    updatingSettings.value = true
    const newValue = !instanceInfo.value?.allowSearchEngineIndexing

    await api.patch('/api/setup/seo', {
      allowSearchEngineIndexing: newValue,
    })

    if (instanceInfo.value) {
      instanceInfo.value.allowSearchEngineIndexing = newValue
    }

    successMessage.value = newValue ? t('admin.searchEngineIndexingEnabled') : t('admin.searchEngineIndexingDisabled')
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (e: any) {
    console.error('Failed to toggle search engine indexing:', e)
    submitError.value = e.message || t('admin.settingsChangeFailed')
    setTimeout(() => {
      submitError.value = null
    }, 5000)
  } finally {
    updatingSettings.value = false
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const fetchTosSettings = async () => {
  try {
    const data = await api.get<{
      tosVersion: number
      tosUpdatedAt: string | null
    }>('/api/tos')

    tosVersion.value = data.tosVersion || 1
    tosUpdatedAt.value = data.tosUpdatedAt
  } catch (e) {
    console.error('Failed to fetch ToS settings:', e)
  }
}

const incrementTosVersion = async () => {
  try {
    savingTos.value = true

    const data = await api.post<{
      tosVersion: number
      tosUpdatedAt: string | null
    }>('/api/tos/increment-version')

    tosVersion.value = data.tosVersion
    tosUpdatedAt.value = data.tosUpdatedAt

    successMessage.value = t('admin.tosSettings.versionIncremented')
    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (e: any) {
    console.error('Failed to increment ToS version:', e)
    submitError.value = e.message || t('admin.tosSettings.saveFailed')
    setTimeout(() => {
      submitError.value = null
    }, 5000)
  } finally {
    savingTos.value = false
  }
}

onMounted(() => {
  fetchInstanceInfo()
  fetchTosSettings()
})
</script>
