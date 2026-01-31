<template>
  <div class="callback-page">
    <div class="callback-container">
      <div v-if="error" class="error-state">
        <ExclamationCircleIcon class="error-icon" />
        <h1 class="error-title">{{ $t('auth.bluesky.authFailed') }}</h1>
        <p class="error-message">{{ error }}</p>
        <NuxtLink to="/login" class="btn-link">
          {{ $t('auth.backToLogin') }}
        </NuxtLink>
      </div>
      <div v-else class="loading-state">
        <div class="spinner"></div>
        <p class="loading-text">{{ $t('auth.bluesky.completing') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExclamationCircleIcon } from '@heroicons/vue/24/outline'

definePageMeta({
  layout: false,
  // Note: No middleware - this page handles OAuth callback which sets tokens
})

const route = useRoute()
const router = useRouter()
const { setToken, fetchUserWithToken } = useAuth()
const { t } = useI18n()

const error = ref('')

onMounted(async () => {
  const accessToken = route.query.access_token as string
  const action = route.query.action as string
  const errorParam = route.query.error as string
  const errorMessage = route.query.message as string

  if (errorParam) {
    error.value = errorMessage || t('auth.bluesky.authFailed')
    return
  }

  if (!accessToken) {
    error.value = t('auth.bluesky.noToken')
    return
  }

  try {
    // Store the access token in cookie
    setToken(accessToken)

    // Fetch user data with explicit token (cookie might not be set yet)
    await fetchUserWithToken(accessToken)

    // Redirect based on action
    if (action === 'register') {
      // New user registration
      router.replace('/?welcome=true')
    } else {
      // Existing user login
      router.replace('/')
    }
  } catch (err: any) {
    error.value = err.message || t('auth.bluesky.authFailed')
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
  border-top-color: var(--color-primary);
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

.error-state {
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

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.error-message {
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
