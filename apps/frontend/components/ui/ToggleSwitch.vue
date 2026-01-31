<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

const handleChange = (event: Event) => {
  if (props.disabled) return
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
  emit('change', target.checked)
}
</script>

<template>
  <label class="relative inline-flex items-center cursor-pointer" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="sr-only peer"
      @change="handleChange"
    />
    <div
      class="rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--color-border)] after:border after:rounded-full after:transition-all peer-checked:bg-[var(--color-primary)] bg-[var(--color-surface-secondary)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-focus-ring)]"
      :class="[
        size === 'sm' ? 'w-9 h-5 after:h-4 after:w-4' : 'w-11 h-6 after:h-5 after:w-5',
      ]"
    />
  </label>
</template>

<style scoped>
/* after:content is set via CSS to avoid template escaping issues */
.peer + div::after {
  content: '';
}
</style>
