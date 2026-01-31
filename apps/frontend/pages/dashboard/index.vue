<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Page Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold mb-2">{{ $t('dashboard.title') }}</h1>
      <p class="text-[var(--color-text-muted)]">{{ $t('dashboard.subtitle') }}</p>
    </div>

    <!-- Tabs -->
    <div class="mb-6">
      <TabGroup
        v-model="selectedTab"
        type="underline"
        :tabs="tabItems"
        :animated="true"
      />
    </div>

    <!-- Tab Content -->
    <div>
      <!-- Artworks Tab -->
      <DashboardArtworks
        v-if="selectedTab === 'artworks'"
        ref="artworksRef"
      />

      <!-- Notifications Tab -->
      <DashboardNotifications
        v-else-if="selectedTab === 'notifications'"
        ref="notificationsRef"
      />

      <!-- Messages Tab -->
      <DashboardMessages
        v-else-if="selectedTab === 'messages'"
        ref="messagesRef"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { t } = useI18n()

// Tab items
const tabItems = computed(() => [
  { value: 'artworks', label: t('dashboard.tabs.artworks') },
  { value: 'notifications', label: t('dashboard.tabs.notifications') },
  { value: 'messages', label: t('dashboard.tabs.messages') },
])

// Initialize tab from query param (default: artworks)
const selectedTab = ref((route.query.tab as string) || 'artworks')

// Watch for route query changes
watch(() => route.query.tab, (newTab) => {
  if (newTab && typeof newTab === 'string') {
    selectedTab.value = newTab
  }
})

// Component refs for refresh
const artworksRef = ref<{ refresh: () => void } | null>(null)
const notificationsRef = ref<{ refresh: () => void } | null>(null)
const messagesRef = ref<{ refresh: () => void } | null>(null)
</script>
