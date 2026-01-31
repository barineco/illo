<script setup lang="ts">
interface Props {
  tag: string
  variant?: 'primary' | 'removable'
  to?: string
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  clickable: true,
})

const emit = defineEmits<{
  remove: [tag: string]
}>()

const handleRemove = (event: MouseEvent) => {
  event.preventDefault()
  event.stopPropagation()
  emit('remove', props.tag)
}

// デフォルトのリンク先
const linkTo = computed(() => {
  if (props.to) return props.to
  return { path: '/search', query: { tags: props.tag } }
})

const baseClasses = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors'
const colorClasses = 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
</script>

<template>
  <!-- Removable: 削除ボタン付き -->
  <span
    v-if="variant === 'removable'"
    :class="[baseClasses, colorClasses]"
  >
    #{{ tag }}
    <button
      type="button"
      class="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
      aria-label="Remove tag"
      @click="handleRemove"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    </button>
  </span>

  <!-- Primary with Link -->
  <NuxtLink
    v-else-if="clickable"
    :to="linkTo"
    :class="[baseClasses, colorClasses]"
  >
    #{{ tag }}
  </NuxtLink>

  <!-- Primary without Link (display only) -->
  <span
    v-else
    :class="[baseClasses, colorClasses]"
  >
    #{{ tag }}
  </span>
</template>
