<template>
  <div class="space-y-8">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin h-8 w-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg text-[var(--color-danger-text)]">
      {{ error }}
    </div>

    <template v-else>
      <!-- Security Section (integrated from SettingsSecurity) -->
      <SettingsSecuritySection />
      <!-- Account Linking Section -->
      <section class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h2 class="text-lg font-semibold mb-2">{{ $t('settings.accountLinking') }}</h2>
        <p class="text-sm text-[var(--color-text-muted)] mb-6">{{ $t('settings.accountLinkingDescription') }}</p>

        <div class="space-y-6">
          <!-- Bluesky OAuth -->
          <div class="pb-6 border-b border-[var(--color-border)]">
            <label class="flex items-center gap-2 text-sm font-medium mb-3">
              <BlueskyIcon class="w-4 h-4 text-[var(--color-bluesky)]" />
              Bluesky
            </label>

            <!-- OAuth Linked State -->
            <div v-if="currentProfile?.blueskyDid" class="space-y-3">
              <div class="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs px-2 py-0.5 bg-[var(--color-success-bg)] text-[var(--color-success-text)] rounded-full">
                      {{ $t('patreon.linked') }}
                    </span>
                    <Icon v-if="currentProfile.blueskyVerified" name="CheckBadge" class="w-4 h-4 text-[var(--color-bluesky)]" :title="$t('user.blueskyVerified')" />
                  </div>
                  <p class="text-sm mt-1">@{{ currentProfile.blueskyHandle }}</p>
                </div>
                <button
                  type="button"
                  class="flex items-center justify-center w-9 h-9 bg-[var(--color-danger-bg)] hover:bg-[var(--color-danger-hover-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] hover:text-[var(--color-danger-hover-text)] rounded-lg transition-colors disabled:opacity-50"
                  :disabled="blueskyUnlinking"
                  :title="$t('auth.bluesky.unlinkBluesky')"
                  @click="handleUnlinkBluesky"
                >
                  <Icon name="XMark" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- OAuth Link Button (when not linked) -->
            <div v-else-if="blueskyEnabled">
              <div class="flex flex-col gap-3">
                <input
                  v-model="blueskyLinkHandle"
                  type="text"
                  class="w-full px-4 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                  :placeholder="$t('auth.bluesky.handlePlaceholder')"
                  @keydown.enter.prevent="handleLinkBluesky"
                />
                <button
                  type="button"
                  class="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--color-bluesky-bg)] hover:bg-[var(--color-bluesky-bg-hover)] border border-[var(--color-bluesky-border)] text-[var(--color-bluesky)] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="blueskyLinking || !blueskyLinkHandle"
                  @click="handleLinkBluesky"
                >
                  <BlueskyIcon class="w-4 h-4" />
                  {{ blueskyLinking ? $t('common.loading') : $t('auth.bluesky.linkBluesky') }}
                </button>
              </div>
              <div v-if="blueskyLinkError" class="mt-2 text-sm text-[var(--color-danger-text)]">
                {{ blueskyLinkError }}
              </div>
            </div>

            <!-- Not available -->
            <div v-else class="text-sm text-[var(--color-text-muted)]">
              {{ $t('auth.bluesky.notConfigured') }}
            </div>
          </div>

          <!-- Patreon OAuth -->
          <div>
            <label class="flex items-center gap-2 text-sm font-medium mb-3">
              <PatreonIcon class="w-4 h-4 text-[var(--color-patreon)]" />
              {{ $t('patreon.title') }}
            </label>

            <!-- Patreon not configured -->
            <div v-if="!patreonEnabled" class="text-sm text-[var(--color-text-muted)]">
              {{ $t('patreon.notConfigured') }}
            </div>

            <!-- Patreon linked -->
            <div v-else-if="currentProfile?.patreonId" class="space-y-3">
              <div class="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)]">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs px-2 py-0.5 bg-[var(--color-success-bg)] text-[var(--color-success-text)] rounded-full">
                      {{ $t('patreon.linked') }}
                    </span>
                    <SupporterBadge v-if="currentProfile.supporterTier && currentProfile.supporterTier !== 'NONE'" :tier="currentProfile.supporterTier" :show-label="true" />
                  </div>
                  <p v-if="currentProfile.patreonLastSyncAt" class="text-xs text-[var(--color-text-muted)] mt-1">
                    {{ $t('patreon.lastSynced') }}: {{ formatDate(currentProfile.patreonLastSyncAt) }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 text-sm bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] border border-[var(--color-border)] rounded-lg transition-colors disabled:opacity-50"
                    :disabled="patreonSyncing"
                    @click="handleSyncPatreon"
                  >
                    {{ patreonSyncing ? $t('patreon.syncing') : $t('patreon.sync') }}
                  </button>
                  <button
                    type="button"
                    class="flex items-center justify-center w-9 h-9 bg-[var(--color-danger-bg)] hover:bg-[var(--color-danger-hover-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] hover:text-[var(--color-danger-hover-text)] rounded-lg transition-colors disabled:opacity-50"
                    :disabled="patreonUnlinking"
                    :title="$t('patreon.unlinkPatreon')"
                    @click="handleUnlinkPatreon"
                  >
                    <Icon name="XMark" class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p class="text-xs text-[var(--color-text-muted)]">
                {{ $t('patreon.description') }}
              </p>
            </div>

            <!-- Patreon not linked -->
            <div v-else class="space-y-3">
              <button
                type="button"
                class="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--color-patreon-bg)] hover:bg-[var(--color-patreon-hover)] border border-[var(--color-patreon-border)] text-[var(--color-patreon)] font-medium rounded-lg transition-colors disabled:opacity-50"
                :disabled="patreonLinking"
                @click="handleLinkPatreon"
              >
                <PatreonIcon class="w-4 h-4" />
                {{ patreonLinking ? $t('patreon.linking') : $t('patreon.linkPatreon') }}
              </button>
              <p class="text-xs text-[var(--color-text-muted)]">
                {{ $t('patreon.description') }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Instance Information Section -->
      <section class="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)]">
        <h2 class="text-lg font-semibold mb-2">{{ $t('settings.instanceInfo') }}</h2>
        <p class="text-sm text-[var(--color-text-muted)] mb-6">{{ $t('settings.instanceInfoDescription') }}</p>

        <div class="space-y-4">
          <!-- Contact Information -->
          <div v-if="instanceContact.contactInfo || instanceContact.adminUsername">
            <!-- Contact Text -->
            <div v-if="instanceContact.contactInfo" class="mb-4">
              <h3 class="text-sm font-medium mb-2">{{ $t('settings.instanceContact') }}</h3>
              <div class="p-3 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] text-sm whitespace-pre-wrap">
                {{ instanceContact.contactInfo }}
              </div>
            </div>

            <!-- Admin Link -->
            <div v-if="instanceContact.adminUsername">
              <h3 class="text-sm font-medium mb-2">{{ $t('settings.instanceAdmin') }}</h3>
              <NuxtLink
                :to="`/users/${instanceContact.adminUsername}`"
                class="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-background)] hover:bg-[var(--color-hover)] rounded-lg border border-[var(--color-border)] transition-colors"
              >
                <Icon name="User" class="w-4 h-4" />
                <span>@{{ instanceContact.adminUsername }}</span>
              </NuxtLink>
            </div>
          </div>

          <!-- No contact info configured -->
          <div v-else class="text-sm text-[var(--color-text-muted)]">
            {{ $t('settings.noContactInfo') }}
          </div>

          <!-- Licenses Button -->
          <div class="pt-4 border-t border-[var(--color-border)]">
            <BaseButton
              variant="outline"
              size="md"
              shape="rounded"
              @click="showLicensesModal = true"
            >
              <Icon name="DocumentText" class="w-4 h-4 mr-2" />
              {{ $t('licenses.viewLicenses') }}
            </BaseButton>
          </div>
        </div>
      </section>
    </template>

    <!-- Licenses Modal -->
    <LicensesModal
      :is-open="showLicensesModal"
      @close="showLicensesModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import BlueskyIcon from '~/components/icons/BlueskyIcon.vue'
import PatreonIcon from '~/components/icons/PatreonIcon.vue'
import SupporterBadge from '~/components/SupporterBadge.vue'

const { t } = useI18n()
const { user } = useAuth()
const api = useApi()
const toast = useToast()

const loading = ref(true)
const error = ref<string | null>(null)

// Licenses modal
const showLicensesModal = ref(false)

// Profile data
const currentProfile = ref<any>(null)

// Bluesky OAuth
const blueskyEnabled = ref(false)
const blueskyLinkHandle = ref('')
const blueskyLinking = ref(false)
const blueskyUnlinking = ref(false)
const blueskyLinkError = ref('')

// Patreon OAuth
const patreonEnabled = ref(false)
const patreonLinking = ref(false)
const patreonUnlinking = ref(false)
const patreonSyncing = ref(false)

// Instance contact info
const instanceContact = ref<{
  contactInfo: string | null
  adminUsername: string | null
}>({
  contactInfo: null,
  adminUsername: null,
})

const fetchProfile = async () => {
  if (!user.value) {
    error.value = t('settings.loginRequired')
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = null

    const profile = await api.get<any>(`/users/${user.value.username}`)
    currentProfile.value = profile
  } catch (e: any) {
    console.error('Failed to load profile:', e)
    error.value = e.message || t('settings.profileLoadFailed')
  } finally {
    loading.value = false
  }
}

const fetchInstanceContact = async () => {
  try {
    const contact = await api.get<{ contactInfo: string | null; adminUsername: string | null }>('/api/instance/contact')
    instanceContact.value = contact
  } catch {
    // Silently fail - contact info is optional
    instanceContact.value = { contactInfo: null, adminUsername: null }
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString()
}

const handleLinkPatreon = async () => {
  patreonLinking.value = true

  try {
    const { getAccessToken } = useAuth()
    const token = getAccessToken()

    const response = await fetch(`${api.baseURL}/api/patreon/auth-url`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      throw new Error(t('patreon.linkFailed'))
    }

    const data = await response.json()

    window.location.href = data.url
  } catch (err: any) {
    toast.error(err.message || t('patreon.linkFailed'))
  } finally {
    patreonLinking.value = false
  }
}

const handleSyncPatreon = async () => {
  patreonSyncing.value = true

  try {
    const result = await api.post<{ tier: string }>('/api/patreon/sync')

    if (currentProfile.value) {
      currentProfile.value.supporterTier = result.tier
      currentProfile.value.patreonLastSyncAt = new Date().toISOString()
    }

    toast.success(t('patreon.syncSuccess'))
  } catch (err: any) {
    toast.error(err.message || t('patreon.syncFailed'))
  } finally {
    patreonSyncing.value = false
  }
}

const handleUnlinkPatreon = async () => {
  if (!confirm(t('patreon.unlinkConfirm') + '\n\n' + t('patreon.unlinkConfirmMessage'))) return

  patreonUnlinking.value = true

  try {
    await api.delete('/api/patreon/unlink')

    if (currentProfile.value) {
      currentProfile.value.patreonId = null
      currentProfile.value.supporterTier = 'NONE'
      currentProfile.value.patreonLastSyncAt = null
    }

    toast.success(t('patreon.unlinkSuccess'))
  } catch (err: any) {
    toast.error(err.message || t('patreon.unlinkFailed'))
  } finally {
    patreonUnlinking.value = false
  }
}

const handleLinkBluesky = async () => {
  if (!blueskyLinkHandle.value) return

  blueskyLinking.value = true
  blueskyLinkError.value = ''

  try {
    const { getAccessToken } = useAuth()
    const token = getAccessToken()

    const response = await fetch(`${api.baseURL}/api/bluesky/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        handle: blueskyLinkHandle.value,
        mode: 'link',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || t('auth.bluesky.authFailed'))
    }

    const data = await response.json()

    window.location.href = data.url
  } catch (err: any) {
    blueskyLinkError.value = err.message || t('auth.bluesky.authFailed')
  } finally {
    blueskyLinking.value = false
  }
}

const handleUnlinkBluesky = async () => {
  if (!confirm(t('auth.bluesky.unlinkConfirm') + '\n\n' + t('auth.bluesky.unlinkConfirmMessage'))) return

  blueskyUnlinking.value = true

  try {
    await api.delete('/api/bluesky/link')

    if (currentProfile.value) {
      currentProfile.value.blueskyDid = null
      currentProfile.value.blueskyHandle = null
      currentProfile.value.blueskyVerified = false
    }

    toast.success(t('auth.bluesky.unlinkSuccess'))
  } catch (err: any) {
    toast.error(err.response?.data?.message || err.data?.message || t('common.error'))
  } finally {
    blueskyUnlinking.value = false
  }
}

onMounted(async () => {
  try {
    const status = await api.get<{ enabled: boolean }>('/api/bluesky/status')
    blueskyEnabled.value = status.enabled
  } catch {
    blueskyEnabled.value = false
  }

  try {
    const status = await api.get<{ url: string }>('/api/patreon/auth-url')
    patreonEnabled.value = !!status.url
  } catch {
    patreonEnabled.value = false
  }

  await Promise.all([
    fetchProfile(),
    fetchInstanceContact(),
  ])
})
</script>
