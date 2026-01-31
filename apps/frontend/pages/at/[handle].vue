<template>
  <div class="min-h-screen flex items-center justify-center">
    <div v-if="loading" class="text-center">
      <p class="text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>
    <div v-else-if="error" class="text-center">
      <Icon name="ExclamationTriangle" class="w-16 h-16 text-[var(--color-text-muted)] mx-auto mb-4" />
      <h1 class="text-2xl font-bold mb-2">{{ $t('user.userNotFound') }}</h1>
      <p class="text-[var(--color-text-muted)] mb-4">{{ error }}</p>
      <BaseButton variant="primary" @click="navigateTo('/')">
        {{ $t('home.goToHome') }}
      </BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()

const loading = ref(true)
const error = ref<string | null>(null)

definePageMeta({
  layout: 'default',
  ssr: false,
})

onMounted(async () => {
  try {
    const handle = route.params.handle as string

    // Fetch user by Bluesky handle
    const baseURL = config.public.apiBase || ''
    const response = await fetch(`${baseURL}/api/users/by-bluesky/${encodeURIComponent(handle)}`, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        error.value = t('user.userNotFoundDesc')
      } else {
        error.value = `Failed to lookup Bluesky handle: ${response.status}`
      }
      return
    }

    const userData = await response.json()

    // Redirect to user profile
    await navigateTo(`/users/${userData.username}`, { replace: true })
  } catch (e: any) {
    console.error('Failed to lookup Bluesky handle:', e)
    error.value = e.message || t('user.userNotFoundDesc')
  } finally {
    loading.value = false
  }
})
</script>
