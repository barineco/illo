<template>
  <div class="space-y-6">
    <!-- User Mutes Section -->
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t('mutes.mutedUsers') }}</h2>
      <p class="text-[var(--color-text-muted)] text-sm mb-4">
        {{ $t('mutes.mutedUsersDescription') }}
      </p>

      <!-- Loading State -->
      <div v-if="loadingUsers" class="text-[var(--color-text-muted)]">
        {{ $t('common.loading') }}
      </div>

      <!-- Muted Users List -->
      <div v-else-if="mutedUsers.length > 0" class="space-y-3">
        <div
          v-for="mute in mutedUsers"
          :key="mute.id"
          class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4"
        >
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-3">
              <img
                v-if="mute.muted.avatarUrl"
                :src="mute.muted.avatarUrl"
                :alt="mute.muted.displayName || mute.muted.username"
                class="w-10 h-10 rounded-full object-cover"
              />
              <div v-else class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
                <Icon name="UserCircle" class="w-6 h-6 text-[var(--color-text-muted)]" />
              </div>
              <div>
                <p class="font-medium">{{ mute.muted.displayName || mute.muted.username }}</p>
                <p class="text-sm text-[var(--color-text-muted)]">
                  @{{ mute.muted.username }}{{ mute.muted.domain ? `@${mute.muted.domain}` : '' }}
                </p>
                <p v-if="mute.expiresAt" class="text-xs text-[var(--color-text-muted)]">
                  {{ $t('mutes.expiresAt') }}: {{ formatDate(mute.expiresAt) }}
                </p>
              </div>
            </div>
            <BaseButton
              variant="outline"
              size="sm"
              shape="rounded"
              :disabled="unmutingUserId === mute.muted.id"
              :loading="unmutingUserId === mute.muted.id"
              @click="unmuteUser(mute.muted.username, mute.muted.domain)"
            >
              {{ $t('mutes.unmute') }}
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- No Muted Users -->
      <div v-else class="text-[var(--color-text-muted)] text-sm">
        {{ $t('mutes.noMutedUsers') }}
      </div>
    </div>

    <!-- Word Mutes Section -->
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t('mutes.wordMutes') }}</h2>
      <p class="text-[var(--color-text-muted)] text-sm mb-4">
        {{ $t('mutes.wordMutesDescription') }}
      </p>

      <!-- Add Word Mute Form -->
      <div class="mb-6 p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">{{ $t('mutes.keyword') }}</label>
            <input
              v-model="newWordMute.keyword"
              type="text"
              class="w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
              :placeholder="$t('mutes.keywordPlaceholder')"
            />
          </div>

          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="newWordMute.wholeWord" type="checkbox" class="rounded" />
              <span class="text-sm">{{ $t('mutes.wholeWord') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="newWordMute.regex" type="checkbox" class="rounded" />
              <span class="text-sm">{{ $t('mutes.useRegex') }}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="newWordMute.caseSensitive" type="checkbox" class="rounded" />
              <span class="text-sm">{{ $t('mutes.caseSensitive') }}</span>
            </label>
          </div>

          <BaseButton
            variant="primary"
            size="md"
            shape="rounded"
            :disabled="!newWordMute.keyword || addingWordMute"
            :loading="addingWordMute"
            @click="addWordMute"
          >
            {{ $t('mutes.addWordMute') }}
          </BaseButton>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loadingWords" class="text-[var(--color-text-muted)]">
        {{ $t('common.loading') }}
      </div>

      <!-- Word Mutes List -->
      <div v-else-if="wordMutes.length > 0" class="space-y-3">
        <div
          v-for="mute in wordMutes"
          :key="mute.id"
          class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4"
        >
          <div class="flex justify-between items-center">
            <div>
              <p class="font-medium font-mono">{{ mute.keyword }}</p>
              <div class="flex flex-wrap gap-2 mt-1">
                <span v-if="mute.wholeWord" class="text-xs px-2 py-0.5 bg-[var(--color-surface-secondary)] rounded">
                  {{ $t('mutes.wholeWord') }}
                </span>
                <span v-if="mute.regex" class="text-xs px-2 py-0.5 bg-[var(--color-surface-secondary)] rounded">
                  {{ $t('mutes.regex') }}
                </span>
                <span v-if="mute.caseSensitive" class="text-xs px-2 py-0.5 bg-[var(--color-surface-secondary)] rounded">
                  {{ $t('mutes.caseSensitive') }}
                </span>
              </div>
              <p v-if="mute.expiresAt" class="text-xs text-[var(--color-text-muted)] mt-1">
                {{ $t('mutes.expiresAt') }}: {{ formatDate(mute.expiresAt) }}
              </p>
            </div>
            <BaseButton
              variant="outline"
              size="sm"
              shape="rounded"
              :disabled="deletingWordMuteId === mute.id"
              :loading="deletingWordMuteId === mute.id"
              @click="deleteWordMute(mute.id)"
            >
              {{ $t('common.delete') }}
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- No Word Mutes -->
      <div v-else class="text-[var(--color-text-muted)] text-sm">
        {{ $t('mutes.noWordMutes') }}
      </div>
    </div>

    <!-- Tag Mutes Section -->
    <div class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-xl font-bold mb-4">{{ $t('mutes.tagMutes') }}</h2>
      <p class="text-[var(--color-text-muted)] text-sm mb-4">
        {{ $t('mutes.tagMutesDescription') }}
      </p>

      <!-- Add Tag Mute Form -->
      <div class="mb-6 p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg">
        <div class="flex gap-4">
          <div class="flex-1">
            <label class="block text-sm font-medium mb-2">{{ $t('mutes.tagName') }}</label>
            <div class="flex gap-2">
              <span class="px-4 py-2 bg-[var(--color-surface-secondary)] rounded-lg text-[var(--color-text-muted)]">#</span>
              <input
                v-model="newTagMute"
                type="text"
                class="flex-1 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                :placeholder="$t('mutes.tagNamePlaceholder')"
                @keyup.enter="addTagMute"
              />
            </div>
          </div>
          <div class="flex items-end">
            <BaseButton
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="!newTagMute || addingTagMute"
              :loading="addingTagMute"
              @click="addTagMute"
            >
              {{ $t('mutes.addTagMute') }}
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loadingTags" class="text-[var(--color-text-muted)]">
        {{ $t('common.loading') }}
      </div>

      <!-- Tag Mutes List -->
      <div v-else-if="tagMutes.length > 0" class="flex flex-wrap gap-2">
        <div
          v-for="mute in tagMutes"
          :key="mute.id"
          class="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-full"
        >
          <span class="text-sm font-medium">#{{ mute.tag.name }}</span>
          <button
            type="button"
            class="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            :disabled="deletingTagMuteId === mute.id"
            @click="deleteTagMute(mute.tag.name)"
          >
            <Icon name="XMark" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- No Tag Mutes -->
      <div v-else class="text-[var(--color-text-muted)] text-sm">
        {{ $t('mutes.noTagMutes') }}
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-4">
      <p class="text-[var(--color-danger-text)]">{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const toast = useToast()

// User Mutes State
const loadingUsers = ref(true)
const mutedUsers = ref<any[]>([])
const unmutingUserId = ref<string | null>(null)

// Word Mutes State
const loadingWords = ref(true)
const wordMutes = ref<any[]>([])
const newWordMute = ref({
  keyword: '',
  wholeWord: false,
  regex: false,
  caseSensitive: false,
})
const addingWordMute = ref(false)
const deletingWordMuteId = ref<string | null>(null)

// Tag Mutes State
const loadingTags = ref(true)
const tagMutes = ref<any[]>([])
const newTagMute = ref('')
const addingTagMute = ref(false)
const deletingTagMuteId = ref<string | null>(null)

const error = ref('')

const fetchMutedUsers = async () => {
  loadingUsers.value = true
  try {
    const response = await api.get<{ mutes: any[] }>('/api/mutes/users')
    mutedUsers.value = response.mutes || []
  } catch (err: any) {
    console.error('Failed to fetch muted users:', err)
    error.value = err.message || t('mutes.fetchFailed')
  } finally {
    loadingUsers.value = false
  }
}

const unmuteUser = async (username: string, domain: string) => {
  const handle = domain ? `${username}@${domain}` : username
  unmutingUserId.value = handle
  error.value = ''
  try {
    await api.delete(`/api/mutes/users/${handle}`)
    toast.success(t('mutes.unmuteSuccess'))
    await fetchMutedUsers()
  } catch (err: any) {
    error.value = err.message || t('mutes.unmuteFailed')
  } finally {
    unmutingUserId.value = null
  }
}

const fetchWordMutes = async () => {
  loadingWords.value = true
  try {
    const response = await api.get<any[]>('/api/mutes/words')
    wordMutes.value = response || []
  } catch (err: any) {
    console.error('Failed to fetch word mutes:', err)
    error.value = err.message || t('mutes.fetchFailed')
  } finally {
    loadingWords.value = false
  }
}

const addWordMute = async () => {
  if (!newWordMute.value.keyword) return

  addingWordMute.value = true
  error.value = ''
  try {
    await api.post('/api/mutes/words', {
      keyword: newWordMute.value.keyword,
      wholeWord: newWordMute.value.wholeWord,
      regex: newWordMute.value.regex,
      caseSensitive: newWordMute.value.caseSensitive,
    })
    toast.success(t('mutes.wordMuteAdded'))
    newWordMute.value = { keyword: '', wholeWord: false, regex: false, caseSensitive: false }
    await fetchWordMutes()
  } catch (err: any) {
    error.value = err.message || t('mutes.addWordMuteFailed')
  } finally {
    addingWordMute.value = false
  }
}

const deleteWordMute = async (id: string) => {
  deletingWordMuteId.value = id
  error.value = ''
  try {
    await api.delete(`/api/mutes/words/${id}`)
    toast.success(t('mutes.wordMuteDeleted'))
    await fetchWordMutes()
  } catch (err: any) {
    error.value = err.message || t('mutes.deleteWordMuteFailed')
  } finally {
    deletingWordMuteId.value = null
  }
}

const fetchTagMutes = async () => {
  loadingTags.value = true
  try {
    const response = await api.get<any[]>('/api/mutes/tags')
    tagMutes.value = response || []
  } catch (err: any) {
    console.error('Failed to fetch tag mutes:', err)
    error.value = err.message || t('mutes.fetchFailed')
  } finally {
    loadingTags.value = false
  }
}

const addTagMute = async () => {
  if (!newTagMute.value) return

  addingTagMute.value = true
  error.value = ''
  try {
    await api.post(`/api/mutes/tags/${encodeURIComponent(newTagMute.value)}`, {})
    toast.success(t('mutes.tagMuteAdded'))
    newTagMute.value = ''
    await fetchTagMutes()
  } catch (err: any) {
    error.value = err.message || t('mutes.addTagMuteFailed')
  } finally {
    addingTagMute.value = false
  }
}

const deleteTagMute = async (tagName: string) => {
  deletingTagMuteId.value = tagName
  error.value = ''
  try {
    await api.delete(`/api/mutes/tags/${encodeURIComponent(tagName)}`)
    toast.success(t('mutes.tagMuteDeleted'))
    await fetchTagMutes()
  } catch (err: any) {
    error.value = err.message || t('mutes.deleteTagMuteFailed')
  } finally {
    deletingTagMuteId.value = null
  }
}

const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString)
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  fetchMutedUsers()
  fetchWordMutes()
  fetchTagMutes()
})
</script>
