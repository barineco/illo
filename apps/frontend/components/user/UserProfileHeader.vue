<template>
  <div>
    <!-- Cover Image -->
    <div
      class="h-64 bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg mb-6 relative overflow-hidden"
    >
      <img
        v-if="user.coverImageUrl"
        :src="user.coverImageUrl"
        alt="Cover"
        class="w-full h-full object-cover"
      />
    </div>

    <!-- Profile Header -->
    <div class="flex items-start gap-6 mb-8">
      <!-- Avatar -->
      <div class="w-32 h-32 rounded-full bg-[var(--color-surface-secondary)] -mt-16 border-4 border-[var(--color-background)] flex-shrink-0 overflow-hidden relative z-10 flex items-center justify-center">
        <img
          v-if="user.avatarUrl"
          :src="user.avatarUrl"
          :alt="user.username"
          class="w-full h-full object-cover"
        />
        <Icon v-else name="UserCircle" class="w-20 h-20 text-[var(--color-text-muted)]" />
      </div>

      <!-- User Info -->
      <div class="flex-1 pt-4">
        <div class="flex items-center gap-3 mb-2">
          <h1 class="text-3xl font-bold">{{ user.displayName }}</h1>
          <!-- Supporter Badge -->
          <SupporterBadge :tier="user.supporterTier" :show-label="true" />
          <!-- Remote user badge -->
          <span
            v-if="user.domain"
            class="px-2 py-1 text-xs bg-[var(--color-badge-remote-bg)] text-[var(--color-badge-remote-text)] rounded"
          >
            {{ $t('user.remote') }}
          </span>
        </div>
        <div class="text-[var(--color-text-muted)] mb-4">{{ formatUserHandle(user) }}</div>

        <p v-if="user.bio" class="text-[var(--color-text)] mb-4 max-w-2xl whitespace-pre-wrap">
          {{ user.bio }}
        </p>

        <!-- Social Links -->
        <div v-if="hasSocialLinks" class="flex flex-wrap items-center gap-3 mb-4">
          <!-- Bluesky -->
          <a
            v-if="user.socialLinks?.bluesky || user.blueskyHandle"
            :href="`https://bsky.app/profile/${user.blueskyHandle || user.socialLinks?.bluesky}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-hover)] rounded-full text-sm transition-colors"
            :title="user.blueskyVerified ? $t('user.blueskyVerified') : 'Bluesky'"
          >
            <BlueskyIcon class="w-4 h-4 text-[var(--color-bluesky)]" />
            <span>{{ user.blueskyHandle || user.socialLinks?.bluesky }}</span>
            <Icon v-if="user.blueskyVerified" name="CheckBadge" solid class="w-4 h-4 text-[var(--color-bluesky)]" />
          </a>

          <!-- Custom Links -->
          <a
            v-for="(link, index) in user.socialLinks?.customLinks"
            :key="index"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-hover)] rounded-full text-sm transition-colors"
            :title="link.url"
          >
            <img
              :src="getFaviconUrl(link.url)"
              :alt="link.title"
              class="w-4 h-4"
              @error="handleFaviconError"
            />
            <span>{{ link.title }}</span>
            <Icon name="ArrowTopRightOnSquare" class="w-3 h-3" />
          </a>
        </div>

        <!-- Tools Used (Collapsible) -->
        <div v-if="user.toolsUsed && user.toolsUsed.length > 0" class="mb-4">
          <button
            type="button"
            class="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            @click="showTools = !showTools"
          >
            <Icon name="Wrench" class="w-4 h-4" />
            <span>{{ $t('user.toolsUsed') }}</span>
            <Icon
              :name="showTools ? 'ChevronUp' : 'ChevronDown'"
              class="w-4 h-4"
            />
          </button>
          <div v-if="showTools" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="tool in user.toolsUsed"
              :key="tool"
              class="px-2 py-1 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded"
            >
              {{ tool }}
            </span>
          </div>
        </div>

        <!-- Stats -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <button
            v-if="isOwnProfile"
            @click="$emit('selectTab', 'artworks')"
            class="hover:text-[var(--color-primary)] transition-colors"
          >
            <span class="font-bold">{{ user.artworksCount }}</span>
            <span class="text-[var(--color-text-muted)] ml-1">{{ $t('user.works') }}</span>
          </button>
          <div v-else>
            <span class="font-bold">{{ user.artworksCount }}</span>
            <span class="text-[var(--color-text-muted)] ml-1">{{ $t('user.works') }}</span>
          </div>

          <button
            @click="$emit('selectStat', 'followers')"
            class="transition-colors"
            :class="activeStat === 'followers' ? 'text-[var(--color-primary)]' : 'hover:text-[var(--color-primary)]'"
          >
            <span class="font-bold">{{ formatCount(user.followersCount) }}</span>
            <span class="ml-1" :class="activeStat === 'followers' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'">{{ $t('user.followers') }}</span>
          </button>

          <button
            @click="$emit('selectStat', 'following')"
            class="transition-colors"
            :class="activeStat === 'following' ? 'text-[var(--color-primary)]' : 'hover:text-[var(--color-primary)]'"
          >
            <span class="font-bold">{{ formatCount(user.followingCount) }}</span>
            <span class="ml-1" :class="activeStat === 'following' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'">{{ $t('user.following') }}</span>
          </button>

          <!-- Registration Date -->
          <div class="flex items-center gap-1 text-[var(--color-text-muted)]">
            <Icon name="Calendar" class="w-4 h-4" />
            <span>{{ $t('user.joinedOn') }}: {{ formatDate(user.createdAt) }}</span>
          </div>

          <!-- Remote Instance Info -->
          <a
            v-if="user.domain"
            :href="`https://${user.domain}/@${user.username}`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            <Icon name="GlobeAlt" class="w-4 h-4" />
            <span>{{ user.domain }}</span>
            <Icon name="ArrowTopRightOnSquare" class="w-3 h-3" />
          </a>
        </div>
      </div>

      <!-- Action Buttons slot -->
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import BlueskyIcon from '~/components/icons/BlueskyIcon.vue'

interface CustomLink {
  url: string
  title: string
}

interface SocialLinks {
  bluesky?: string
  customLinks?: CustomLink[]
}

interface ProfileUser {
  id: string
  username: string
  domain?: string | null
  displayName: string
  bio?: string
  avatarUrl?: string
  coverImageUrl?: string
  socialLinks?: SocialLinks | null
  blueskyHandle?: string | null
  blueskyVerified?: boolean
  followersCount: number
  followingCount: number
  artworksCount: number
  createdAt: Date
  toolsUsed?: string[]
  supporterTier?: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'
}

const props = defineProps<{
  user: ProfileUser
  isOwnProfile: boolean
  activeStat?: 'following' | 'followers' | null
}>()

defineEmits<{
  (e: 'selectTab', tab: string): void
  (e: 'selectStat', stat: 'following' | 'followers'): void
}>()

const { formatUserHandle } = useUsername()

// Tools visibility state
const showTools = ref(false)

// Check if user has any social links to display
const hasSocialLinks = computed(() => {
  if (!props.user) return false
  return !!(
    props.user.socialLinks?.bluesky ||
    props.user.socialLinks?.customLinks?.length ||
    props.user.blueskyHandle
  )
})

// Helper: Get favicon URL from Google's favicon API
const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

// Helper: Handle favicon load error
const handleFaviconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  // Hide broken favicon
  img.style.display = 'none'
}

// Format count with K suffix
const formatCount = (count: number): string => {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

// Format date
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}
</script>
