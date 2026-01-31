<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <!-- Modal -->
      <div class="bg-[var(--color-surface)] rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 class="text-lg font-bold">{{ $t('report.title') }}</h2>
          <button
            @click="close"
            class="p-1 hover:bg-[var(--color-hover)] rounded transition-colors"
          >
            <Icon name="XMark" class="w-5 h-5" />
          </button>
        </div>

        <!-- Success State -->
        <div v-if="submitted" class="p-6 text-center">
          <Icon name="CheckCircle" class="w-16 h-16 mx-auto text-[var(--color-success-icon)] mb-4" />
          <h3 class="text-lg font-medium mb-2">{{ $t('report.submitted') }}</h3>
          <p class="text-[var(--color-text-muted)] text-sm">{{ $t('report.submittedDescription') }}</p>
          <BaseButton
            variant="primary"
            size="md"
            shape="rounded"
            class="mt-4"
            @click="close"
          >
            {{ $t('common.close') }}
          </BaseButton>
        </div>

        <!-- Form -->
        <form v-else @submit.prevent="submitReport" class="p-4 overflow-y-auto flex-1">
          <!-- Target Info -->
          <div class="mb-4 p-3 bg-[var(--color-background)] rounded-lg text-sm">
            <span class="text-[var(--color-text-muted)]">{{ $t('report.reporting') }}: </span>
            <span class="font-medium">{{ targetDisplayName }}</span>
          </div>

          <!-- Reason Selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium mb-2">{{ $t('report.reason') }} <span class="text-[var(--color-danger-text)]">*</span></label>
            <div class="space-y-2">
              <label
                v-for="reason in availableReasons"
                :key="reason.value"
                class="flex items-start p-3 rounded-lg cursor-pointer transition-colors"
                :class="selectedReason === reason.value
                  ? 'bg-[var(--color-primary)]/20 border border-[var(--color-primary)]'
                  : 'bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)]'"
              >
                <input
                  v-model="selectedReason"
                  type="radio"
                  :value="reason.value"
                  class="mt-0.5 mr-3"
                />
                <div>
                  <div class="font-medium">{{ reason.label }}</div>
                  <div class="text-xs text-[var(--color-text-muted)]">{{ reason.description }}</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Description -->
          <div class="mb-4">
            <label for="report-description" class="block text-sm font-medium mb-2">
              {{ $t('report.description') }} <span class="text-[var(--color-danger-text)]">*</span>
            </label>
            <textarea
              id="report-description"
              v-model="description"
              :placeholder="$t('report.descriptionPlaceholder')"
              rows="4"
              required
              class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] resize-none"
              maxlength="2000"
            ></textarea>
            <div class="text-xs text-[var(--color-text-muted)] mt-1 text-right">
              {{ description.length }}/2000
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="mb-4 p-3 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] rounded-lg text-sm">
            {{ error }}
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <BaseButton
              type="button"
              variant="secondary"
              size="md"
              shape="rounded"
              class="flex-1"
              @click="close"
            >
              {{ $t('common.cancel') }}
            </BaseButton>
            <BaseButton
              type="submit"
              variant="danger"
              size="md"
              shape="rounded"
              class="flex-1"
              :disabled="!isValid || isSubmitting"
            >
              {{ isSubmitting ? $t('report.submitting') : $t('report.submit') }}
            </BaseButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
type ReportType = 'ARTWORK' | 'USER' | 'COMMENT'
type ReportReason = 'INAPPROPRIATE_CONTENT' | 'SPAM' | 'HARASSMENT' | 'COPYRIGHT_VIOLATION' |
                   'SEXUAL_CONTENT' | 'VIOLENCE' | 'ACCOUNT_SPAM' | 'IMPERSONATION' | 'HATE_SPEECH' | 'OTHER'

interface Props {
  isOpen: boolean
  type: ReportType
  targetId: string
  targetName?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  submitted: []
}>()

const { t } = useI18n()
const api = useApi()

const selectedReason = ref<ReportReason | ''>('')
const description = ref('')
const isSubmitting = ref(false)
const submitted = ref(false)
const error = ref('')

const targetDisplayName = computed(() => {
  if (props.targetName) return props.targetName
  switch (props.type) {
    case 'ARTWORK': return t('report.targetArtwork')
    case 'USER': return t('report.targetUser')
    case 'COMMENT': return t('report.targetComment')
    default: return ''
  }
})

const availableReasons = computed(() => {
  const commonReasons = [
    { value: 'SPAM' as ReportReason, label: t('report.reasons.spam'), description: t('report.reasons.spamDesc') },
    { value: 'HARASSMENT' as ReportReason, label: t('report.reasons.harassment'), description: t('report.reasons.harassmentDesc') },
    { value: 'HATE_SPEECH' as ReportReason, label: t('report.reasons.hateSpeech'), description: t('report.reasons.hateSpeechDesc') },
    { value: 'OTHER' as ReportReason, label: t('report.reasons.other'), description: t('report.reasons.otherDesc') },
  ]

  if (props.type === 'ARTWORK') {
    return [
      { value: 'INAPPROPRIATE_CONTENT' as ReportReason, label: t('report.reasons.inappropriateContent'), description: t('report.reasons.inappropriateContentDesc') },
      { value: 'SEXUAL_CONTENT' as ReportReason, label: t('report.reasons.sexualContent'), description: t('report.reasons.sexualContentDesc') },
      { value: 'VIOLENCE' as ReportReason, label: t('report.reasons.violence'), description: t('report.reasons.violenceDesc') },
      { value: 'COPYRIGHT_VIOLATION' as ReportReason, label: t('report.reasons.copyrightViolation'), description: t('report.reasons.copyrightViolationDesc') },
      ...commonReasons,
    ]
  } else if (props.type === 'USER') {
    return [
      { value: 'ACCOUNT_SPAM' as ReportReason, label: t('report.reasons.accountSpam'), description: t('report.reasons.accountSpamDesc') },
      { value: 'IMPERSONATION' as ReportReason, label: t('report.reasons.impersonation'), description: t('report.reasons.impersonationDesc') },
      ...commonReasons,
    ]
  } else {
    return commonReasons
  }
})

const isValid = computed(() => {
  return selectedReason.value && description.value.trim().length >= 10
})

const submitReport = async () => {
  if (!isValid.value || isSubmitting.value) return

  isSubmitting.value = true
  error.value = ''

  try {
    const payload: any = {
      type: props.type,
      reason: selectedReason.value,
      description: description.value.trim(),
    }

    if (props.type === 'ARTWORK') {
      payload.artworkId = props.targetId
    } else if (props.type === 'USER') {
      payload.targetUserId = props.targetId
    } else if (props.type === 'COMMENT') {
      payload.commentId = props.targetId
    }

    await api.post('/api/reports', payload)
    submitted.value = true
    emit('submitted')
  } catch (err: any) {
    error.value = err.data?.message || t('report.submitFailed')
  } finally {
    isSubmitting.value = false
  }
}

const close = () => {
  selectedReason.value = ''
  description.value = ''
  submitted.value = false
  error.value = ''
  emit('close')
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    selectedReason.value = ''
    description.value = ''
    submitted.value = false
    error.value = ''
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>
