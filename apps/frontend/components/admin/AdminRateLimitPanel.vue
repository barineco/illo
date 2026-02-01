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

      <!-- Stats Overview (always visible) -->
      <div v-if="stats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.rateLimit.activePenalties') }}</div>
          <div class="text-2xl font-bold text-[var(--color-danger-text)]">{{ stats.activePenalties }}</div>
        </div>
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.rateLimit.logsLast24h') }}</div>
          <div class="text-2xl font-bold">{{ stats.last24Hours.logs }}</div>
        </div>
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.rateLimit.uniqueIPs') }}</div>
          <div class="text-2xl font-bold">{{ stats.uniqueIPs }}</div>
        </div>
        <div class="bg-[var(--color-surface)] rounded-lg p-4">
          <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.rateLimit.totalLogs') }}</div>
          <div class="text-2xl font-bold">{{ stats.totalLogs }}</div>
        </div>
      </div>

      <!-- Config Panel -->
      <div v-if="activeSubTab === 'config'" class="bg-[var(--color-surface)] rounded-lg p-6">
        <h2 class="text-xl font-bold mb-6">{{ $t('admin.rateLimit.configTitle') }}</h2>

        <!-- Enabled Toggle -->
        <div class="flex items-center justify-between mb-6 p-4 bg-[var(--color-background)] rounded-lg">
          <div>
            <div class="font-medium">{{ $t('admin.rateLimit.enabled') }}</div>
            <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.rateLimit.enabledDesc') }}</div>
          </div>
          <ToggleSwitch
            v-model="config.enabled"
            @change="updateConfig"
          />
        </div>

        <!-- Thresholds -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Window Settings -->
          <div class="space-y-4">
            <h3 class="font-medium text-[var(--color-text)]">{{ $t('admin.rateLimit.windowSettings') }}</h3>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.windowSeconds') }}</label>
              <input
                v-model.number="config.windowSeconds"
                type="number"
                min="10"
                max="300"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.softLimitPerWindow') }}</label>
              <input
                v-model.number="config.softLimitPerWindow"
                type="number"
                min="1"
                max="100"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.hardLimitPerWindow') }}</label>
              <input
                v-model.number="config.hardLimitPerWindow"
                type="number"
                min="1"
                max="100"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>
          </div>

          <!-- Hourly Settings -->
          <div class="space-y-4">
            <h3 class="font-medium text-[var(--color-text)]">{{ $t('admin.rateLimit.hourlySettings') }}</h3>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.softLimitPerHour') }}</label>
              <input
                v-model.number="config.softLimitPerHour"
                type="number"
                min="10"
                max="1000"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.hardLimitPerHour') }}</label>
              <input
                v-model.number="config.hardLimitPerHour"
                type="number"
                min="10"
                max="2000"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>
          </div>

          <!-- Pattern Detection -->
          <div class="space-y-4">
            <h3 class="font-medium text-[var(--color-text)]">{{ $t('admin.rateLimit.patternDetection') }}</h3>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.cvSoftThreshold') }}</label>
              <input
                v-model.number="config.cvSoftThreshold"
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
              <p class="text-xs text-[var(--color-text-muted)] mt-1">{{ $t('admin.rateLimit.cvDesc') }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.cvHardThreshold') }}</label>
              <input
                v-model.number="config.cvHardThreshold"
                type="number"
                min="0.01"
                max="1"
                step="0.01"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>
          </div>

          <!-- Penalty Duration -->
          <div class="space-y-4">
            <h3 class="font-medium text-[var(--color-text)]">{{ $t('admin.rateLimit.penaltyDuration') }}</h3>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.softPenaltyMinutes') }}</label>
              <input
                v-model.number="config.softPenaltyMinutes"
                type="number"
                min="1"
                max="60"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.hardPenaltyMinutes') }}</label>
              <input
                v-model.number="config.hardPenaltyMinutes"
                type="number"
                min="1"
                max="240"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.maxPenaltyMinutes') }}</label>
              <input
                v-model.number="config.maxPenaltyMinutes"
                type="number"
                min="1"
                max="1440"
                class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg"
                @change="updateConfig"
              />
            </div>
          </div>
        </div>

        <!-- Headless Detection Integration -->
        <div class="mt-6 p-4 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
          <h3 class="font-medium text-[var(--color-text)] mb-4">{{ $t('admin.rateLimit.headlessDetection') }}</h3>
          <p class="text-sm text-[var(--color-text-muted)] mb-4">{{ $t('admin.rateLimit.headlessDetectionDesc') }}</p>

          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="font-medium text-sm">{{ $t('admin.rateLimit.noInteractionEnabled') }}</div>
              <div class="text-xs text-[var(--color-text-muted)]">{{ $t('admin.rateLimit.noInteractionEnabledDesc') }}</div>
            </div>
            <ToggleSwitch
              v-model="config.noInteractionEnabled"
              @change="updateConfig"
            />
          </div>

          <div v-if="config.noInteractionEnabled">
            <label class="block text-sm font-medium mb-1">{{ $t('admin.rateLimit.noInteractionThresholdMultiplier') }}</label>
            <input
              v-model.number="config.noInteractionThresholdMultiplier"
              type="number"
              min="0.1"
              max="1.0"
              step="0.1"
              class="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg"
              @change="updateConfig"
            />
            <p class="text-xs text-[var(--color-text-muted)] mt-1">{{ $t('admin.rateLimit.noInteractionThresholdMultiplierDesc') }}</p>
          </div>
        </div>

        <!-- Save Message -->
        <div v-if="configSaved" class="mt-4 p-3 bg-[var(--color-success-bg)] text-[var(--color-success-text)] rounded-lg">
          {{ $t('admin.rateLimit.configSaved') }}
        </div>
      </div>

      <!-- Logs Panel -->
      <div v-if="activeSubTab === 'logs'" class="bg-[var(--color-surface)] rounded-lg p-6">
        <h2 class="text-xl font-bold mb-4">{{ $t('admin.rateLimit.logsTitle') }}</h2>

        <!-- Filters -->
        <div class="flex flex-wrap gap-4 mb-4">
          <select
            v-model="logsFilter.tier"
            class="px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm"
            @change="fetchLogs"
          >
            <option value="">{{ $t('admin.rateLimit.allTiers') }}</option>
            <option value="WARNING">WARNING</option>
            <option value="SOFT_LIMIT">SOFT_LIMIT</option>
            <option value="HARD_LIMIT">HARD_LIMIT</option>
          </select>

          <input
            v-model="logsFilter.ipAddress"
            type="text"
            :placeholder="$t('admin.rateLimit.filterByIP')"
            class="px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm"
            @input="debouncedFetchLogs"
          />
        </div>

        <!-- Logs Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)]">
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.time') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.tier') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.ip') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.user') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.requests') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.cv') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="log in logs.data"
                :key="log.id"
                class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]"
              >
                <td class="py-2 px-3">{{ formatDate(log.createdAt) }}</td>
                <td class="py-2 px-3">
                  <span :class="getTierClass(log.tier)">{{ log.tier }}</span>
                </td>
                <td class="py-2 px-3 font-mono text-xs">{{ log.ipAddress }}</td>
                <td class="py-2 px-3">{{ log.username || '-' }}</td>
                <td class="py-2 px-3">{{ log.requestCount }}</td>
                <td class="py-2 px-3">{{ log.intervalVariance?.toFixed(3) || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="logs.totalPages > 1" class="flex justify-center gap-2 mt-4">
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="logs.page <= 1"
            @click="changePage(logs.page - 1)"
          >
            {{ $t('common.previous') }}
          </BaseButton>
          <span class="px-4 py-2 text-sm">
            {{ logs.page }} / {{ logs.totalPages }}
          </span>
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="logs.page >= logs.totalPages"
            @click="changePage(logs.page + 1)"
          >
            {{ $t('common.next') }}
          </BaseButton>
        </div>
      </div>

      <!-- Penalties Panel -->
      <div v-if="activeSubTab === 'penalties'" class="bg-[var(--color-surface)] rounded-lg p-6">
        <h2 class="text-xl font-bold mb-4">{{ $t('admin.rateLimit.penaltiesTitle') }}</h2>

        <!-- Filters -->
        <div class="flex flex-wrap gap-4 mb-4">
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="penaltiesFilter.activeOnly"
              type="checkbox"
              class="w-4 h-4"
              @change="fetchPenalties"
            />
            {{ $t('admin.rateLimit.activeOnly') }}
          </label>
        </div>

        <!-- Penalties Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-[var(--color-border)]">
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.startedAt') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.expiresAt') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.tier') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.ip') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.user') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.violations') }}</th>
                <th class="text-left py-2 px-3">{{ $t('admin.rateLimit.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="penalty in penalties.data"
                :key="penalty.id"
                class="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]"
              >
                <td class="py-2 px-3">{{ formatDate(penalty.startedAt) }}</td>
                <td class="py-2 px-3">
                  <span :class="penalty.isActive ? 'text-[var(--color-danger-text)]' : 'text-[var(--color-text-muted)]'">
                    {{ formatDate(penalty.expiresAt) }}
                  </span>
                </td>
                <td class="py-2 px-3">
                  <span :class="getTierClass(penalty.tier)">{{ penalty.tier }}</span>
                </td>
                <td class="py-2 px-3 font-mono text-xs">{{ penalty.ipAddress }}</td>
                <td class="py-2 px-3">{{ penalty.username || '-' }}</td>
                <td class="py-2 px-3">{{ penalty.violationCount }}</td>
                <td class="py-2 px-3">
                  <BaseButton
                    v-if="penalty.isActive"
                    variant="danger"
                    size="xs"
                    @click="removePenalty(penalty.id)"
                  >
                    {{ $t('admin.rateLimit.remove') }}
                  </BaseButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty State -->
        <div v-if="penalties.data.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
          {{ $t('admin.rateLimit.noPenalties') }}
        </div>

        <!-- Pagination -->
        <div v-if="penalties.totalPages > 1" class="flex justify-center gap-2 mt-4">
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="penalties.page <= 1"
            @click="changePenaltiesPage(penalties.page - 1)"
          >
            {{ $t('common.previous') }}
          </BaseButton>
          <span class="px-4 py-2 text-sm">
            {{ penalties.page }} / {{ penalties.totalPages }}
          </span>
          <BaseButton
            variant="secondary"
            size="sm"
            :disabled="penalties.page >= penalties.totalPages"
            @click="changePenaltiesPage(penalties.page + 1)"
          >
            {{ $t('common.next') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()

const loading = ref(true)
const error = ref<string | null>(null)
const configSaved = ref(false)
const activeSubTab = ref('config')

const subTabs = [
  { key: 'config', labelKey: 'admin.rateLimit.config' },
  { key: 'logs', labelKey: 'admin.rateLimit.logs' },
  { key: 'penalties', labelKey: 'admin.rateLimit.penalties' },
]

// Config state
const config = ref({
  windowSeconds: 30,
  softLimitPerWindow: 8,
  hardLimitPerWindow: 12,
  softLimitPerHour: 150,
  hardLimitPerHour: 250,
  cvSoftThreshold: 0.15,
  cvHardThreshold: 0.08,
  softPenaltyMinutes: 5,
  hardPenaltyMinutes: 30,
  maxPenaltyMinutes: 120,
  enabled: true,
  // Headless detection integration
  noInteractionEnabled: false,
  noInteractionThresholdMultiplier: 1.0,
})

// Stats state
const stats = ref<{
  totalLogs: number
  activePenalties: number
  uniqueIPs: number
  uniqueUsers: number
  last24Hours: { logs: number; penalties: number }
} | null>(null)

// Logs state
const logs = ref<{
  data: any[]
  total: number
  page: number
  limit: number
  totalPages: number
}>({
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
})

const logsFilter = ref({
  tier: '',
  ipAddress: '',
})

// Penalties state
const penalties = ref<{
  data: any[]
  total: number
  page: number
  limit: number
  totalPages: number
}>({
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
})

const penaltiesFilter = ref({
  activeOnly: true,
})

async function fetchData() {
  loading.value = true
  error.value = null

  try {
    await Promise.all([
      fetchConfig(),
      fetchStats(),
      fetchLogs(),
      fetchPenalties(),
    ])
  } catch (e: any) {
    error.value = e.message || t('common.error')
  } finally {
    loading.value = false
  }
}

async function fetchConfig() {
  const data = await api.get<any>('/api/admin/rate-limit/config')
  config.value = { ...config.value, ...data }
}

async function fetchStats() {
  stats.value = await api.get('/api/admin/rate-limit/stats')
}

async function fetchLogs() {
  const params: Record<string, any> = {
    page: logs.value.page,
    limit: logs.value.limit,
  }
  if (logsFilter.value.tier) params.tier = logsFilter.value.tier
  if (logsFilter.value.ipAddress) params.ipAddress = logsFilter.value.ipAddress

  logs.value = await api.get('/api/admin/rate-limit/logs', { params })
}

async function fetchPenalties() {
  const params: Record<string, any> = {
    page: penalties.value.page,
    limit: penalties.value.limit,
    activeOnly: penaltiesFilter.value.activeOnly ? 'true' : 'false',
  }

  penalties.value = await api.get('/api/admin/rate-limit/penalties', { params })
}

async function updateConfig() {
  try {
    await api.put('/api/admin/rate-limit/config', config.value)
    configSaved.value = true
    setTimeout(() => {
      configSaved.value = false
    }, 3000)
  } catch (e: any) {
    error.value = e.message || t('common.error')
  }
}

async function removePenalty(id: string) {
  try {
    await api.delete(`/api/admin/rate-limit/penalties/${id}`)
    await fetchPenalties()
    await fetchStats()
  } catch (e: any) {
    error.value = e.message || t('common.error')
  }
}

function changePage(page: number) {
  logs.value.page = page
  fetchLogs()
}

function changePenaltiesPage(page: number) {
  penalties.value.page = page
  fetchPenalties()
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedFetchLogs() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    logs.value.page = 1
    fetchLogs()
  }, 300)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function getTierClass(tier: string) {
  switch (tier) {
    case 'WARNING':
      return 'px-2 py-1 rounded text-xs bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
    case 'SOFT_LIMIT':
      return 'px-2 py-1 rounded text-xs bg-[var(--color-badge-suspended-bg)] text-[var(--color-badge-suspended-text)]'
    case 'HARD_LIMIT':
      return 'px-2 py-1 rounded text-xs bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]'
    default:
      return 'px-2 py-1 rounded text-xs bg-[var(--color-surface-secondary)]'
  }
}

onMounted(() => {
  fetchData()
})
</script>
