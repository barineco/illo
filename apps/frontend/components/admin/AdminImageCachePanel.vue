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
        @click="fetchData"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Content -->
    <div v-else class="space-y-6">
      <!-- Sub-tabs -->
      <div class="border-b border-[var(--color-border)]">
        <nav class="-mb-px flex space-x-4">
          <button
            v-for="tab in subTabs"
            :key="tab.key"
            :class="[
              'py-2 px-4 text-sm font-medium border-b-2 transition-colors',
              activeSubTab === tab.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            ]"
            @click="activeSubTab = tab.key"
          >
            {{ $t(tab.labelKey) }}
          </button>
        </nav>
      </div>

      <!-- Stats Overview -->
      <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.imageCache.totalImages') }}</div>
          <div class="text-2xl font-bold">{{ stats.totalCachedImages }}</div>
        </div>
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.imageCache.totalSize') }}</div>
          <div class="text-2xl font-bold">{{ formatBytes(stats.totalCachedSize) }}</div>
        </div>
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.imageCache.totalAvatars') }}</div>
          <div class="text-2xl font-bold">{{ stats.totalCachedAvatars }}</div>
        </div>
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.imageCache.expired') }}</div>
          <div class="text-2xl font-bold text-[var(--color-warning-text)]">{{ stats.expiredCount }}</div>
        </div>
      </div>

      <!-- Config Panel -->
      <div v-if="activeSubTab === 'config'" class="bg-[var(--color-surface)] rounded-lg p-6">
        <h2 class="text-xl font-bold mb-6">{{ $t('admin.imageCache.configTitle') }}</h2>

        <!-- Basic Settings -->
        <div class="space-y-6">
          <!-- Enabled Toggle -->
          <div class="flex items-center justify-between p-4 bg-[var(--color-background)] rounded-lg">
            <div>
              <div class="font-medium">{{ $t('admin.imageCache.enabled') }}</div>
              <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.imageCache.enabledDesc') }}</div>
            </div>
            <ToggleSwitch
              v-model="settings.remoteImageCacheEnabled"
              @change="updateSettings"
            />
          </div>

          <!-- Auto Cache Toggle -->
          <div class="flex items-center justify-between p-4 bg-[var(--color-background)] rounded-lg">
            <div>
              <div class="font-medium">{{ $t('admin.imageCache.autoCache') }}</div>
              <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.imageCache.autoCacheDesc') }}</div>
            </div>
            <ToggleSwitch
              v-model="settings.remoteImageAutoCache"
              @change="updateSettings"
            />
          </div>

          <!-- TTL Setting -->
          <div class="p-4 bg-[var(--color-background)] rounded-lg">
            <label class="block font-medium mb-2">{{ $t('admin.imageCache.ttlDays') }}</label>
            <div class="text-sm text-[var(--color-text-muted)] mb-2">{{ $t('admin.imageCache.ttlDaysDesc') }}</div>
            <input
              v-model.number="settings.remoteImageCacheTtlDays"
              type="number"
              min="1"
              max="365"
              class="w-32 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg"
              @change="updateSettings"
            />
          </div>
        </div>

        <!-- Priority Settings -->
        <div class="mt-8">
          <h3 class="text-lg font-bold mb-4">{{ $t('admin.imageCache.priorityTitle') }}</h3>

          <!-- Priority Enabled -->
          <div class="flex items-center justify-between p-4 bg-[var(--color-background)] rounded-lg mb-4">
            <div>
              <div class="font-medium">{{ $t('admin.imageCache.priorityEnabled') }}</div>
              <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.imageCache.priorityEnabledDesc') }}</div>
            </div>
            <ToggleSwitch
              v-model="settings.cachePriorityEnabled"
              @change="updateSettings"
            />
          </div>

          <div v-if="settings.cachePriorityEnabled" class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Priority Threshold -->
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium mb-1">{{ $t('admin.imageCache.priorityThreshold') }}</label>
                <div class="text-xs text-[var(--color-text-muted)] mb-2">{{ $t('admin.imageCache.priorityThresholdDesc') }}</div>
                <input
                  v-model.number="settings.cachePriorityThreshold"
                  type="number"
                  min="1"
                  class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                  @change="updateSettings"
                />
              </div>
            </div>

            <!-- Tier Settings -->
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">{{ $t('admin.imageCache.likeTier1') }}</label>
                  <input
                    v-model.number="settings.cacheLikeTier1"
                    type="number"
                    min="1"
                    class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                    @change="updateSettings"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">{{ $t('admin.imageCache.multiplierTier1') }}</label>
                  <input
                    v-model.number="settings.cacheTtlMultiplierTier1"
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                    @change="updateSettings"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">{{ $t('admin.imageCache.likeTier2') }}</label>
                  <input
                    v-model.number="settings.cacheLikeTier2"
                    type="number"
                    min="1"
                    class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                    @change="updateSettings"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">{{ $t('admin.imageCache.multiplierTier2') }}</label>
                  <input
                    v-model.number="settings.cacheTtlMultiplierTier2"
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                    @change="updateSettings"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">{{ $t('admin.imageCache.likeTier3') }}</label>
                  <input
                    v-model.number="settings.cacheLikeTier3"
                    type="number"
                    min="1"
                    class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                    @change="updateSettings"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">{{ $t('admin.imageCache.multiplierTier3') }}</label>
                  <input
                    v-model.number="settings.cacheTtlMultiplierTier3"
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                    @change="updateSettings"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Instances Panel -->
      <div v-if="activeSubTab === 'instances'" class="bg-[var(--color-surface)] rounded-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold">{{ $t('admin.imageCache.instancesTitle') }}</h2>
          <BaseButton
            variant="secondary"
            size="sm"
            shape="rounded"
            :loading="cleanupLoading"
            @click="runCleanup"
          >
            {{ $t('admin.imageCache.cleanup') }}
          </BaseButton>
        </div>

        <!-- Instance Table -->
        <div v-if="stats?.instanceStats?.length" class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left border-b border-[var(--color-border)]">
                <th class="py-3 px-4 font-medium">{{ $t('admin.imageCache.domain') }}</th>
                <th class="py-3 px-4 font-medium text-right">{{ $t('admin.imageCache.imageCount') }}</th>
                <th class="py-3 px-4 font-medium text-right">{{ $t('admin.imageCache.avatarCount') }}</th>
                <th class="py-3 px-4 font-medium text-right">{{ $t('admin.imageCache.size') }}</th>
                <th class="py-3 px-4 font-medium text-right">{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="instance in stats.instanceStats"
                :key="instance.domain"
                class="border-b border-[var(--color-border)] hover:bg-[var(--color-background)]"
              >
                <td class="py-3 px-4">{{ instance.domain }}</td>
                <td class="py-3 px-4 text-right">{{ instance.imageCount }}</td>
                <td class="py-3 px-4 text-right">{{ instance.avatarCount }}</td>
                <td class="py-3 px-4 text-right">{{ formatBytes(instance.totalSize) }}</td>
                <td class="py-3 px-4 text-right">
                  <IconButton
                    variant="ghost"
                    size="sm"
                    :title="$t('admin.imageCache.clearInstance')"
                    :aria-label="$t('admin.imageCache.clearInstance')"
                    @click="clearInstanceCache(instance.domain)"
                  >
                    <Icon name="Trash2" :size="16" />
                  </IconButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="text-center py-8 text-[var(--color-text-muted)]">
          {{ $t('admin.imageCache.noCache') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const api = useApi()

interface CacheStats {
  totalCachedImages: number
  totalCachedSize: number
  totalCachedAvatars: number
  expiredCount: number
  instanceStats: {
    domain: string
    imageCount: number
    avatarCount: number
    totalSize: number
  }[]
}

interface CacheSettings {
  remoteImageCacheEnabled: boolean
  remoteImageCacheTtlDays: number
  remoteImageAutoCache: boolean
  cachePriorityEnabled: boolean
  cachePriorityThreshold: number
  cacheTtlMultiplierTier1: number
  cacheTtlMultiplierTier2: number
  cacheTtlMultiplierTier3: number
  cacheLikeTier1: number
  cacheLikeTier2: number
  cacheLikeTier3: number
}

const loading = ref(true)
const error = ref<string | null>(null)
const cleanupLoading = ref(false)

const stats = ref<CacheStats | null>(null)
const settings = ref<CacheSettings>({
  remoteImageCacheEnabled: true,
  remoteImageCacheTtlDays: 30,
  remoteImageAutoCache: true,
  cachePriorityEnabled: true,
  cachePriorityThreshold: 100,
  cacheTtlMultiplierTier1: 1.5,
  cacheTtlMultiplierTier2: 2.0,
  cacheTtlMultiplierTier3: 3.0,
  cacheLikeTier1: 10,
  cacheLikeTier2: 50,
  cacheLikeTier3: 100,
})

const activeSubTab = ref<'config' | 'instances'>('config')

const subTabs = [
  { key: 'config' as const, labelKey: 'admin.imageCache.tabConfig' },
  { key: 'instances' as const, labelKey: 'admin.imageCache.tabInstances' },
]

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const fetchData = async () => {
  loading.value = true
  error.value = null

  try {
    const [statsData, settingsData] = await Promise.all([
      api.get<CacheStats>('/api/admin/cache/stats'),
      api.get<CacheSettings>('/api/admin/cache/settings'),
    ])

    stats.value = statsData
    settings.value = settingsData
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

const updateSettings = async () => {
  try {
    const result = await api.patch<CacheSettings>('/api/admin/cache/settings', settings.value)
    settings.value = result
  } catch (e) {
    console.error('Failed to update cache settings:', e)
  }
}

const runCleanup = async () => {
  cleanupLoading.value = true
  try {
    await api.post('/api/admin/cache/cleanup')
    // Refresh stats
    await fetchData()
  } catch (e) {
    console.error('Failed to run cleanup:', e)
  } finally {
    cleanupLoading.value = false
  }
}

const clearInstanceCache = async (domain: string) => {
  if (!confirm(t('admin.imageCache.confirmClearInstance', { domain }))) {
    return
  }

  try {
    await api.delete(`/api/admin/cache/instance/${encodeURIComponent(domain)}`)
    // Refresh stats
    await fetchData()
  } catch (e) {
    console.error('Failed to clear instance cache:', e)
  }
}

onMounted(() => {
  fetchData()
})
</script>
