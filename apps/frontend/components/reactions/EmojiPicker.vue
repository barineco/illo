<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { PaperAirplaneIcon } from '@heroicons/vue/24/solid'
import { useEmoji } from '~/composables/useEmoji'
import { REACTION_EMOJIS } from '~/data/emoji/emoji-data'

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [emoji: string]
  close: []
}>()

const { recentEmojis, recordEmojiUsage } = useEmoji()

const customEmojiInput = ref('')

const EMOJI_PATTERN =
  /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji}(?:\u200D\p{Emoji})+)+$/u

const isValidEmoji = (str: string): boolean => EMOJI_PATTERN.test(str)

const canSubmitCustomEmoji = computed(() => {
  const emoji = customEmojiInput.value.trim()
  return emoji && isValidEmoji(emoji)
})

const handleEmojiSelect = (emoji: string) => {
  recordEmojiUsage(emoji)
  emit('select', emoji)
  emit('close')
}

const handleCustomSubmit = () => {
  const emoji = customEmojiInput.value.trim()
  if (emoji && isValidEmoji(emoji)) {
    recordEmojiUsage(emoji)
    emit('select', emoji)
    customEmojiInput.value = ''
    emit('close')
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.closest('.emoji-picker') || target.closest('.reaction-add-button')) {
    return
  }
  emit('close')
}

watch(() => props.visible, (visible) => {
  if (visible) {
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
    customEmojiInput.value = ''
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <Transition name="picker-fade">
    <div v-if="visible" class="emoji-picker">
      <!-- Recent emojis section -->
      <div v-if="recentEmojis.length > 0" class="emoji-section">
        <div class="section-title">{{ $t('reactions.recent') }}</div>
        <div class="emoji-grid">
          <button
            v-for="emoji in recentEmojis"
            :key="`recent-${emoji}`"
            class="emoji-button"
            @click="handleEmojiSelect(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>

      <!-- Curated emoji grid -->
      <div class="emoji-section emoji-main">
        <div class="section-title">{{ $t('reactions.emojis') }}</div>
        <div class="emoji-grid">
          <button
            v-for="emoji in REACTION_EMOJIS"
            :key="emoji"
            class="emoji-button"
            @click="handleEmojiSelect(emoji)"
          >
            {{ emoji }}
          </button>
        </div>
      </div>

      <!-- Custom emoji input -->
      <div class="custom-input-section">
        <input
          v-model="customEmojiInput"
          type="text"
          class="custom-emoji-input"
          :placeholder="$t('reactions.customEmoji')"
          @keydown.enter="handleCustomSubmit"
        />
        <button
          class="submit-button"
          :disabled="!canSubmitCustomEmoji"
          @click="handleCustomSubmit"
        >
          <PaperAirplaneIcon class="submit-icon" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.emoji-picker {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  width: 320px;
  max-height: 400px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
  padding: 0.75rem;
}

/* Emoji section */
.emoji-section {
  margin-bottom: 0.75rem;
}

.emoji-section.emoji-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.125rem;
}

.emoji-button {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 1.25rem;
  transition: background 0.15s ease;
}

.emoji-button:hover {
  background: var(--color-surface-hover);
}

/* Custom input section */
.custom-input-section {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border-subtle);
  margin-top: 0.75rem;
}

.custom-emoji-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--color-background);
  border: 1px solid var(--color-border-subtle);
  border-radius: 0.5rem;
  color: var(--color-text);
  font-size: 0.875rem;
}

.custom-emoji-input::placeholder {
  color: var(--color-text-muted);
}

.custom-emoji-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background: var(--color-primary);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  color: white;
  transition: all 0.15s ease;
}

.submit-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-icon {
  width: 1rem;
  height: 1rem;
}

/* Transition */
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
  transform: translateY(-0.5rem);
}
</style>
