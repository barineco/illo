<template>
  <div class="space-y-6">
    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-warning-text)]">{{ reportStats.pending }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.reportsPending') }}</div>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-info-text)]">{{ reportStats.investigating }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.reportsInvestigating') }}</div>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-success-text)]">{{ reportStats.resolved }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.reportsResolved') }}</div>
      </div>
      <div class="bg-[var(--color-surface)] rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-[var(--color-text-muted)]">{{ reportStats.dismissed }}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{{ $t('admin.reportsDismissed') }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-[var(--color-surface)] rounded-lg p-4 flex flex-wrap gap-4">
      <div class="flex-1 min-w-[150px]">
        <label class="block text-sm font-medium mb-2">{{ $t('admin.reportStatus') }}</label>
        <select
          v-model="reportFilters.status"
          class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          @change="loadReports"
        >
          <option value="">{{ $t('admin.all') }}</option>
          <option value="PENDING">{{ $t('admin.pending') }}</option>
          <option value="INVESTIGATING">{{ $t('admin.investigating') }}</option>
          <option value="RESOLVED">{{ $t('admin.resolved') }}</option>
          <option value="DISMISSED">{{ $t('admin.dismissed') }}</option>
        </select>
      </div>
      <div class="flex-1 min-w-[150px]">
        <label class="block text-sm font-medium mb-2">{{ $t('admin.reportType') }}</label>
        <select
          v-model="reportFilters.type"
          class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          @change="loadReports"
        >
          <option value="">{{ $t('admin.all') }}</option>
          <option value="ARTWORK">{{ $t('report.targetArtwork') }}</option>
          <option value="USER">{{ $t('report.targetUser') }}</option>
          <option value="COMMENT">{{ $t('report.targetComment') }}</option>
        </select>
      </div>
    </div>

    <!-- Reports List -->
    <div v-if="reportsLoading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
    </div>

    <div v-else-if="reports.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
      {{ $t('admin.noReports') }}
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="report in reports"
        :key="report.id"
        class="bg-[var(--color-surface)] rounded-lg p-4"
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <span :class="getReportStatusClass(report.status)" class="px-2 py-1 text-xs rounded">
              {{ getReportStatusLabel(report.status) }}
            </span>
            <span class="px-2 py-1 text-xs bg-[var(--color-surface-secondary)] rounded">
              {{ getReportTypeLabel(report.type) }}
            </span>
            <span class="px-2 py-1 text-xs bg-[var(--color-surface-secondary)] rounded">
              {{ getReportReasonLabel(report.reason) }}
            </span>
          </div>
          <span class="text-xs text-[var(--color-text-muted)]">
            {{ formatDate(report.createdAt) }}
          </span>
        </div>

        <!-- Reporter -->
        <div class="text-sm mb-2">
          <span class="text-[var(--color-text-muted)]">{{ $t('admin.reportedBy') }}: </span>
          <NuxtLink :to="`/users/${report.reporter.username}`" class="text-[var(--color-primary)] hover:underline">
            {{ report.reporter.displayName || report.reporter.username }}
          </NuxtLink>
        </div>

        <!-- Target -->
        <div class="text-sm mb-2">
          <span class="text-[var(--color-text-muted)]">{{ $t('admin.reportTarget') }}: </span>
          <template v-if="report.type === 'ARTWORK' && report.artwork">
            <NuxtLink :to="`/artworks/${report.artwork.id}`" class="text-[var(--color-primary)] hover:underline">
              {{ report.artwork.title }}
            </NuxtLink>
            <span class="text-[var(--color-text-muted)]">
              ({{ $t('admin.by') }} {{ report.artwork.author?.displayName || report.artwork.author?.username }})
            </span>
          </template>
          <template v-else-if="report.type === 'USER' && report.targetUser">
            <NuxtLink :to="`/users/${report.targetUser.username}`" class="text-[var(--color-primary)] hover:underline">
              {{ report.targetUser.displayName || report.targetUser.username }}
            </NuxtLink>
          </template>
          <template v-else-if="report.type === 'COMMENT' && report.comment">
            <span class="text-[var(--color-text)]">"{{ report.comment.content.substring(0, 100) }}{{ report.comment.content.length > 100 ? '...' : '' }}"</span>
          </template>
        </div>

        <!-- Description -->
        <div class="text-sm mb-3 p-3 bg-[var(--color-background)] rounded">
          {{ report.description }}
        </div>

        <!-- Admin Actions -->
        <div v-if="report.status === 'PENDING' || report.status === 'INVESTIGATING'" class="flex gap-2">
          <BaseButton
            v-if="report.status === 'PENDING'"
            variant="secondary"
            size="sm"
            shape="rounded"
            @click="updateReportStatus(report.id, 'INVESTIGATING')"
          >
            {{ $t('admin.markInvestigating') }}
          </BaseButton>
          <BaseButton
            variant="primary"
            size="sm"
            shape="rounded"
            @click="updateReportStatus(report.id, 'RESOLVED')"
          >
            {{ $t('admin.markResolved') }}
          </BaseButton>
          <BaseButton
            variant="ghost"
            size="sm"
            shape="rounded"
            @click="updateReportStatus(report.id, 'DISMISSED')"
          >
            {{ $t('admin.dismiss') }}
          </BaseButton>
        </div>

        <!-- Admin Notes (if resolved/dismissed) -->
        <div v-if="report.adminNotes" class="mt-2 text-sm text-[var(--color-text-muted)]">
          <span class="font-medium">{{ $t('admin.adminNotes') }}: </span>{{ report.adminNotes }}
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="reportsTotalPages > 1" class="flex justify-center gap-2">
      <button
        v-for="page in reportsTotalPages"
        :key="page"
        @click="goToReportsPage(page)"
        :class="[
          'px-4 py-2 rounded-lg',
          reportsCurrentPage === page
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
            : 'bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)]'
        ]"
      >
        {{ page }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()

interface Report {
  id: string
  type: string
  reason: string
  status: string
  description: string
  createdAt: string
  reporter: { id: string; username: string; displayName?: string }
  artwork?: { id: string; title: string; author?: { username: string; displayName?: string } }
  targetUser?: { id: string; username: string; displayName?: string }
  comment?: { id: string; content: string }
  adminNotes?: string
}

const reports = ref<Report[]>([])
const reportsLoading = ref(false)
const reportsCurrentPage = ref(1)
const reportsTotalPages = ref(1)

const reportFilters = reactive({
  status: '',
  type: ''
})

const reportStats = ref({
  pending: 0,
  investigating: 0,
  resolved: 0,
  dismissed: 0
})

const loadReports = async () => {
  reportsLoading.value = true
  try {
    const params = new URLSearchParams()
    if (reportFilters.status) params.append('status', reportFilters.status)
    if (reportFilters.type) params.append('type', reportFilters.type)
    params.append('page', reportsCurrentPage.value.toString())
    params.append('limit', '20')

    const data = await api.get<any>(`/api/admin/reports?${params.toString()}`)
    reports.value = data.reports
    reportsTotalPages.value = data.totalPages
  } catch (err) {
    console.error('Failed to load reports:', err)
  } finally {
    reportsLoading.value = false
  }
}

const loadReportStats = async () => {
  try {
    const data = await api.get<any>('/api/admin/reports/stats')
    reportStats.value = data.byStatus
  } catch (err) {
    console.error('Failed to load report stats:', err)
  }
}

const updateReportStatus = async (reportId: string, status: string) => {
  try {
    await api.patch(`/api/admin/reports/${reportId}`, { status })
    await loadReports()
    await loadReportStats()
  } catch (err) {
    console.error('Failed to update report:', err)
  }
}

const goToReportsPage = (page: number) => {
  reportsCurrentPage.value = page
  loadReports()
}

const getReportStatusClass = (status: string) => {
  switch (status) {
    case 'PENDING': return 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]'
    case 'INVESTIGATING': return 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]'
    case 'RESOLVED': return 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
    case 'DISMISSED': return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
    default: return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
  }
}

const getReportStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return t('admin.pending')
    case 'INVESTIGATING': return t('admin.investigating')
    case 'RESOLVED': return t('admin.resolved')
    case 'DISMISSED': return t('admin.dismissed')
    default: return status
  }
}

const getReportTypeLabel = (type: string) => {
  switch (type) {
    case 'ARTWORK': return t('report.targetArtwork')
    case 'USER': return t('report.targetUser')
    case 'COMMENT': return t('report.targetComment')
    default: return type
  }
}

const getReportReasonLabel = (reason: string) => {
  const reasonMap: Record<string, string> = {
    'INAPPROPRIATE_CONTENT': t('report.reasons.inappropriateContent'),
    'SPAM': t('report.reasons.spam'),
    'HARASSMENT': t('report.reasons.harassment'),
    'COPYRIGHT_VIOLATION': t('report.reasons.copyrightViolation'),
    'SEXUAL_CONTENT': t('report.reasons.sexualContent'),
    'VIOLENCE': t('report.reasons.violence'),
    'ACCOUNT_SPAM': t('report.reasons.accountSpam'),
    'IMPERSONATION': t('report.reasons.impersonation'),
    'HATE_SPEECH': t('report.reasons.hateSpeech'),
    'OTHER': t('report.reasons.other')
  }
  return reasonMap[reason] || reason
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString()
}

onMounted(() => {
  loadReports()
  loadReportStats()
})
</script>
