<template>
  <div class="pt-4 flex items-center gap-2">
    <!-- Follow button for other users -->
    <IconButton
      v-if="!isOwnProfile && currentUser"
      :variant="isFollowing ? 'secondary' : 'primary'"
      size="lg"
      shape="circle"
      :disabled="isLoadingFollow"
      :aria-label="isFollowing ? $t('user.unfollow') : $t('user.follow')"
      :title="isFollowing ? $t('user.unfollow') : $t('user.follow')"
      @click="toggleFollow"
    >
      <Icon :name="isFollowing ? 'UserMinus' : 'UserPlus'" class="w-5 h-5" />
    </IconButton>

    <!-- Edit Profile Button for own profile -->
    <IconButton
      v-else-if="isOwnProfile"
      variant="secondary"
      size="lg"
      shape="circle"
      :aria-label="$t('user.editProfile')"
      :title="$t('user.editProfile')"
      @click="navigateTo('/settings')"
    >
      <Icon name="PencilSquare" class="w-5 h-5" />
    </IconButton>

    <!-- User Menu Button -->
    <div class="relative">
      <IconButton
        variant="secondary"
        size="lg"
        shape="circle"
        :aria-label="$t('user.menu')"
        :title="$t('user.menu')"
        @click.stop="toggleUserMenu"
      >
        <Icon name="EllipsisVertical" class="w-5 h-5" />
      </IconButton>

      <!-- Dropdown Menu -->
      <div
        v-if="isUserMenuOpen"
        class="absolute right-0 top-full mt-1 bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-border)] overflow-hidden min-w-[180px] z-50"
      >
        <!-- Share Profile -->
        <button
          @click.stop="shareProfile"
          class="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3"
        >
          <Icon name="Share" class="w-4 h-4" />
          {{ $t('user.copyLink') }}
        </button>

        <!-- Send Message (if logged in and not own profile) -->
        <button
          v-if="currentUser && !isOwnProfile"
          :disabled="isNavigatingToMessage"
          class="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3 disabled:opacity-50"
          @click.stop="navigateToMessage"
        >
          <Icon name="Envelope" class="w-4 h-4" />
          {{ isNavigatingToMessage ? $t('common.loading') : $t('user.sendMessage') }}
        </button>

        <!-- Mute/Unmute User (if logged in and not own profile) -->
        <button
          v-if="currentUser && !isOwnProfile"
          @click.stop="toggleMuteUser"
          class="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3"
          :class="{ 'text-[var(--color-warning-text)]': isMuted }"
        >
          <Icon :name="isMuted ? 'SpeakerWave' : 'SpeakerXMark'" class="w-4 h-4" />
          {{ isMuted ? $t('user.unmuteUser') : $t('user.muteUser') }}
        </button>

        <!-- Report User (if logged in and not own profile) -->
        <button
          v-if="currentUser && !isOwnProfile"
          @click.stop="openReportModal"
          class="w-full px-4 py-3 text-left text-sm hover:bg-[var(--color-hover)] transition-colors flex items-center gap-3 text-[var(--color-danger-text)]"
        >
          <Icon name="Flag" class="w-4 h-4" />
          {{ $t('user.reportUser') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface ProfileUser {
  id: string
  username: string
  domain?: string | null
  displayName: string
}

const props = defineProps<{
  user: ProfileUser
  isOwnProfile: boolean
  isFollowing: boolean
  isLoadingFollow: boolean
  isMuted: boolean
}>()

const emit = defineEmits<{
  (e: 'update:isFollowing', value: boolean): void
  (e: 'toggleFollow'): void
  (e: 'toggleMute'): void
  (e: 'openReport'): void
}>()

const { t } = useI18n()
const { user: currentUser } = useAuth()
const { addToast } = useToast()
const api = useApi()

const isUserMenuOpen = ref(false)
const isNavigatingToMessage = ref(false)

const getUserHandle = (user: ProfileUser) => {
  if (!user) return ''
  return user.domain ? `${user.username}@${user.domain}` : user.username
}

const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

const closeUserMenu = () => {
  isUserMenuOpen.value = false
}

const toggleFollow = () => {
  emit('toggleFollow')
}

const shareProfile = async () => {
  try {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    addToast({
      type: 'success',
      message: t('user.linkCopied'),
    })
  } catch (error) {
    console.error('Failed to copy link:', error)
    addToast({
      type: 'error',
      message: t('user.linkCopyFailed'),
    })
  }
  closeUserMenu()
}

const toggleMuteUser = async () => {
  emit('toggleMute')
  closeUserMenu()
}

const openReportModal = () => {
  closeUserMenu()
  emit('openReport')
}

const navigateToMessage = async () => {
  if (isNavigatingToMessage.value) return

  isNavigatingToMessage.value = true
  try {
    const existingResponse = await api.get<{ conversation: { id: string } | null }>(
      `/api/messages/conversation-with/${props.user.id}`,
    )

    if (existingResponse.conversation) {
      await navigateTo(`/messages/${existingResponse.conversation.id}`)
    } else {
      const newConversation = await api.post<{ id: string }>('/api/messages/conversations', {
        recipientId: props.user.id,
      })
      await navigateTo(`/messages/${newConversation.id}`)
    }
  } catch (error) {
    console.error('Failed to navigate to message:', error)
    addToast({
      type: 'error',
      message: t('messages.error.failedToOpen'),
    })
  } finally {
    isNavigatingToMessage.value = false
    closeUserMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', closeUserMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeUserMenu)
})
</script>
