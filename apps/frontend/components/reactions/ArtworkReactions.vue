<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useReactions } from '~/composables/useReactions'
import { useEmoji } from '~/composables/useEmoji'
import ReactionButtons from './ReactionButtons.vue'
import EmojiPicker from './EmojiPicker.vue'

interface Props {
  artworkId: string
}

const props = defineProps<Props>()

const {
  reactions,
  isLoading,
  fetchReactions,
  toggleReaction,
  addReaction,
} = useReactions(props.artworkId)

const { recordEmojiUsage } = useEmoji()

// Picker state
const showPicker = ref(false)
const containerRef = ref<HTMLElement>()

const handleToggle = (emoji: string) => {
  toggleReaction(emoji)
}

const handleEmojiSelect = (emoji: string) => {
  recordEmojiUsage(emoji)
  addReaction(emoji)
  showPicker.value = false
}

const openPicker = () => {
  showPicker.value = true
}

const closePicker = () => {
  showPicker.value = false
}

onMounted(() => {
  fetchReactions()
})
</script>

<template>
  <div ref="containerRef" class="artwork-reactions">
    <ReactionButtons
      :reactions="reactions"
      :disabled="isLoading"
      @toggle="handleToggle"
      @open-picker="openPicker"
    />
    <EmojiPicker
      :visible="showPicker"
      @select="handleEmojiSelect"
      @close="closePicker"
    />
  </div>
</template>

<style scoped>
.artwork-reactions {
  position: relative;
}
</style>
