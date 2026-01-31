<template>
  <span
    v-if="tier && tier !== 'NONE'"
    class="inline-flex items-center gap-1 supporter-badge"
    :class="tierClass"
    :title="tierTitle"
  >
    <HeartIcon class="w-4 h-4" :class="iconClass" />
    <span v-if="showLabel" class="text-xs font-medium">{{ tierLabel }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { HeartIcon } from '@heroicons/vue/24/solid'

type SupporterTier = 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'

const props = withDefaults(
  defineProps<{
    tier?: SupporterTier | null
    showLabel?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    tier: 'NONE',
    showLabel: false,
    size: 'md',
  }
)

const { t } = useI18n()

const tierClass = computed(() => {
  const sizeClasses = {
    sm: 'px-1 py-0.5',
    md: 'px-1.5 py-0.5',
    lg: 'px-2 py-1',
  }

  const tierColors: Record<SupporterTier, string> = {
    NONE: '',
    TIER_1: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
    TIER_2: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    TIER_3: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  }

  return [
    'rounded-full',
    sizeClasses[props.size],
    tierColors[props.tier || 'NONE'],
  ]
})

const iconClass = computed(() => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }
  return sizeClasses[props.size]
})

const tierLabel = computed(() => {
  const labels: Record<SupporterTier, string> = {
    NONE: '',
    TIER_1: t('supporter.tier1'),
    TIER_2: t('supporter.tier2'),
    TIER_3: t('supporter.tier3'),
  }
  return labels[props.tier || 'NONE']
})

const tierTitle = computed(() => {
  const titles: Record<SupporterTier, string> = {
    NONE: '',
    TIER_1: t('supporter.tier1Title'),
    TIER_2: t('supporter.tier2Title'),
    TIER_3: t('supporter.tier3Title'),
  }
  return titles[props.tier || 'NONE']
})
</script>

<style scoped>
.supporter-badge {
  animation: supporter-glow 2s ease-in-out infinite;
}

@keyframes supporter-glow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.85;
  }
}
</style>
