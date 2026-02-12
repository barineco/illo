<template>
  <div :class="['comment-item', { 'ml-12': isReply }]">
    <div class="flex gap-3">
      <!-- Avatar -->
      <NuxtLink :to="`/users/${comment.user.username}`">
        <img
          v-if="comment.user.avatarUrl"
          :src="comment.user.avatarUrl"
          :alt="comment.user.username"
          class="w-10 h-10 rounded-full"
        />
        <div v-else class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
          <Icon name="UserCircle" class="w-6 h-6 text-[var(--color-text-muted)]" />
        </div>
      </NuxtLink>

      <div class="flex-1">
        <!-- User Info & Timestamp -->
        <div class="flex items-center gap-2 mb-1">
          <NuxtLink
            :to="`/users/${comment.user.username}`"
            class="font-medium hover:text-[var(--color-primary)]"
          >
            {{ comment.user.displayName || comment.user.username }}
          </NuxtLink>
          <span class="text-sm text-[var(--color-text-muted)]">@{{ comment.user.username }}</span>
          <span class="text-sm text-[var(--color-text-muted)]">·</span>
          <span class="text-sm text-[var(--color-text-muted)]">{{ formatDate(comment.createdAt) }}</span>
          <span v-if="comment.updatedAt !== comment.createdAt" class="text-sm text-[var(--color-text-muted)]">
            ({{ $t('comment.edited') }})
          </span>
        </div>

        <!-- Comment Content -->
        <div v-if="!isEditing" class="text-[var(--color-text)] whitespace-pre-wrap break-words">
          {{ comment.content }}
        </div>

        <!-- Edit Form -->
        <div v-else class="mt-2">
          <textarea
            v-model="editContent"
            class="w-full px-3 py-2 bg-[var(--color-surface-secondary)] rounded border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none resize-none"
            rows="3"
          ></textarea>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-sm text-[var(--color-text-muted)]">{{ editContent.length }}/1000</span>
            <div class="flex gap-2 ml-auto">
              <button
                @click="saveEdit"
                :disabled="!editContent.trim() || editContent.length > 1000"
                class="px-4 py-1 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-hover)] rounded font-medium transition-colors text-sm disabled:opacity-50"
              >
                {{ $t('common.save') }}
              </button>
              <button
                @click="cancelEdit"
                class="px-4 py-1 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded font-medium transition-colors text-sm"
              >
                {{ $t('common.cancel') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-4 mt-2 text-sm">
          <button
            v-if="isAuthenticated && !isReply"
            @click="toggleReplyForm"
            class="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            {{ $t('comment.reply') }}
          </button>

          <button
            v-if="isOwnComment && !isEditing"
            @click="startEdit"
            class="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            {{ $t('common.edit') }}
          </button>

          <button
            v-if="isOwnComment"
            @click="$emit('delete', comment.id)"
            class="text-[var(--color-text-muted)] hover:text-[var(--color-danger-text)] transition-colors"
          >
            {{ $t('common.delete') }}
          </button>
        </div>

        <!-- Reply Form -->
        <div v-if="showReplyForm" class="mt-4">
          <textarea
            v-model="replyContent"
            :placeholder="$t('comment.replyPlaceholder')"
            class="w-full px-3 py-2 bg-[var(--color-surface-secondary)] rounded border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none resize-none"
            rows="3"
          ></textarea>
          <div class="flex items-center gap-2 mt-2">
            <span class="text-sm text-[var(--color-text-muted)]">{{ replyContent.length }}/1000</span>
            <div class="flex gap-2 ml-auto">
              <button
                @click="submitReply"
                :disabled="!replyContent.trim() || replyContent.length > 1000"
                class="px-4 py-1 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-hover)] rounded font-medium transition-colors text-sm disabled:opacity-50"
              >
                {{ $t('comment.reply') }}
              </button>
              <button
                @click="toggleReplyForm"
                class="px-4 py-1 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded font-medium transition-colors text-sm"
              >
                {{ $t('common.cancel') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Nested Replies -->
        <div v-if="comment.replies && comment.replies.length > 0" class="mt-4 space-y-4">
          <CommentItem
            v-for="reply in comment.replies"
            :key="reply.id"
            :comment="reply"
            :artworkId="artworkId"
            :isReply="true"
            @delete="$emit('delete', $event)"
            @update="(id, content) => $emit('update', id, content)"
            @replied="$emit('replied')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentWithUser } from '@illo/shared'

const { t } = useI18n()

const props = defineProps<{
  comment: CommentWithUser
  artworkId: string
  isReply?: boolean
}>()

const emit = defineEmits<{
  reply: [comment: CommentWithUser]
  delete: [commentId: string]
  update: [commentId: string, content: string]
  replied: []
}>()

const api = useApi()
const { isAuthenticated, user } = useAuth()

const showReplyForm = ref(false)
const replyContent = ref('')
const isEditing = ref(false)
const editContent = ref(props.comment.content)

const isOwnComment = computed(() => {
  return isAuthenticated.value && user.value?.id === props.comment.userId
})

const toggleReplyForm = () => {
  showReplyForm.value = !showReplyForm.value
  if (!showReplyForm.value) {
    replyContent.value = ''
  }
}

const submitReply = async () => {
  if (!replyContent.value.trim() || replyContent.value.length > 1000) return

  try {
    await api.post(`/api/comments/artwork/${props.artworkId}`, {
      content: replyContent.value,
      parentId: props.comment.id,
    })

    replyContent.value = ''
    showReplyForm.value = false
    // Trigger reload (親コンポーネントで処理)
    emit('replied')
  } catch (error) {
    console.error('Failed to submit reply:', error)
    alert(t('comment.replyFailed'))
  }
}

const startEdit = () => {
  isEditing.value = true
  editContent.value = props.comment.content
}

const cancelEdit = () => {
  isEditing.value = false
  editContent.value = props.comment.content
}

const saveEdit = () => {
  if (!editContent.value.trim() || editContent.value.length > 1000) return
  emit('update', props.comment.id, editContent.value)
  isEditing.value = false
}

const formatDate = (dateInput: string | Date) => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return date.toLocaleDateString()
  } else if (days > 0) {
    return t('time.daysAgo', { n: days })
  } else if (hours > 0) {
    return t('time.hoursAgo', { n: hours })
  } else if (minutes > 0) {
    return t('time.minutesAgo', { n: minutes })
  } else {
    return t('time.justNow')
  }
}
</script>
