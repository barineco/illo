<template>
  <div class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-3 flex items-center justify-between">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-medium text-sm truncate">{{ name }}</span>
        <span class="text-xs px-2 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)]">
          {{ license }}
        </span>
      </div>
      <p v-if="description" class="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
        {{ description }}
      </p>
    </div>
    <a
      v-if="url"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      class="ml-2 p-1.5 rounded hover:bg-[var(--color-hover)] transition-colors flex-shrink-0"
      :aria-label="`Visit ${name} website`"
    >
      <Icon name="ArrowTopRightOnSquare" class="w-4 h-4 text-[var(--color-text-muted)]" />
    </a>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  license: string
  url?: string
  description?: string
}>()
</script>
