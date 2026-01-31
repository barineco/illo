<template>
  <div class="min-h-screen bg-[var(--color-background)] flex items-center justify-center px-4">
    <div class="max-w-2xl w-full">
      <!-- Header -->
      <div class="text-center mb-8">
        <Icon name="ExclamationTriangle" class="w-16 h-16 text-[var(--color-warning-text)] mx-auto mb-4" />
        <h1 class="text-4xl font-bold text-[var(--color-text)] mb-2">{{ $t('error.backendUnavailable') }}</h1>
        <p class="text-[var(--color-text-muted)]">{{ $t('error.checkBackendRunning') }}</p>
      </div>

      <!-- Error Details -->
      <div class="bg-[var(--color-surface)] rounded-lg p-8 shadow-xl">
        <div class="space-y-6">
          <!-- Connection Status -->
          <div class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-4">
            <h2 class="font-medium text-[var(--color-danger-text)] mb-2">{{ $t('error.connectionStatus') }}</h2>
            <p class="text-sm text-[var(--color-danger-text)]">
              {{ $t('error.connectionFailed', { url: apiBase }) }}
            </p>
          </div>

          <!-- Instructions -->
          <div>
            <h2 class="font-medium text-[var(--color-text)] mb-3">{{ $t('error.howToFix') }}</h2>
            <ol class="space-y-3 text-[var(--color-text-secondary)]">
              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-text)] text-sm flex items-center justify-center">1</span>
                <div>
                  <div class="font-medium mb-1">{{ $t('error.step1Title') }}</div>
                  <code class="text-sm bg-[var(--color-background)] px-2 py-1 rounded text-[var(--color-text-muted)] block mt-1">
                    cd apps/backend && pnpm dev
                  </code>
                </div>
              </li>
              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-text)] text-sm flex items-center justify-center">2</span>
                <div>
                  <div class="font-medium mb-1">{{ $t('error.step2Title') }}</div>
                  <code class="text-sm bg-[var(--color-background)] px-2 py-1 rounded text-[var(--color-text-muted)] block mt-1">
                    pnpm docker:up
                  </code>
                </div>
              </li>
              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-text)] text-sm flex items-center justify-center">3</span>
                <div>
                  <div class="font-medium mb-1">{{ $t('error.step3Title') }}</div>
                  <p class="text-sm text-[var(--color-text-muted)] mt-1">
                    {{ $t('error.step3Desc') }}
                  </p>
                </div>
              </li>
            </ol>
          </div>

          <!-- Retry Button -->
          <div class="pt-4">
            <button
              @click="retry"
              :disabled="retrying"
              class="w-full py-3 px-6 bg-[var(--color-primary)] text-[var(--color-primary-text)] font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ retrying ? $t('error.retrying') : $t('error.tryAgain') }}
            </button>
          </div>

          <!-- Manual Override (Development) -->
          <div v-if="showDevLink" class="pt-4 border-t border-[var(--color-border)]">
            <p class="text-xs text-[var(--color-text-muted)] text-center">
              {{ $t('error.forDevelopers') }} <NuxtLink to="/setup" class="text-[var(--color-primary)] hover:underline">{{ $t('error.goToSetup') }}</NuxtLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const retrying = ref(false)
const showDevLink = ref(process.env.NODE_ENV === 'development')

const retry = async () => {
  retrying.value = true

  try {
    // Try to connect to backend
    const response = await $fetch<{ isSetupComplete: boolean }>(
      `${apiBase}/api/setup/status`,
      { retry: 0 }
    )

    // If successful, redirect to home or setup
    if (response.isSetupComplete) {
      window.location.href = '/'
    } else {
      window.location.href = '/setup'
    }
  } catch (error) {
    console.error('Still cannot connect to backend:', error)
    // Show error feedback
    alert(t('error.stillCannotConnect'))
  } finally {
    retrying.value = false
  }
}
</script>
