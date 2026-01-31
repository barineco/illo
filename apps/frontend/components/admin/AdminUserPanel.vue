<template>
  <div class="space-y-6">
    <!-- Success/Error Messages -->
    <div v-if="successMessage" class="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-4">
      <p class="text-[var(--color-success-text)]">{{ successMessage }}</p>
    </div>
    <div v-if="submitError" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-4">
      <p class="text-[var(--color-danger-text)]">{{ submitError }}</p>
    </div>

    <!-- Filters -->
    <div class="bg-[var(--color-surface)] rounded-lg p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <!-- Status filter -->
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2">{{ $t('admin.status') }}</label>
          <select
            v-model="userFilters.status"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            @change="loadUsers"
          >
            <option value="all">{{ $t('admin.allUsers') }}</option>
            <option value="pending">{{ $t('admin.pending') }}</option>
            <option value="active">{{ $t('admin.active') }}</option>
            <option value="suspended">{{ $t('admin.suspended') }}</option>
            <option value="rejected">{{ $t('admin.rejected') }}</option>
          </select>
        </div>

        <!-- Location filter (Local/Remote) -->
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2">{{ $t('admin.userType') }}</label>
          <select
            v-model="userFilters.location"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            @change="loadUsers"
          >
            <option value="all">{{ $t('admin.all') }}</option>
            <option value="local">{{ $t('admin.localOnly') }}</option>
            <option value="remote">{{ $t('admin.remoteOnly') }}</option>
          </select>
        </div>

        <!-- Search filter -->
        <div class="flex-1">
          <label class="block text-sm font-medium mb-2">{{ $t('search.title') }}</label>
          <input
            v-model="userFilters.search"
            type="text"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            :placeholder="$t('admin.searchPlaceholder')"
            @input="debouncedSearch"
          />
        </div>
      </div>

      <!-- Stats -->
      <div class="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 text-sm">
        <div>
          <span class="text-[var(--color-text-secondary)]">{{ $t('admin.total') }}:</span>
          <span class="ml-2 font-medium">{{ userStats.total }}</span>
        </div>
        <div>
          <span class="text-[var(--color-text-secondary)]">{{ $t('admin.local') }}:</span>
          <span class="ml-2 font-medium text-[var(--color-text)]">{{ userStats.local }}</span>
        </div>
        <div>
          <span class="text-[var(--color-text-secondary)]">{{ $t('admin.remote') }}:</span>
          <span class="ml-2 font-medium text-[var(--color-badge-remote-text)]">{{ userStats.remote }}</span>
        </div>
        <div>
          <span class="text-[var(--color-text-secondary)]">{{ $t('admin.pending') }}:</span>
          <span class="ml-2 font-medium text-[var(--color-badge-pending-text)]">{{ userStats.pending }}</span>
        </div>
        <div>
          <span class="text-[var(--color-text-secondary)]">{{ $t('admin.active') }}:</span>
          <span class="ml-2 font-medium text-[var(--color-badge-active-text)]">{{ userStats.active }}</span>
        </div>
        <div>
          <span class="text-[var(--color-text-secondary)]">{{ $t('admin.suspended') }}:</span>
          <span class="ml-2 font-medium text-[var(--color-badge-suspended-text)]">{{ userStats.suspended }}</span>
        </div>
        <div>
          <span class="text-[var(--color-text-secondary)]">{{ $t('admin.rejected') }}:</span>
          <span class="ml-2 font-medium text-[var(--color-badge-rejected-text)]">{{ userStats.rejected }}</span>
        </div>
      </div>
    </div>

    <!-- User List -->
    <div v-if="usersLoading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="users.length === 0" class="text-center py-8">
      <p class="text-[var(--color-text-secondary)]">{{ usersEmptyMessage }}</p>
    </div>

    <div v-else class="space-y-4">
      <!-- User cards with inline actions -->
      <div
        v-for="user in users"
        :key="user.id"
        class="bg-[var(--color-surface)] rounded-lg p-4 hover:bg-[var(--color-hover)] transition-colors"
      >
        <div class="flex gap-4">
          <!-- Avatar -->
          <NuxtLink :to="getUserPathFromUser(user)" class="shrink-0">
            <img
              v-if="user.avatarUrl"
              :src="user.avatarUrl"
              :alt="user.username"
              class="w-16 h-16 rounded-full object-cover"
            />
            <div
              v-else
              class="w-16 h-16 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center text-2xl"
            >
              <Icon name="UserCircle" class="w-10 h-10 text-[var(--color-text-muted)]" />
            </div>
          </NuxtLink>

          <!-- User info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <NuxtLink
                :to="getUserPathFromUser(user)"
                class="font-medium hover:text-[var(--color-primary)] truncate"
              >
                {{ user.displayName || user.username }}
              </NuxtLink>

              <!-- Status badge -->
              <span
                :class="[
                  'px-2 py-0.5 text-xs rounded-full',
                  getUserStatusClass(user)
                ]"
              >
                {{ getUserStatusText(user) }}
              </span>

              <!-- Admin badge -->
              <span
                v-if="user.role === 'ADMIN'"
                class="px-2 py-0.5 text-xs rounded-full bg-[var(--color-badge-admin-bg)] text-[var(--color-badge-admin-text)]"
              >
                {{ $t('admin.adminBadge') }}
              </span>

              <!-- Remote badge -->
              <span
                v-if="user.domain"
                class="px-2 py-0.5 text-xs rounded-full bg-[var(--color-badge-remote-bg)] text-[var(--color-badge-remote-text)]"
              >
                {{ $t('admin.remote') }}
              </span>
            </div>

            <p class="text-sm text-[var(--color-text-secondary)] mb-2">
              @{{ user.username }}{{ user.domain ? `@${user.domain}` : '' }}
            </p>

            <p v-if="user.bio" class="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
              {{ user.bio }}
            </p>

            <!-- Rejection/Suspension reason -->
            <p
              v-if="user.rejectionReason || user.suspensionReason"
              class="text-sm text-[var(--color-warning-text)] mb-2"
            >
              <span class="font-medium">{{ $t('admin.reason') }}:</span>
              {{ user.rejectionReason || user.suspensionReason }}
            </p>

            <!-- Artwork preview (small style) -->
            <div
              v-if="user.artworks && user.artworks.length > 0"
              class="grid grid-cols-4 gap-1 w-32 mb-2"
            >
              <NuxtLink
                v-for="artwork in user.artworks.slice(0, 4)"
                :key="artwork.id"
                :to="`/artworks/${artwork.id}`"
                class="aspect-square overflow-hidden rounded bg-[var(--color-surface-secondary)]"
              >
                <img
                  v-if="artwork.images && artwork.images[0]"
                  :src="getArtworkThumbnailUrl(artwork)"
                  :alt="artwork.title"
                  class="w-full h-full object-cover"
                />
              </NuxtLink>
            </div>

            <!-- User stats -->
            <div class="flex gap-4 text-sm text-[var(--color-text-secondary)]">
              <span>{{ $t('admin.artworksCount', { count: user._count?.artworks || 0 }) }}</span>
              <span>{{ $t('admin.followersCount', { count: user._count?.followers || 0 }) }}</span>
              <span>{{ $t('admin.followingCount', { count: user._count?.following || 0 }) }}</span>
            </div>
          </div>

          <!-- Action buttons (only for local users) -->
          <div v-if="!user.domain" class="flex flex-col gap-2 shrink-0">
            <!-- Approve button (pending users) -->
            <button
              v-if="isPending(user)"
              @click="openModerationModal('approve', user)"
              class="px-4 py-2 bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] hover:bg-[var(--color-button-success)] hover:text-white hover:border-[var(--color-button-success)] rounded-lg text-sm whitespace-nowrap"
            >
              {{ $t('admin.approve') }}
            </button>

            <!-- Reject button (pending users) -->
            <button
              v-if="isPending(user)"
              @click="openModerationModal('reject', user)"
              class="px-4 py-2 bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-hover-bg)] hover:text-[var(--color-danger-hover-text)] rounded-lg text-sm whitespace-nowrap"
            >
              {{ $t('admin.reject') }}
            </button>

            <!-- Suspend button (active users) -->
            <button
              v-if="isActive(user) && user.role !== 'ADMIN'"
              @click="openModerationModal('suspend', user)"
              class="px-4 py-2 bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning-text)] hover:bg-[var(--color-button-warning)] hover:text-white hover:border-[var(--color-button-warning)] rounded-lg text-sm whitespace-nowrap"
            >
              {{ $t('admin.suspend') }}
            </button>

            <!-- Activate button (suspended users) -->
            <button
              v-if="isSuspended(user)"
              @click="openModerationModal('activate', user)"
              class="px-4 py-2 bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)] hover:bg-[var(--color-button-success)] hover:text-white hover:border-[var(--color-button-success)] rounded-lg text-sm whitespace-nowrap"
            >
              {{ $t('admin.activate') }}
            </button>

            <!-- Set Tier button (all local users except admins) -->
            <button
              v-if="user.role !== 'ADMIN'"
              @click="openTierModal(user)"
              class="px-4 py-2 bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white rounded-lg text-sm whitespace-nowrap"
            >
              {{ $t('admin.setTier') }}
            </button>
          </div>

          <!-- Remote user info -->
          <div v-else class="flex flex-col gap-1 shrink-0 text-right">
            <span class="text-xs text-[var(--color-text-muted)]">{{ $t('admin.remoteUser') }}</span>
            <a
              :href="`https://${user.domain}/@${user.username}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-[var(--color-primary)] hover:underline"
            >
              {{ $t('admin.viewOnOriginalServer') }}
            </a>
          </div>
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

    <!-- User Moderation Modal -->
    <UserModerationModal
      :show="moderationModal.show"
      :action="moderationModal.action"
      :username="moderationModal.username"
      @confirm="handleModerationAction"
      @close="closeModerationModal"
    />

    <!-- User Tier Modal -->
    <UserTierModal
      :show="tierModal.show"
      :username="tierModal.username"
      :current-tier="tierModal.currentTier"
      @confirm="handleTierChange"
      @close="closeTierModal"
    />
  </div>
</template>

<script setup lang="ts">
import type { UserInfo } from '~/composables/useUserModeration'

const { t } = useI18n()
const { getAllUsers, approveUser, rejectUser, suspendUser, activateUser } = useUserModeration()
const { getSignedUrl } = useSignedImageUrlOnce()
const { getUserPathFromUser } = useUsername()
const api = useApi()

const signedArtworkUrls = ref<Map<string, string>>(new Map())

const fetchSignedArtworkUrls = async (userList: UserInfo[]) => {
  const artworkImages: { artworkId: string; imageId: string }[] = []

  for (const user of userList) {
    if (user.artworks) {
      for (const artwork of user.artworks) {
        if (artwork.images?.[0]?.id && !signedArtworkUrls.value.has(artwork.id)) {
          artworkImages.push({ artworkId: artwork.id, imageId: artwork.images[0].id })
        }
      }
    }
  }

  await Promise.all(
    artworkImages.map(async ({ artworkId, imageId }) => {
      try {
        const signedUrl = await getSignedUrl(imageId, true)
        signedArtworkUrls.value.set(artworkId, signedUrl)
      } catch (error) {
        console.error(`Failed to get signed URL for artwork ${artworkId}:`, error)
      }
    })
  )
}

const getArtworkThumbnailUrl = (artwork: { id: string; images?: { id?: string; thumbnailUrl: string }[] }) => {
  return signedArtworkUrls.value.get(artwork.id) || artwork.images?.[0]?.thumbnailUrl || ''
}

const successMessage = ref<string | null>(null)
const submitError = ref<string | null>(null)

const users = ref<UserInfo[]>([])
const usersLoading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)

const userFilters = reactive({
  status: 'all' as 'all' | 'pending' | 'active' | 'suspended' | 'rejected',
  location: 'all' as 'all' | 'local' | 'remote',
  search: ''
})

const moderationModal = reactive({
  show: false,
  action: 'approve' as 'approve' | 'reject' | 'suspend' | 'activate',
  userId: '',
  username: ''
})

const tierModal = reactive({
  show: false,
  userId: '',
  username: '',
  currentTier: 'NONE' as 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'
})

const userStats = computed(() => ({
  total: total.value,
  local: users.value.filter(u => !u.domain).length,
  remote: users.value.filter(u => !!u.domain).length,
  pending: users.value.filter(u => isPending(u)).length,
  active: users.value.filter(u => isActive(u)).length,
  suspended: users.value.filter(u => isSuspended(u)).length,
  rejected: users.value.filter(u => isRejected(u)).length
}))

const usersEmptyMessage = computed(() => {
  if (userFilters.status === 'pending') return t('admin.noPendingUsers')
  if (userFilters.status === 'active') return t('admin.noActiveUsers')
  if (userFilters.status === 'suspended') return t('admin.noSuspendedUsers')
  if (userFilters.status === 'rejected') return t('admin.noRejectedUsers')
  return t('admin.noUsersFound')
})

const isPending = (user: UserInfo) =>
  !user.isActive && !user.approvedAt && !user.rejectedAt

const isActive = (user: UserInfo) =>
  user.isActive && !user.suspendedAt

const isSuspended = (user: UserInfo) =>
  !!user.suspendedAt

const isRejected = (user: UserInfo) =>
  !!user.rejectedAt

const getUserStatusClass = (user: UserInfo) => {
  if (isPending(user)) return 'bg-[var(--color-badge-pending-bg)] text-[var(--color-badge-pending-text)]'
  if (isActive(user)) return 'bg-[var(--color-badge-active-bg)] text-[var(--color-badge-active-text)]'
  if (isSuspended(user)) return 'bg-[var(--color-badge-suspended-bg)] text-[var(--color-badge-suspended-text)]'
  if (isRejected(user)) return 'bg-[var(--color-badge-rejected-bg)] text-[var(--color-badge-rejected-text)]'
  return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]'
}

const getUserStatusText = (user: UserInfo) => {
  if (isPending(user)) return t('admin.pending')
  if (isActive(user)) return t('admin.active')
  if (isSuspended(user)) return t('admin.suspended')
  if (isRejected(user)) return t('admin.rejected')
  return t('admin.modeUnknown')
}

const loadUsers = async () => {
  usersLoading.value = true

  try {
    const response = await getAllUsers({
      ...userFilters,
      page: currentPage.value,
      limit: 20
    })

    users.value = response.users
    total.value = response.total
    totalPages.value = response.totalPages

    await fetchSignedArtworkUrls(response.users)
  } catch (error: any) {
    console.error('Failed to load users:', error)
  } finally {
    usersLoading.value = false
  }
}

let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    loadUsers()
  }, 500)
}

const goToPage = (page: number) => {
  currentPage.value = page
  loadUsers()
}

const openModerationModal = (action: typeof moderationModal.action, user: UserInfo) => {
  moderationModal.show = true
  moderationModal.action = action
  moderationModal.userId = user.id
  moderationModal.username = user.username
}

const closeModerationModal = () => {
  moderationModal.show = false
  moderationModal.action = 'approve'
  moderationModal.userId = ''
  moderationModal.username = ''
}

const handleModerationAction = async (password: string, reason?: string) => {
  try {
    const { action, userId, username } = moderationModal

    if (action === 'approve') {
      await approveUser(userId, password)
      successMessage.value = t('admin.userApproved', { username })
    } else if (action === 'reject') {
      await rejectUser(userId, password, reason || '')
      successMessage.value = t('admin.userRejected', { username })
    } else if (action === 'suspend') {
      await suspendUser(userId, password, reason || '')
      successMessage.value = t('admin.userSuspended', { username })
    } else if (action === 'activate') {
      await activateUser(userId, password)
      successMessage.value = t('admin.userActivated', { username })
    }

    closeModerationModal()
    await loadUsers()

    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (error: any) {
    console.error('Moderation action failed:', error)
    submitError.value = error.message || t('admin.moderationFailed')
    setTimeout(() => {
      submitError.value = null
    }, 5000)
  }
}
const openTierModal = (user: UserInfo) => {
  tierModal.show = true
  tierModal.userId = user.id
  tierModal.username = user.username
  tierModal.currentTier = (user.supporterTier as any) || 'NONE'
}

const closeTierModal = () => {
  tierModal.show = false
  tierModal.userId = ''
  tierModal.username = ''
  tierModal.currentTier = 'NONE'
}

const handleTierChange = async (tier: string, password: string) => {
  try {
    const { userId, username } = tierModal

    await api.post(`/api/admin/users/${userId}/set-tier`, { tier, password })

    successMessage.value = t('admin.userTierChanged', { username, tier: t(`supporter.${tier.toLowerCase()}`) })
    closeTierModal()
    await loadUsers()

    setTimeout(() => {
      successMessage.value = null
    }, 3000)
  } catch (error: any) {
    console.error('Tier change failed:', error)
    submitError.value = error.message || t('admin.tierChangeFailed')
    setTimeout(() => {
      submitError.value = null
    }, 5000)
  }
}

onMounted(() => {
  loadUsers()
})
</script>
