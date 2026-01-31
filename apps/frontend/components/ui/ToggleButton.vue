<script setup lang="ts">
interface Props {
  variant: 'like' | 'bookmark' | 'follow'
  size?: 'sm' | 'md' | 'lg'
  shape?: 'pill' | 'rounded' | 'square'
  modelValue: boolean
  disabled?: boolean
  showLabel?: boolean
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  shape: 'rounded',
  disabled: false,
  showLabel: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  click: [event: MouseEvent]
}>()

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
}

const shapeClasses = {
  pill: 'rounded-full',
  rounded: 'rounded-lg',
  square: 'rounded',
}

// バリアント別の背景色クラス
const variantBgClasses = computed(() => {
  const { variant, modelValue } = props

  switch (variant) {
    case 'like':
      return modelValue
        ? 'bg-[var(--color-toggle-like)] hover:bg-[var(--color-toggle-like-hover)]'
        : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'
    case 'bookmark':
      return modelValue
        ? 'bg-[var(--color-toggle-bookmark)] hover:bg-[var(--color-toggle-bookmark-hover)]'
        : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'
    case 'follow':
      // Follow は逆: OFF=Primary(青), ON=Secondary(灰)
      return modelValue
        ? 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'
        : 'bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-hover)]'
  }
})

// バリアント別のテキスト色クラス
// Like/Bookmark: ON時は固定白、OFF時は継承
// Follow: OFF時は固定白（青背景）、ON時は継承（灰背景）、ホバー時は赤色
const variantTextClasses = computed(() => {
  const { variant, modelValue } = props

  switch (variant) {
    case 'like':
    case 'bookmark':
      return modelValue ? 'text-white' : 'text-[var(--color-text)]'
    case 'follow':
      // フォロー中の場合、ホバー時にテキストがミュートカラーになる
      return modelValue
        ? 'text-[var(--color-text)] hover:text-[var(--color-text-muted)]'
        : 'text-white'
  }
})

const buttonClasses = computed(() => [
  'inline-flex items-center justify-center gap-2 font-medium transition-colors',
  sizeClasses[props.size],
  shapeClasses[props.shape],
  variantBgClasses.value,
  variantTextClasses.value,
  {
    'opacity-50 cursor-not-allowed': props.disabled,
  },
])

const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
    emit('click', event)
  }
}
</script>

<template>
  <button
    type="button"
    :class="buttonClasses"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot />
    <span v-if="showLabel">
      <slot name="label" />
    </span>
    <span v-if="count !== undefined" class="tabular-nums">
      {{ count }}
    </span>
  </button>
</template>
