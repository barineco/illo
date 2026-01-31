<template>
  <div class="max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold mb-8">{{ $t('nav.admin') }}</h1>

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
      <AdminInstancePanel v-if="selectedTab === 'instance'" />
      <AdminUserPanel v-else-if="selectedTab === 'users'" />
      <AdminReportPanel v-else-if="selectedTab === 'reports'" />
      <AdminActivityDeliveryPanel v-else-if="selectedTab === 'deliveries'" />
      <AdminRateLimitPanel v-else-if="selectedTab === 'rateLimit'" />
      <AdminImageCachePanel v-else-if="selectedTab === 'imageCache'" />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const { t } = useI18n()
const { user } = useAuth()
const router = useRouter()

// Redirect non-admin users
onMounted(() => {
  if (user.value?.role !== 'ADMIN') {
    router.push('/')
  }
})

// Watch for user changes
watch(
  () => user.value?.role,
  (role) => {
    if (role !== 'ADMIN') {
      router.push('/')
    }
  }
)

interface Tab {
  key: string
  labelKey: string
}

const tabs: Tab[] = [
  { key: 'instance', labelKey: 'admin.instanceSettings' },
  { key: 'users', labelKey: 'admin.userManagement' },
  { key: 'reports', labelKey: 'admin.reports' },
  { key: 'deliveries', labelKey: 'admin.activityDeliveries' },
  { key: 'rateLimit', labelKey: 'admin.rateLimit.title' },
  { key: 'imageCache', labelKey: 'admin.imageCache.title' },
]

// TabGroup用のタブアイテム
const tabItems = computed(() => {
  return tabs.map(tab => ({
    value: tab.key,
    label: t(tab.labelKey),
  }))
})

const selectedTab = ref('instance')
</script>
