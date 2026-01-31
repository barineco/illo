<template>
  <div class="callback-page">
    <div class="callback-container">
      <div v-if="error" class="error-state">
        <ExclamationCircleIcon class="error-icon" />
        <h1 class="error-title">{{ $t('patreon.linkFailed') }}</h1>
        <p class="error-message">{{ error }}</p>
        <NuxtLink to="/settings" class="btn-link">
          {{ $t('common.back') }}
        </NuxtLink>
      </div>
      <div v-else-if="success" class="success-state">
        <CheckCircleIcon class="success-icon" />
        <h1 class="success-title">{{ $t('patreon.linkSuccess') }}</h1>
        <p class="success-message">{{ $t('patreon.description') }}</p>
        <NuxtLink to="/settings" class="btn-link">
          {{ $t('common.back') }}
        </NuxtLink>
      </div>
      <div v-else class="loading-state">
        <div class="spinner"></div>
        <p class="loading-text">{{ $t('patreon.linking') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'

definePageMeta({
  layout: false,
  middleware: 'auth',
})

const route = useRoute()
const { t } = useI18n()
const api = useApi()
const { getAccessToken } = useAuth()

const error = ref('')
const success = ref(false)

onMounted(async () => {
  const code = route.query.code as string
  const errorParam = route.query.error as string

  if (errorParam) {
    error.value = route.query.error_description as string || t('patreon.linkFailed')
    return
  }

  if (!code) {
    error.value = t('patreon.linkFailed')
    return
  }

  try {
    const token = getAccessToken()

    const response = await fetch(`${api.baseURL}/api/patreon/callback?code=${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || t('patreon.linkFailed'))
    }

    success.value = true
  } catch (err: any) {
    error.value = err.message || t('patreon.linkFailed')
  }
})
</script>

<style scoped>
.callback-page {
  min-height: 100vh;
  background: var(--color-background);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.callback-container {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 2.5rem;
  text-align: center;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.spinner {
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--color-border);
  border-top-color: #FF424D;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.error-state,
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.error-icon {
  width: 3rem;
  height: 3rem;
  color: var(--color-danger-text);
}

.success-icon {
  width: 3rem;
  height: 3rem;
  color: var(--color-success-text);
}

.error-title,
.success-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.error-message,
.success-message {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.btn-link {
  display: inline-block;
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: var(--color-primary-text);
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-link:hover {
  background: var(--color-primary-hover);
}
</style>
