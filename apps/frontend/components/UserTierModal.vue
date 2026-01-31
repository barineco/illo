<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-lg p-6 w-full max-w-md">
        <h3 class="text-xl font-bold mb-4">{{ $t('admin.setUserTier') }}</h3>

        <p class="text-[var(--color-text-secondary)] mb-4">
          {{ $t('admin.setUserTierConfirm', { username }) }}
        </p>

        <!-- Current tier display -->
        <div v-if="currentTier" class="mb-4 p-3 bg-[var(--color-background)] rounded-lg">
          <p class="text-sm text-[var(--color-text-secondary)] mb-1">{{ $t('admin.currentTier') }}</p>
          <div class="flex items-center gap-2">
            <SupporterBadge :tier="currentTier" :show-label="true" />
            <span class="text-sm">{{ getTierLabel(currentTier) }}</span>
          </div>
        </div>

        <!-- Tier selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium mb-2">{{ $t('admin.selectTier') }}</label>
          <select
            v-model="selectedTier"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            :disabled="loading"
          >
            <option value="NONE">{{ $t('supporter.none') }} ({{ $t('admin.noSupporter') }})</option>
            <option value="TIER_1">{{ $t('supporter.tier1') }} (5GB, 20画像)</option>
            <option value="TIER_2">{{ $t('supporter.tier2') }} (10GB, 50画像)</option>
            <option value="TIER_3">{{ $t('supporter.tier3') }} (20GB, 100画像)</option>
          </select>
        </div>

        <!-- Tier benefits info -->
        <div class="mb-4 p-3 bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-lg">
          <p class="text-sm text-[var(--color-info-text)]">
            <span class="font-medium">{{ $t('admin.tierBenefits') }}:</span>
            {{ getTierBenefitsText(selectedTier) }}
          </p>
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
            :disabled="loading || !password"
            :loading="loading"
            class="flex-1"
            @click="confirm"
          >
            {{ $t('admin.setTier') }}
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
import { ref, watch } from 'vue'

const { t } = useI18n()

interface Props {
  show: boolean
  username: string
  currentTier?: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  confirm: [tier: string, password: string]
  close: []
}>()

const selectedTier = ref<'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'>('NONE')
const password = ref('')
const error = ref('')
const loading = ref(false)

const getTierLabel = (tier: string) => {
  const labels: Record<string, string> = {
    NONE: t('supporter.none'),
    TIER_1: t('supporter.tier1'),
    TIER_2: t('supporter.tier2'),
    TIER_3: t('supporter.tier3'),
  }
  return labels[tier] || tier
}

const getTierBenefitsText = (tier: string) => {
  const benefits: Record<string, string> = {
    NONE: t('admin.tierBenefitsNone'),
    TIER_1: t('admin.tierBenefitsTier1'),
    TIER_2: t('admin.tierBenefitsTier2'),
    TIER_3: t('admin.tierBenefitsTier3'),
  }
  return benefits[tier] || ''
}

const confirm = async () => {
  if (!password.value) {
    error.value = t('admin.passwordRequired')
    return
  }

  error.value = ''
  emit('confirm', selectedTier.value, password.value)
}

const close = () => {
  if (!loading.value) {
    password.value = ''
    error.value = ''
    emit('close')
  }
}

// Watch for show changes to reset form
watch(() => props.show, (newShow) => {
  if (newShow) {
    selectedTier.value = props.currentTier || 'NONE'
    password.value = ''
    error.value = ''
    loading.value = false
  }
})
</script>
