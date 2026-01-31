<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'pill' | 'rounded' | 'square'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  shape: 'rounded',
  disabled: false,
  loading: false,
  fullWidth: false,
  type: 'button',
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const sizeClasses = {
  xs: 'p-1 text-xs',
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
  xl: 'px-6 py-3 text-base',
}

const shapeClasses = {
  pill: 'rounded-full',
  rounded: 'rounded-lg',
  square: 'rounded',
}

const variantClasses = {
  primary: 'bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)] text-white',
  secondary: 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)] text-[var(--color-text)]',
  ghost: 'bg-transparent hover:bg-[var(--color-button-ghost-hover)] text-[var(--color-text)]',
  outline: 'bg-transparent border border-[var(--color-border)] hover:bg-[var(--color-surface)] text-[var(--color-text)]',
  danger: 'bg-[var(--color-button-danger)] hover:bg-[var(--color-button-danger-hover)] text-white',
}

const buttonClasses = computed(() => [
  'inline-flex items-center justify-center font-medium transition-colors',
  sizeClasses[props.size],
  shapeClasses[props.shape],
  variantClasses[props.variant],
  {
    'w-full': props.fullWidth,
    'opacity-50 cursor-not-allowed': props.disabled || props.loading,
  },
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :type="type"
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="mr-2">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </span>
    <slot />
  </button>
</template>
