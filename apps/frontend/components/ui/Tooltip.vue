<template>
  <div class="relative inline-flex items-center">
    <button
      type="button"
      class="inline-flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      @mouseenter="show = true"
      @mouseleave="show = false"
      @click.prevent="show = !show"
      @blur="show = false"
    >
      <Icon name="QuestionMarkCircle" class="w-4 h-4" />
    </button>
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        :class="positionClasses"
        class="absolute z-50 px-3 py-2 text-sm bg-[var(--color-scrim)] text-white rounded-lg shadow-lg whitespace-normal max-w-xs"
      >
        <slot>{{ content }}</slot>
        <div :class="arrowClasses" class="absolute w-2 h-2 bg-[var(--color-scrim)] rotate-45" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
interface Props {
  content?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top',
})

const show = ref(false)

const positionClasses = computed(() => {
  switch (props.position) {
    case 'top':
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-2'
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 mr-2'
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 ml-2'
    default:
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
  }
})

const arrowClasses = computed(() => {
  switch (props.position) {
    case 'top':
      return 'top-full left-1/2 -translate-x-1/2 -mt-1'
    case 'bottom':
      return 'bottom-full left-1/2 -translate-x-1/2 -mb-1'
    case 'left':
      return 'left-full top-1/2 -translate-y-1/2 -ml-1'
    case 'right':
      return 'right-full top-1/2 -translate-y-1/2 -mr-1'
    default:
      return 'top-full left-1/2 -translate-x-1/2 -mt-1'
  }
})
</script>
