<script setup lang="ts">
import { provide, ref, computed, onMounted, watch, nextTick, type ComponentPublicInstance } from 'vue'

interface Tab {
  value: string
  label: string
  disabled?: boolean
}

interface Props {
  type?: 'pill' | 'underline'
  modelValue: string
  tabs: Tab[]
  animated?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'pill',
  animated: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// タブ要素のrefを保持
const tabRefs = ref<Record<string, HTMLElement | null>>({})

// スライドインジケーターの位置とサイズ
const indicatorLeft = ref(0)
const indicatorWidth = ref(0)

// 選択されているタブがあるかどうか
const hasSelection = computed(() => props.modelValue !== '' && props.tabs.some(t => t.value === props.modelValue))

// インジケーターの位置を更新
const updateIndicator = () => {
  if (props.type !== 'underline' || !props.animated) return

  // 選択なしの場合はインジケーターを非表示
  if (!hasSelection.value) {
    indicatorWidth.value = 0
    return
  }

  const activeTabEl = tabRefs.value[props.modelValue]
  if (activeTabEl) {
    indicatorLeft.value = activeTabEl.offsetLeft
    indicatorWidth.value = activeTabEl.offsetWidth
  }
}

// タブ選択時
const selectTab = (value: string) => {
  const tab = props.tabs.find(t => t.value === value)
  if (tab?.disabled) return
  emit('update:modelValue', value)
}

// modelValue変更時にインジケーター更新
watch(() => props.modelValue, () => {
  nextTick(updateIndicator)
})

// マウント時にインジケーター初期化
onMounted(() => {
  nextTick(updateIndicator)
})

// Pill タブのスタイル
const pillTabClasses = (tab: Tab) => [
  'px-4 py-2 rounded-full text-sm font-medium transition-colors',
  props.modelValue === tab.value && hasSelection.value
    ? 'bg-[var(--color-primary)] text-white'
    : 'bg-[var(--color-button-secondary)] text-[var(--color-text)] hover:bg-[var(--color-button-secondary-hover)]',
  {
    'opacity-50 cursor-not-allowed': tab.disabled,
    'cursor-pointer': !tab.disabled,
  },
]

// Underline タブのスタイル
const underlineTabClasses = (tab: Tab) => [
  'pb-3 px-1 font-medium transition-colors relative',
  props.modelValue === tab.value && hasSelection.value
    ? 'text-[var(--color-primary)]'
    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
  {
    'opacity-50 cursor-not-allowed': tab.disabled,
    'cursor-pointer': !tab.disabled,
  },
]

// タブref設定用
const setTabRef = (value: string) => (el: Element | ComponentPublicInstance | null) => {
  tabRefs.value[value] = el as HTMLElement | null
}
</script>

<template>
  <div class="relative">
    <!-- Pill タブ -->
    <div v-if="type === 'pill'" class="flex gap-2 flex-wrap">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        :class="pillTabClasses(tab)"
        :disabled="tab.disabled"
        @click="selectTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Underline タブ -->
    <div v-else class="relative">
      <div class="flex gap-4 sm:gap-6 border-b border-[var(--color-border)]">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :ref="setTabRef(tab.value)"
          type="button"
          :class="underlineTabClasses(tab)"
          :disabled="tab.disabled"
          @click="selectTab(tab.value)"
        >
          {{ tab.label }}
          <!-- アニメーションなしの場合の静的インジケーター -->
          <span
            v-if="!animated && modelValue === tab.value"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]"
          />
        </button>
      </div>
      <!-- スライドするインジケーター -->
      <div
        v-if="animated"
        class="absolute bottom-0 h-0.5 bg-[var(--color-primary)] transition-all duration-200"
        :style="{ left: indicatorLeft + 'px', width: indicatorWidth + 'px' }"
      />
    </div>
  </div>
</template>
