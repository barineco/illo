<template>
  <div class="mt-12">
    <h2 class="text-2xl font-bold mb-6">{{ $t('comment.title', { count: totalComments }) }}</h2>

    <!-- Comment Form (認証ユーザーのみ) -->
    <div v-if="isAuthenticated" class="mb-8">
      <textarea
        v-model="newCommentContent"
        :placeholder="$t('comment.placeholder')"
        class="w-full px-4 py-3 bg-[var(--color-surface-secondary)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none resize-none"
        rows="3"
        :disabled="isSubmitting"
      ></textarea>
      <div class="flex justify-between items-center mt-2">
        <span class="text-sm text-[var(--color-text-muted)]">{{ newCommentContent.length }}/1000</span>
        <button
          @click="submitComment"
          :disabled="!newCommentContent.trim() || isSubmitting || newCommentContent.length > 1000"
          class="px-6 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-hover)] rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? $t('comment.submitting') : $t('comment.submit') }}
        </button>
      </div>
    </div>

    <!-- Login Prompt (未認証ユーザー) -->
    <div v-else class="mb-8 text-center py-6 bg-[var(--color-surface)] rounded-lg">
      <p class="text-[var(--color-text-muted)] mb-3">{{ $t('comment.loginRequired') }}</p>
      <NuxtLink
        to="/login"
        class="inline-block px-6 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-hover)] rounded-full font-medium transition-colors"
      >
        {{ $t('auth.login') }}
      </NuxtLink>
    </div>

    <!-- Comments List -->
    <div v-if="isLoadingComments" class="text-center py-8">
      <p class="text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <div v-else-if="comments.length === 0" class="text-center py-8">
      <p class="text-[var(--color-text-muted)]">{{ $t('comment.noComments') }}</p>
    </div>

    <div v-else class="space-y-6">
      <CommentItem
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :artworkId="artworkId"
        @reply="handleReply"
        @delete="handleDelete"
        @update="handleUpdate"
        @replied="fetchComments"
      />
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-8">
      <button
        v-for="page in totalPages"
        :key="page"
        @click="currentPage = page"
        :class="[
          'px-4 py-2 rounded',
          currentPage === page
            ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
            : 'bg-[var(--color-surface)] hover:bg-[var(--color-hover)]'
        ]"
      >
        {{ page }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CommentWithUser } from '@open-illustboard/shared'

const props = defineProps<{
  artworkId: string
}>()

interface CommentsResponse {
  comments: CommentWithUser[]
  total: number
}

const { t } = useI18n()
const api = useApi()
const { isAuthenticated, user } = useAuth()

const comments = ref<CommentWithUser[]>([])
const newCommentContent = ref('')
const isLoadingComments = ref(true)
const isSubmitting = ref(false)
const currentPage = ref(1)
const totalComments = ref(0)
const totalPages = ref(1)
const limit = 20

const fetchComments = async () => {
  isLoadingComments.value = true
  try {
    const response = await api.get<CommentsResponse>(`/api/comments/artwork/${props.artworkId}`, {
      params: {
        page: currentPage.value,
        limit,
      },
    })

    comments.value = response.comments
    totalComments.value = response.total
    totalPages.value = Math.ceil(response.total / limit)
  } catch (error) {
    console.error('Failed to fetch comments:', error)
  } finally {
    isLoadingComments.value = false
  }
}

const submitComment = async () => {
  if (!newCommentContent.value.trim() || isSubmitting.value || newCommentContent.value.length > 1000) return

  isSubmitting.value = true
  try {
    await api.post(`/api/comments/artwork/${props.artworkId}`, {
      content: newCommentContent.value,
    })

    newCommentContent.value = ''
    await fetchComments() // Reload comments
  } catch (error) {
    console.error('Failed to submit comment:', error)
    alert(t('comment.postFailed'))
  } finally {
    isSubmitting.value = false
  }
}

const handleReply = (_comment: CommentWithUser) => {
  // 返信フォームを表示するロジック（CommentItemで処理）
}

const handleDelete = async (commentId: string) => {
  if (!confirm(t('comment.deleteConfirm'))) return

  try {
    await api.delete(`/api/comments/${commentId}`)
    await fetchComments() // Reload comments
  } catch (error) {
    console.error('Failed to delete comment:', error)
    alert(t('comment.deleteFailed'))
  }
}

const handleUpdate = async (commentId: string, newContent: string) => {
  try {
    await api.put(`/api/comments/${commentId}`, { content: newContent })
    await fetchComments() // Reload comments
  } catch (error) {
    console.error('Failed to update comment:', error)
    alert(t('comment.updateFailed'))
  }
}

watch(currentPage, () => {
  fetchComments()
})

onMounted(() => {
  fetchComments()
})
</script>
