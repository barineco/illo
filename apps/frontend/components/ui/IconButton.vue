<script setup lang="ts">
interface Props {
  variant?: 'ghost' | 'secondary' | 'danger' | 'primary'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  shape?: 'rounded' | 'square' | 'circle'
  disabled?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'ghost',
  size: 'sm',
  shape: 'rounded',
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

// For lg size, use fixed dimensions to match BaseButton lg height (48px with py-3 + text-base line-height)
const sizeClasses = {
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-3',
  lg: 'w-12 h-12', // Fixed 48px to match BaseButton lg height
}

const shapeClasses = {
  rounded: 'rounded-lg',
  square: 'rounded',
  circle: 'rounded-full',
}

const variantClasses = {
  ghost: 'bg-transparent hover:bg-[var(--color-button-ghost-hover)] text-[var(--color-text)]',
  secondary: 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)] text-[var(--color-text)]',
  danger: 'bg-[var(--color-button-danger)] hover:bg-[var(--color-button-danger-hover)] text-white',
  primary: 'bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white',
}

const buttonClasses = computed(() => [
  'inline-flex items-center justify-center transition-colors',
  sizeClasses[props.size],
  shapeClasses[props.shape],
  variantClasses[props.variant],
  {
    'opacity-50 cursor-not-allowed': props.disabled,
  },
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    type="button"
    :class="buttonClasses"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <slot />
  </button>
</template>
