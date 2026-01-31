<template>
  <div class="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4">
    <!-- Loading state while checking setup status -->
    <div v-if="checking" class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
      <p class="text-[var(--color-text-muted)]">{{ $t('setup.checkingStatus') }}</p>
    </div>

    <div v-else class="max-w-2xl w-full">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-[var(--color-text)] mb-2">{{ $t('setup.welcomeTitle') }}</h1>
        <p class="text-[var(--color-text-muted)]">{{ $t('setup.welcomeSubtitle') }}</p>
      </div>

      <!-- Setup Form -->
      <div class="bg-[var(--color-surface)] rounded-lg p-8 shadow-xl">
        <form @submit.prevent="handleSubmit">
          <!-- Instance Name -->
          <div class="mb-6">
            <label for="instanceName" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {{ $t('setup.instanceName') }}
            </label>
            <input
              id="instanceName"
              v-model="form.instanceName"
              type="text"
              required
              class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              :placeholder="$t('setup.instanceNamePlaceholder')"
            />
          </div>

          <!-- Instance Mode -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {{ $t('setup.instanceMode') }}
            </label>
            <div class="space-y-3">
              <label class="flex items-start p-4 bg-[var(--color-background)] border-2 rounded-lg cursor-pointer transition" :class="form.instanceMode === 'PERSONAL' ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'">
                <input
                  v-model="form.instanceMode"
                  type="radio"
                  value="PERSONAL"
                  class="mt-1 mr-3"
                />
                <div>
                  <div class="font-medium text-[var(--color-text)]">{{ $t('setup.modePersonal') }}</div>
                  <div class="text-sm text-[var(--color-text-muted)]">{{ $t('setup.modePersonalDesc') }}</div>
                </div>
              </label>
              <label class="flex items-start p-4 bg-[var(--color-background)] border-2 rounded-lg cursor-pointer transition" :class="form.instanceMode === 'FEDERATION_ONLY' ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'">
                <input
                  v-model="form.instanceMode"
                  type="radio"
                  value="FEDERATION_ONLY"
                  class="mt-1 mr-3"
                />
                <div>
                  <div class="font-medium text-[var(--color-text)]">{{ $t('setup.modeFederation') }}</div>
                  <div class="text-sm text-[var(--color-text-muted)]">{{ $t('setup.modeFederationDesc') }}</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Public URL -->
          <div class="mb-6">
            <label for="publicUrl" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {{ $t('setup.publicUrl') }}
            </label>
            <input
              id="publicUrl"
              v-model="form.publicUrl"
              type="url"
              required
              class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="https://example.com"
            />
            <p class="mt-2 text-sm text-[var(--color-text-muted)]">
              {{ $t('setup.publicUrlHint') }}
            </p>
          </div>

          <!-- Description -->
          <div class="mb-6">
            <label for="description" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {{ $t('setup.description') }}
            </label>
            <textarea
              id="description"
              v-model="form.description"
              rows="3"
              class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              :placeholder="$t('setup.descriptionPlaceholder')"
            ></textarea>
          </div>

          <!-- Admin Account -->
          <div class="border-t border-[var(--color-border)] pt-6 mb-6">
            <h3 class="text-lg font-medium text-[var(--color-text)] mb-4">{{ $t('setup.adminAccount') }}</h3>

            <div class="mb-4">
              <label for="adminUsername" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {{ $t('setup.username') }}
              </label>
              <input
                id="adminUsername"
                v-model="form.adminUsername"
                type="text"
                required
                class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="admin"
              />
            </div>

            <div class="mb-4">
              <label for="adminEmail" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {{ $t('setup.email') }}
              </label>
              <input
                id="adminEmail"
                v-model="form.adminEmail"
                type="email"
                required
                class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="admin@example.com"
              />
            </div>

            <div class="mb-4">
              <label for="adminDisplayName" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {{ $t('setup.displayName') }}
              </label>
              <input
                id="adminDisplayName"
                v-model="form.adminDisplayName"
                type="text"
                class="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                :placeholder="$t('setup.displayNamePlaceholder')"
              />
            </div>

            <div class="mb-4">
              <label for="adminPassword" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {{ $t('setup.password') }}
              </label>
              <div class="relative">
                <input
                  id="adminPassword"
                  v-model="form.adminPassword"
                  :type="showPassword ? 'text' : 'password'"
                  required
                  minlength="8"
                  class="w-full px-4 py-3 pr-12 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  :placeholder="$t('setup.passwordPlaceholder')"
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

            <div class="mb-4">
              <label for="adminPasswordConfirm" class="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {{ $t('setup.passwordConfirm') }}
              </label>
              <div class="relative">
                <input
                  id="adminPasswordConfirm"
                  v-model="adminPasswordConfirm"
                  :type="showPasswordConfirm ? 'text' : 'password'"
                  required
                  minlength="8"
                  class="w-full px-4 py-3 pr-12 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  :placeholder="$t('setup.passwordConfirmPlaceholder')"
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
              <div v-if="adminPasswordConfirm && form.adminPassword !== adminPasswordConfirm" class="flex items-center gap-1.5 text-[var(--color-danger-text)] text-xs mt-1">
                <ExclamationTriangleIcon class="w-4 h-4 flex-shrink-0" />
                {{ $t('auth.passwordMismatch') }}
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="mb-6 p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg">
            <p class="text-[var(--color-danger-text)] text-sm">{{ error }}</p>
          </div>

          <!-- Success Message -->
          <div v-if="success" class="mb-6 p-4 bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg">
            <p class="text-[var(--color-success-text)] text-sm">{{ $t('setup.successMessage') }}</p>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading || success"
            class="w-full py-3 px-6 bg-[var(--color-primary)] text-[var(--color-primary-text)] font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? $t('setup.settingUp') : $t('setup.completeSetup') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import type { InitialSetupDto, InstanceMode } from '@open-illustboard/shared'

const { t } = useI18n()
const { isCapsLockOn, handleKeyEvent, resetCapsLock } = useCapsLock()

const showPassword = ref(false)
const showPasswordConfirm = ref(false)
const adminPasswordConfirm = ref('')

// Get default public URL from environment or browser location
const getDefaultPublicUrl = () => {
  if (import.meta.client) {
    // Client-side: use window.location
    const { protocol, hostname, port } = window.location
    const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : ''
    return `${protocol}//${hostname}${portSuffix}`
  }
  // Server-side: will be set on client mount
  return ''
}

const form = ref<InitialSetupDto>({
  instanceName: '',
  instanceMode: 'PERSONAL' as InstanceMode,
  publicUrl: getDefaultPublicUrl(),
  adminUsername: '',
  adminEmail: '',
  adminPassword: '',
  adminDisplayName: '',
  description: '',
})

const loading = ref(false)
const error = ref('')
const success = ref(false)
const checking = ref(true)

interface SetupStatusResponse {
  isSetupComplete: boolean
  defaults?: {
    instanceName: string
    instanceTagline: string
  }
}

// Check setup status on mount
onMounted(async () => {
  // Set publicUrl if not already set (SSR case)
  if (!form.value.publicUrl) {
    form.value.publicUrl = getDefaultPublicUrl()
  }

  try {
    const config = useRuntimeConfig()
    const response = await $fetch<SetupStatusResponse>(`${config.public.apiBase}/api/setup/status`)

    if (response.isSetupComplete) {
      // Already setup, redirect to home
      await navigateTo('/')
      return
    }

    // Use default values from environment variables if available
    if (response.defaults) {
      if (response.defaults.instanceName && !form.value.instanceName) {
        form.value.instanceName = response.defaults.instanceName
      }
    }
  } catch (err) {
    console.error('Failed to check setup status:', err)
    // Continue to show setup page on error
  } finally {
    checking.value = false
  }
})

const handleSubmit = async () => {
  error.value = ''

  // Validate password confirmation
  if (form.value.adminPassword !== adminPasswordConfirm.value) {
    error.value = t('auth.passwordMismatch')
    return
  }

  loading.value = true

  try {
    const config = useRuntimeConfig()
    const response = await fetch(`${config.public.apiBase}/api/setup/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form.value),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.message || t('setup.setupFailed'))
    }

    success.value = true

    // Redirect to login page after 2 seconds
    setTimeout(() => {
      window.location.href = '/login'
    }, 2000)
  } catch (err: any) {
    error.value = err.message || t('setup.setupFailed')
  } finally {
    loading.value = false
  }
}
</script>
