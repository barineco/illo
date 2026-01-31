<template>
  <div class="max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">{{ $t('settings.title') }}</h1>

    <!-- Tabs -->
    <div class="mb-8">
      <TabGroup
        v-model="selectedTab"
        type="underline"
        :tabs="tabItems"
        :animated="true"
      />
    </div>

    <!-- Tab Content -->
    <div>
      <SettingsProfile v-if="selectedTab === 'profile'" />
      <SettingsAccount v-else-if="selectedTab === 'account'" />
      <SettingsModeration v-else-if="selectedTab === 'moderation'" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const { t } = useI18n()

interface Tab {
  key: string
  labelKey: string
}

const tabs: Tab[] = [
  { key: 'profile', labelKey: 'settings.profile' },
  { key: 'account', labelKey: 'settings.accountTab' },
  { key: 'moderation', labelKey: 'settings.moderationTab' },
]

const availableTabs = computed(() => tabs)

// TabGroup用のタブアイテム
const tabItems = computed(() => {
  return availableTabs.value.map(tab => ({
    value: tab.key,
    label: t(tab.labelKey),
  }))
})

const selectedTab = ref('profile')
</script>
