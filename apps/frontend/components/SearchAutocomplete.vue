<template>
  <div class="relative w-full" v-click-outside="closeDropdown">
    <!-- 検索入力 -->
    <input
      ref="searchInput"
      v-model="query"
      @input="handleInput"
      @keydown="handleKeydown"
      @focus="isOpen = true"
      type="search"
      :placeholder="$t('search.placeholder')"
      class="w-full px-4 py-2 bg-[var(--color-background)] rounded-full border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
    />

    <!-- ドロップダウン結果 -->
    <div
      v-if="isOpen && (loading || results)"
      class="absolute top-full left-0 right-0 mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl max-h-[32rem] overflow-y-auto z-50"
    >
      <!-- ローディング状態 -->
      <div
        v-if="loading"
        class="px-4 py-3 text-[var(--color-text-muted)] flex items-center justify-center"
      >
        <Icon name="MagnifyingGlass" class="w-5 h-5 mr-2 animate-pulse" />
        <span>{{ $t('search.searching') }}</span>
      </div>

      <!-- 結果 -->
      <div v-else-if="results && query.trim().length > 0">
        <!-- リモートオプション（パターン検出時） -->
        <button
          v-if="results.remoteOption"
          @click="handleRemoteOptionClick"
          :class="[
            'w-full px-4 py-3 text-left hover:bg-[var(--color-hover)] transition-colors border-b border-[var(--color-border)] flex items-center gap-3',
            { 'bg-[var(--color-surface-secondary)]': selectedIndex === -1 },
          ]"
        >
          <Icon name="GlobeAlt" class="w-6 h-6" />
          <div class="flex-1">
            <div class="font-medium text-[var(--color-primary)]">
              {{ results.remoteOption.label }}
            </div>
            <div class="text-sm text-[var(--color-text-muted)]">{{ $t('search.showRemoteContent') }}</div>
          </div>
        </button>

        <!-- ローカルユーザー -->
        <div v-if="results.users?.users.length">
          <div
            class="px-4 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wide bg-[var(--color-surface-tertiary)]"
          >
            {{ $t('search.users') }}
          </div>
          <button
            v-for="(user, index) in results.users.users"
            :key="user.id"
            @click="selectUser(user)"
            :class="[
              'w-full px-4 py-3 text-left hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3',
              { 'bg-[var(--color-surface-secondary)]': selectedIndex === index },
            ]"
          >
            <img
              :src="user.avatarUrl || '/default-avatar.png'"
              :alt="user.username"
              class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)]"
            />
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">
                {{ user.displayName || user.username }}
              </div>
              <div class="text-sm text-[var(--color-text-muted)] truncate">{{ user.handle }}</div>
            </div>
          </button>
        </div>

        <!-- ローカル作品 -->
        <div v-if="results.artworks?.artworks.length">
          <div
            class="px-4 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wide bg-[var(--color-surface-tertiary)]"
          >
            {{ $t('search.artworks') }}
          </div>
          <button
            v-for="(artwork, index) in results.artworks.artworks"
            :key="artwork.id"
            @click="selectArtwork(artwork)"
            :class="[
              'w-full px-4 py-3 text-left hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3',
              {
                'bg-[var(--color-surface-secondary)]':
                  selectedIndex === (results.users?.users.length || 0) + index,
              },
            ]"
          >
            <img
              :src="artwork.thumbnailUrl"
              :alt="artwork.title"
              class="w-16 h-12 object-cover rounded bg-[var(--color-surface-secondary)]"
            />
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ artwork.title }}</div>
              <div class="text-sm text-[var(--color-text-muted)] truncate">
                by {{ artwork.author.displayName || artwork.author.username }}
              </div>
            </div>
          </button>
        </div>

        <!-- 結果なし -->
        <div
          v-if="
            !results.remoteOption &&
            !results.users?.users.length &&
            !results.artworks?.artworks.length
          "
          class="px-4 py-8 text-center text-[var(--color-text-muted)]"
        >
          <Icon name="MagnifyingGlass" class="w-8 h-8 mx-auto mb-2" />
          <div>{{ $t('search.noResultsGeneric') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'

const { t } = useI18n()
const router = useRouter()

const query = ref('')
const results = ref<any>(null)
const isOpen = ref(false)
const loading = ref(false)
const selectedIndex = ref(-1)
const searchInput = ref<HTMLInputElement>()

// クリック外側のディレクティブ
const vClickOutside = {
  mounted(el: any, binding: any) {
    el.clickOutsideEvent = (event: Event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value()
      }
    }
    document.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el: any) {
    document.removeEventListener('click', el.clickOutsideEvent)
  },
}

// デバウンス検索（300ms）
const debouncedSearch = useDebounceFn(async () => {
  if (!query.value || query.value.trim().length === 0) {
    results.value = null
    return
  }

  loading.value = true
  try {
    // Use relative path to leverage Nginx reverse proxy (same origin)
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query.value)}&limit=5`,
    )

    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`)
    }

    results.value = await response.json()
    selectedIndex.value = -1
  } catch (error) {
    console.error('Search failed:', error)
    results.value = null
  } finally {
    loading.value = false
  }
}, 300)

const handleInput = () => {
  isOpen.value = true
  debouncedSearch()
}

const closeDropdown = () => {
  isOpen.value = false
}

/**
 * Build user profile URL
 * For local users: /users/username
 * For remote users: /users/username@domain
 */
const getUserProfileUrl = (user: any) => {
  const handle = user.domain ? `${user.username}@${user.domain}` : user.username
  return `/users/${handle}`
}

const selectUser = (user: any) => {
  router.push(getUserProfileUrl(user))
  closeDropdown()
  query.value = ''
}

const selectArtwork = (artwork: any) => {
  router.push(`/artworks/${artwork.id}`)
  closeDropdown()
  query.value = ''
}

const handleRemoteOptionClick = async () => {
  if (!results.value?.remoteOption) return

  const option = results.value.remoteOption

  try {
    if (option.type === 'remote_user') {
      // リモートユーザーを解決
      // Use relative path to leverage Nginx reverse proxy (same origin)
      const response = await fetch(`/api/search/resolve-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          handle: option.handle || query.value,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to resolve remote user')
      }

      const data = await response.json()

      if (data.success && data.user) {
        // ユーザーページに遷移
        router.push(getUserProfileUrl(data.user))
        closeDropdown()
        query.value = ''
      } else {
        alert(t('search.remoteUserFailed', { error: data.error || t('common.error') }))
      }
    } else {
      // その他のリモートコンテンツ（作品、ドメインなど）
      alert(t('search.remoteTypeNotImplemented', { type: option.type }))
    }
  } catch (error) {
    console.error('Failed to resolve remote content:', error)
    alert(t('search.remoteContentError'))
  } finally {
    closeDropdown()
  }
}

// キーボードナビゲーション
const handleKeydown = (event: KeyboardEvent) => {
  if (!isOpen.value) {
    // ドロップダウンが閉じている場合、Enterで検索結果ページに遷移
    if (event.key === 'Enter' && query.value.trim()) {
      event.preventDefault()
      router.push({
        path: '/search',
        query: { q: query.value.trim() },
      })
      closeDropdown()
      return
    }
    return
  }

  if (!results.value) return

  const totalItems =
    (results.value.remoteOption ? 1 : 0) +
    (results.value.users?.users.length || 0) +
    (results.value.artworks?.artworks.length || 0)

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (totalItems > 0) {
        selectedIndex.value = Math.min(selectedIndex.value + 1, totalItems - 1)
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
      break
    case 'Enter':
      event.preventDefault()
      if (totalItems === 0 || selectedIndex.value === -1) {
        // 選択なし、またはリモートオプション選択時
        if (results.value.remoteOption && selectedIndex.value === -1) {
          handleRemoteOptionClick()
        } else if (query.value.trim()) {
          // 検索結果ページに遷移
          router.push({
            path: '/search',
            query: { q: query.value.trim() },
          })
          closeDropdown()
        }
      } else {
        // 項目選択時
        const userCount = results.value.users?.users.length || 0
        if (selectedIndex.value < userCount) {
          selectUser(results.value.users.users[selectedIndex.value])
        } else {
          selectArtwork(
            results.value.artworks.artworks[selectedIndex.value - userCount],
          )
        }
      }
      break
    case 'Escape':
      event.preventDefault()
      closeDropdown()
      searchInput.value?.blur()
      break
  }
}
</script>
