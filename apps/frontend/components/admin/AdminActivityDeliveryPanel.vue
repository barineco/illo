<template>
  <div class="space-y-6">
    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-warning-text)]">{{ stats.pending }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.deliveryPending') }}</div>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-success-text)]">{{ stats.delivered }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.deliveryDelivered') }}</div>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-danger-text)]">{{ stats.failed }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.deliveryFailed') }}</div>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-text)]">{{ stats.total }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.total') }}</div>
      </div>
    </div>

    <!-- Activity Type Stats -->
    <div v-if="stats.byType && stats.byType.length > 0" class="bg-[var(--color-surface)] rounded-lg p-4">
      <h3 class="text-sm font-medium mb-3">{{ $t('admin.deliveryByType') }}</h3>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="item in stats.byType"
          :key="item.type"
          class="px-3 py-1 text-sm bg-[var(--color-surface-secondary)] rounded-full"
        >
          {{ item.type }}: {{ item.count }}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-4">
      <BaseButton
        variant="secondary"
        size="sm"
        shape="rounded"
        :disabled="retryingAll || stats.failed === 0"
        @click="retryAllFailed"
      >
        <Icon name="ArrowPath" class="w-4 h-4 mr-2" />
        {{ retryingAll ? $t('admin.retrying') : $t('admin.retryAllFailed') }}
      </BaseButton>
      <BaseButton
        variant="ghost"
        size="sm"
        shape="rounded"
        @click="refresh"
      >
        <Icon name="ArrowPath" class="w-4 h-4 mr-2" />
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Filters -->
    <div class="bg-[var(--color-surface)] rounded-lg p-4 flex flex-wrap gap-4">
      <div class="flex-1 min-w-[150px]">
        <label class="block text-sm font-medium mb-2">{{ $t('admin.status') }}</label>
        <select
          v-model="filters.status"
          class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          @change="loadDeliveries"
        >
          <option value="">{{ $t('admin.all') }}</option>
          <option value="PENDING">{{ $t('admin.pending') }}</option>
          <option value="DELIVERED">{{ $t('admin.deliveryDelivered') }}</option>
          <option value="FAILED">{{ $t('admin.deliveryFailed') }}</option>
        </select>
      </div>
      <div class="flex-1 min-w-[150px]">
        <label class="block text-sm font-medium mb-2">{{ $t('admin.activityType') }}</label>
        <select
          v-model="filters.activityType"
          class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          @change="loadDeliveries"
        >
          <option value="">{{ $t('admin.all') }}</option>
          <option value="Create">Create</option>
          <option value="Update">Update</option>
          <option value="Delete">Delete</option>
          <option value="Follow">Follow</option>
          <option value="Undo">Undo</option>
          <option value="Like">Like</option>
          <option value="Announce">Announce</option>
        </select>
      </div>
    </div>

    <!-- Delivery List -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
    </div>

    <div v-else-if="deliveries.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
      {{ $t('admin.noDeliveries') }}
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="delivery in deliveries"
        :key="delivery.id"
        class="bg-[var(--color-surface)] rounded-lg p-4"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <span :class="getStatusClass(delivery.status)" class="px-2 py-1 text-xs rounded">
              {{ getStatusLabel(delivery.status) }}
            </span>
            <span class="px-2 py-1 text-xs bg-[var(--color-surface-secondary)] rounded">
              {{ delivery.activityType }}
            </span>
            <span class="text-xs text-[var(--color-text-muted)]">
              {{ $t('admin.attempts') }}: {{ delivery.attemptCount }}/{{ delivery.maxAttempts }}
            </span>
          </div>
          <span class="text-xs text-[var(--color-text-muted)]">
            {{ formatDate(delivery.createdAt) }}
          </span>
        </div>

        <!-- Sender -->
        <div class="text-sm mb-2">
          <span class="text-[var(--color-text-muted)]">{{ $t('admin.sender') }}: </span>
          <NuxtLink
            v-if="delivery.sender"
            :to="`/users/${delivery.sender.username}`"
            class="text-[var(--color-primary)] hover:underline"
          >
            {{ delivery.sender.displayName || delivery.sender.username }}
          </NuxtLink>
          <span v-else class="text-[var(--color-text-muted)]">{{ $t('admin.modeUnknown') }}</span>
        </div>

        <!-- Inbox URL -->
        <div class="text-sm mb-2">
          <span class="text-[var(--color-text-muted)]">{{ $t('admin.inboxUrl') }}: </span>
          <span class="font-mono text-xs break-all">{{ delivery.inboxUrl }}</span>
        </div>

        <!-- Error -->
        <div v-if="delivery.lastError" class="text-sm mb-3 p-3 bg-[var(--color-danger-bg)] rounded text-[var(--color-danger-text)]">
          {{ delivery.lastError }}
        </div>

        <!-- Last Attempt -->
        <div v-if="delivery.lastAttemptAt" class="text-xs text-[var(--color-text-muted)] mb-2">
          {{ $t('admin.lastAttempt') }}: {{ formatDate(delivery.lastAttemptAt) }}
        </div>

        <!-- Actions -->
        <div v-if="delivery.status === 'FAILED'" class="flex gap-2">
          <BaseButton
            variant="primary"
            size="sm"
            shape="rounded"
            :disabled="retryingIds.has(delivery.id)"
            @click="retryDelivery(delivery.id)"
          >
            <Icon name="ArrowPath" class="w-4 h-4 mr-1" />
            {{ retryingIds.has(delivery.id) ? $t('admin.retrying') : $t('admin.retry') }}
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="sm"
            shape="rounded"
            @click="viewDetails(delivery.id)"
          >
            {{ $t('admin.viewDetails') }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center gap-2">
      <button
        v-for="page in totalPages"
        :key="page"
        @click="goToPage(page)"
        :class="[
          'px-4 py-2 rounded-lg',
          currentPage === page
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
            : 'bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)]'
        ]"
      >
        {{ page }}
      </button>
    </div>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div
        v-if="showDetailModal"
        class="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50 p-4"
        @click.self="showDetailModal = false"
      >
        <div class="bg-[var(--color-surface)] rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold">{{ $t('admin.deliveryDetails') }}</h3>
            <button @click="showDetailModal = false" class="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <Icon name="XMark" class="w-6 h-6" />
            </button>
          </div>

          <div v-if="detailLoading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
          </div>

          <div v-else-if="detailData" class="space-y-4">
            <div>
              <div class="text-sm text-[var(--color-text-muted)] mb-1">ID</div>
              <div class="font-mono text-xs">{{ detailData.id }}</div>
            </div>
            <div>
              <div class="text-sm text-[var(--color-text-muted)] mb-1">{{ $t('admin.status') }}</div>
              <span :class="getStatusClass(detailData.status)" class="px-2 py-1 text-xs rounded">
                {{ getStatusLabel(detailData.status) }}
              </span>
            </div>
            <div>
              <div class="text-sm text-[var(--color-text-muted)] mb-1">{{ $t('admin.activityPayload') }}</div>
              <pre class="bg-[var(--color-background)] p-4 rounded overflow-x-auto text-xs">{{ JSON.stringify(detailData.activityPayload, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()

interface DeliverySender {
  id: string
  username: string
  displayName?: string
  domain?: string
}

interface Delivery {
  id: string
  senderId: string
  inboxUrl: string
  activityType: string
  status: string
  attemptCount: number
  maxAttempts: number
  lastError?: string
  lastAttemptAt?: string
  createdAt: string
  sender?: DeliverySender
}

interface DeliveryDetail extends Delivery {
  activityPayload: any
}

interface Stats {
  pending: number
  delivered: number
  failed: number
  total: number
  byType: { type: string; count: number }[]
}

const deliveries = ref<Delivery[]>([])
const loading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const retryingIds = ref(new Set<string>())
const retryingAll = ref(false)

const stats = ref<Stats>({
  pending: 0,
  delivered: 0,
  failed: 0,
  total: 0,
  byType: []
})

const filters = reactive({
  status: '',
  activityType: ''
})

const showDetailModal = ref(false)
const detailLoading = ref(false)
const detailData = ref<DeliveryDetail | null>(null)

const loadDeliveries = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.activityType) params.append('activityType', filters.activityType)
    params.append('page', currentPage.value.toString())
    params.append('limit', '20')

    const data = await api.get<any>(`/api/admin/activity-deliveries?${params.toString()}`)
    deliveries.value = data.deliveries
    totalPages.value = data.totalPages
  } catch (err) {
    console.error('Failed to load deliveries:', err)
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const data = await api.get<Stats>('/api/admin/activity-deliveries/stats')
    stats.value = data
  } catch (err) {
    console.error('Failed to load stats:', err)
  }
}

const retryDelivery = async (id: string) => {
  retryingIds.value.add(id)
  try {
    await api.post(`/api/admin/activity-deliveries/${id}/retry`)
    await loadDeliveries()
    await loadStats()
  } catch (err) {
    console.error('Failed to retry delivery:', err)
  } finally {
    retryingIds.value.delete(id)
  }
}

const retryAllFailed = async () => {
  retryingAll.value = true
  try {
    await api.post('/api/admin/activity-deliveries/retry-all-failed')
    await loadDeliveries()
    await loadStats()
  } catch (err) {
    console.error('Failed to retry all:', err)
  } finally {
    retryingAll.value = false
  }
}

const viewDetails = async (id: string) => {
  showDetailModal.value = true
  detailLoading.value = true
  detailData.value = null

  try {
    detailData.value = await api.get<DeliveryDetail>(`/api/admin/activity-deliveries/${id}`)
  } catch (err) {
    console.error('Failed to load details:', err)
  } finally {
    detailLoading.value = false
  }
}

const refresh = async () => {
  await Promise.all([loadDeliveries(), loadStats()])
}

const goToPage = (page: number) => {
  currentPage.value = page
  loadDeliveries()
}

const getStatusClass = (status: string) => {
  switch (status) {
    case 'PENDING': return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
    case 'DELIVERED': return 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
    case 'FAILED': return 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]'
    default: return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return t('admin.pending')
    case 'DELIVERED': return t('admin.deliveryDelivered')
    case 'FAILED': return t('admin.deliveryFailed')
    default: return status
  }
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString()
}

onMounted(() => {
  loadDeliveries()
  loadStats()
})
</script>
