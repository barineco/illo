<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-lg p-6 w-full max-w-md">
        <h3 class="text-xl font-bold mb-4">{{ title }}</h3>

        <p class="text-[var(--color-text-secondary)] mb-4">{{ message }}</p>

        <!-- Reason input (for reject/suspend) -->
        <div v-if="requiresReason" class="mb-4">
          <label class="block text-sm font-medium mb-2">{{ $t('admin.reason') }}</label>
          <textarea
            v-model="reason"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            rows="3"
            :placeholder="$t('admin.reasonPlaceholder')"
            :disabled="loading"
          />
        </div>

        <!-- Admin password confirmation -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">{{ $t('admin.adminPassword') }}</label>
          <input
            v-model="password"
            type="password"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            :placeholder="$t('admin.passwordConfirmPlaceholder')"
            :disabled="loading"
            @keyup.enter="confirm"
          />
        </div>

        <!-- Error message -->
        <p v-if="error" class="text-[var(--color-danger-text)] text-sm mb-4">{{ error }}</p>

        <!-- Actions -->
        <div class="flex gap-3">
          <BaseButton
            variant="primary"
            size="md"
            shape="rounded"
            :disabled="loading || !password || (requiresReason && !reason)"
            :loading="loading"
            class="flex-1"
            @click="confirm"
          >
            {{ confirmButtonText }}
          </BaseButton>
          <BaseButton
            variant="secondary"
            size="md"
            shape="rounded"
            :disabled="loading"
            class="flex-1"
            @click="close"
          >
            {{ $t('common.cancel') }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const { t } = useI18n()

interface Props {
  show: boolean
  action: 'approve' | 'reject' | 'suspend' | 'activate'
  username: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  confirm: [password: string, reason?: string]
  close: []
}>()

const password = ref('')
const reason = ref('')
const error = ref('')
const loading = ref(false)

const requiresReason = computed(() =>
  props.action === 'reject' || props.action === 'suspend'
)

const title = computed(() => {
  const actions = {
    approve: t('admin.approveUser'),
    reject: t('admin.rejectUser'),
    suspend: t('admin.suspendUser'),
    activate: t('admin.activateUser'),
  }
  return actions[props.action]
})

const message = computed(() => {
  const messages = {
    approve: t('admin.approveUserConfirm', { username: props.username }),
    reject: t('admin.rejectUserConfirm', { username: props.username }),
    suspend: t('admin.suspendUserConfirm', { username: props.username }),
    activate: t('admin.activateUserConfirm', { username: props.username }),
  }
  return messages[props.action]
})

const confirmButtonText = computed(() => {
  const texts = {
    approve: t('admin.approve'),
    reject: t('admin.reject'),
    suspend: t('admin.suspend'),
    activate: t('admin.activate'),
  }
  return texts[props.action]
})

const confirm = async () => {
  if (!password.value) {
    error.value = t('admin.passwordRequired')
    return
  }

  if (requiresReason.value && !reason.value) {
    error.value = t('admin.reasonRequired')
    return
  }

  error.value = ''
  emit('confirm', password.value, reason.value)
}

const close = () => {
  if (!loading.value) {
    password.value = ''
    reason.value = ''
    error.value = ''
    emit('close')
  }
}

// Watch for external loading state changes
watch(() => props.show, (newShow) => {
  if (!newShow) {
    password.value = ''
    reason.value = ''
    error.value = ''
    loading.value = false
  }
})
</script>
