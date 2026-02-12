<template>
  <div class="min-h-screen bg-[var(--color-background)] flex flex-col">
    <!-- Simple Header -->
    <header class="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div class="max-w-7xl mx-auto px-4 h-16 flex items-center">
        <NuxtLink to="/" class="flex items-center gap-2 text-[var(--color-text)] hover:opacity-80 transition-opacity">
          <span class="font-bold text-lg">{{ instanceName }}</span>
        </NuxtLink>
      </div>
    </header>

    <!-- Error Content -->
    <main class="flex-1 flex items-center justify-center px-4 py-12 pb-28">
      <div class="flex flex-col items-center text-center max-w-md">
        <!-- Error Icon -->
        <div
          class="w-24 h-24 mb-6 rounded-full flex items-center justify-center"
          :class="iconContainerClass"
        >
          <component :is="errorIcon" class="w-12 h-12" :class="iconClass" />
        </div>

        <!-- Status Code -->
        <div class="text-6xl font-bold text-[var(--color-text-muted)] mb-4">
          {{ error?.statusCode || 500 }}
        </div>

        <!-- Error Title -->
        <h1 class="text-2xl font-bold text-[var(--color-text)] mb-2">
          {{ errorTitle }}
        </h1>

        <!-- Error Description -->
        <p class="text-[var(--color-text-muted)] mb-8">
          {{ errorDescription }}
        </p>

        <!-- Action Buttons -->
        <div class="flex gap-3">
          <button
            @click="handleRetry"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <ArrowPathIcon class="w-4 h-4" />
            {{ $t('error.retry') }}
          </button>
          <button
            @click="handleGoHome"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 transition-opacity"
          >
            <HomeIcon class="w-4 h-4" />
            {{ $t('common.backToHome') }}
          </button>
        </div>
      </div>
    </main>

    <!-- Simple Footer -->
    <footer class="border-t border-[var(--color-border)] py-4">
      <div class="max-w-7xl mx-auto px-4 text-center text-sm text-[var(--color-text-muted)]">
        <NuxtLink to="/" class="hover:text-[var(--color-text)] transition-colors">
          {{ instanceName }}
        </NuxtLink>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import {
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  ServerStackIcon,
  HomeIcon,
  ArrowPathIcon,
} from '@heroicons/vue/24/outline'

const { t } = useI18n()
const runtimeConfig = useRuntimeConfig()

// Instance branding from runtime config
const instanceName = computed(() => runtimeConfig.public.instanceName || 'illo')

const props = defineProps<{
  error: {
    statusCode?: number
    message?: string
    stack?: string
    data?: any
  }
}>()

const statusCode = computed(() => props.error?.statusCode || 500)

const errorTitle = computed(() => {
  switch (statusCode.value) {
    case 404:
      return t('error.notFound')
    case 403:
      return t('error.forbidden')
    case 500:
    case 502:
    case 503:
      return t('error.serverError')
    default:
      return t('error.unknownError')
  }
})

const errorDescription = computed(() => {
  switch (statusCode.value) {
    case 404:
      return t('error.notFoundDesc')
    case 403:
      return t('error.forbiddenDesc')
    case 500:
    case 502:
    case 503:
      return t('error.serverErrorDesc')
    default:
      return t('error.unknownErrorDesc')
  }
})

const errorIcon = computed(() => {
  switch (statusCode.value) {
    case 404:
      return MagnifyingGlassIcon
    case 403:
      return LockClosedIcon
    case 500:
    case 502:
    case 503:
      return ServerStackIcon
    default:
      return ExclamationTriangleIcon
  }
})

const iconContainerClass = computed(() => {
  switch (statusCode.value) {
    case 404:
      return 'bg-[var(--color-surface-secondary)]'
    case 403:
      return 'bg-[var(--color-warning-bg)]'
    case 500:
    case 502:
    case 503:
      return 'bg-[var(--color-danger-bg)]'
    default:
      return 'bg-[var(--color-danger-bg)]'
  }
})

const iconClass = computed(() => {
  switch (statusCode.value) {
    case 404:
      return 'text-[var(--color-text-muted)]'
    case 403:
      return 'text-[var(--color-warning-text)]'
    case 500:
    case 502:
    case 503:
      return 'text-[var(--color-danger-text)]'
    default:
      return 'text-[var(--color-danger-text)]'
  }
})

const handleGoHome = () => {
  clearError({ redirect: '/' })
}

const handleRetry = () => {
  // クライアントサイドでのみ実行
  if (import.meta.client) {
    window.location.reload()
  }
}
</script>
