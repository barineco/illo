<script setup lang="ts">
import { PlusIcon } from '@heroicons/vue/24/outline'

interface ReactionSummary {
  emoji: string
  count: number
  userReacted: boolean
}

interface Props {
  reactions: ReactionSummary[]
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  toggle: [emoji: string]
  openPicker: []
}>()

const handleReactionClick = (emoji: string) => {
  if (!props.disabled) {
    emit('toggle', emoji)
  }
}

const handleAddClick = (event: MouseEvent) => {
  if (!props.disabled) {
    event.stopPropagation()
    emit('openPicker')
  }
}
</script>

<template>
  <div class="reaction-buttons">
    <!-- Existing reactions -->
    <button
      v-for="reaction in reactions"
      :key="reaction.emoji"
      class="reaction-button"
      :class="{
        'reaction-button--active': reaction.userReacted,
        'reaction-button--disabled': disabled
      }"
      :disabled="disabled"
      @click="handleReactionClick(reaction.emoji)"
    >
      <span class="reaction-emoji">{{ reaction.emoji }}</span>
      <span class="reaction-count">{{ reaction.count }}</span>
    </button>

    <!-- Add reaction button -->
    <button
      class="reaction-add-button"
      :class="{ 'reaction-add-button--disabled': disabled }"
      :disabled="disabled"
      @click="handleAddClick"
    >
      <PlusIcon class="add-icon" />
    </button>
  </div>
</template>

<style scoped>
.reaction-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.reaction-button {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.reaction-button:hover:not(.reaction-button--disabled) {
  background: var(--color-surface-hover);
  transform: translateY(-1px);
}

.reaction-button--active {
  background: rgba(49, 186, 232, 0.15);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.reaction-button--active:hover:not(.reaction-button--disabled) {
  background: rgba(49, 186, 232, 0.25);
}

.reaction-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reaction-emoji {
  font-size: 1rem;
  line-height: 1;
}

.reaction-count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.reaction-button--active .reaction-count {
  color: var(--color-primary);
}

.reaction-add-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text-muted);
}

.reaction-add-button:hover:not(.reaction-add-button--disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text);
  transform: translateY(-1px);
}

.reaction-add-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-icon {
  width: 1rem;
  height: 1rem;
}
</style>
