<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
        @click.self="handleOverlayClick"
      >
        <div
          class="bg-[var(--color-surface)] rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col relative"
          @keydown.esc="handleOverlayClick"
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">{{ $t('tos.title') }}</h2>
            <IconButton
              v-if="!required"
              variant="ghost"
              size="sm"
              shape="rounded"
              :aria-label="$t('common.close')"
              @click="handleClose"
            >
              <Icon name="XMark" class="w-5 h-5" />
            </IconButton>
          </div>

          <!-- Description -->
          <p class="text-sm text-[var(--color-text-muted)] mb-4">
            {{ $t('tos.description') }}
          </p>

          <!-- Tab buttons -->
          <div class="flex gap-2 mb-4">
            <button
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              :class="activeTab === 'tos'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
              @click="activeTab = 'tos'"
            >
              {{ $t('tos.viewTerms') }}
            </button>
            <button
              class="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
              :class="activeTab === 'privacy'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'"
              @click="activeTab = 'privacy'"
            >
              {{ $t('tos.viewPrivacy') }}
            </button>
          </div>

          <!-- Content (scrollable) -->
          <div
            ref="tosContentRef"
            class="flex-1 overflow-y-auto border border-[var(--color-border)] rounded-lg p-4 md:p-6 mb-4 min-h-[200px] max-h-[50vh] bg-[var(--color-background)]"
            @scroll="handleScroll"
          >
            <!-- Loading state -->
            <div v-if="loading" class="flex items-center justify-center py-8">
              <div class="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full"></div>
            </div>

            <!-- Content (pre-built HTML at build time) -->
            <div v-else-if="currentHtmlContent" class="tos-content">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-html="currentHtmlContent"></div>
            </div>

            <!-- No content configured -->
            <div v-else class="text-center py-8 text-[var(--color-text-muted)]">
              {{ $t('tos.notConfigured') }}
            </div>
          </div>

          <!-- Scroll progress indicator -->
          <div v-if="currentHtmlContent" class="mb-4">
            <div class="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Icon
                :name="currentTabScrolled ? 'CheckCircle' : 'ArrowDown'"
                class="w-4 h-4"
                :class="{ 'animate-bounce': !currentTabScrolled, 'text-green-500': currentTabScrolled }"
              />
              <span :class="{ 'text-green-500': currentTabScrolled }">
                {{ currentTabScrolled ? $t('tos.scrollComplete') : $t('tos.mustScrollToAgree') }}
              </span>
            </div>
            <div class="mt-2 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-100 ease-out"
                :class="currentTabScrolled ? 'bg-green-500' : 'bg-[var(--color-primary)]'"
                :style="{ width: `${scrollProgress}%` }"
              ></div>
            </div>
          </div>

          <!-- Agreement checkbox -->
          <label
            class="flex items-start gap-3 mb-4 cursor-pointer"
            :class="{ 'opacity-50 cursor-not-allowed': !canAgree }"
          >
            <input
              v-model="agreed"
              type="checkbox"
              :disabled="!canAgree"
              class="mt-1 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <span class="text-sm">
              {{ $t('tos.agreeCheckbox') }}
            </span>
          </label>

          <!-- Action buttons -->
          <div class="flex gap-3">
            <BaseButton
              variant="ghost"
              size="md"
              shape="rounded"
              class="flex-1"
              @click="handleDecline"
            >
              {{ $t('tos.disagree') }}
            </BaseButton>
            <BaseButton
              variant="primary"
              size="md"
              shape="rounded"
              class="flex-1"
              :disabled="!agreed"
              @click="handleAccept"
            >
              {{ $t('tos.agree') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// Import pre-built HTML content (vite-plugin-md-to-html transforms at build time)
import tosJaHtml from '~/content/legal/tos-ja.md'
import tosEnHtml from '~/content/legal/tos-en.md'
import privacyJaHtml from '~/content/legal/privacy-ja.md'
import privacyEnHtml from '~/content/legal/privacy-en.md'

const props = defineProps<{
  isOpen: boolean
  required?: boolean // If true, cannot close without accepting
}>()

const emit = defineEmits<{
  close: []
  accept: [version: number]
  decline: []
}>()

const { locale } = useI18n()
const { getTosSettings } = useTosAgreement()

// Active tab
const activeTab = ref<'tos' | 'privacy'>('tos')

// ToS HTML content based on locale (pre-built at build time)
const tosHtmlContent = computed(() => {
  return locale.value === 'ja' ? tosJaHtml : tosEnHtml
})

// Privacy HTML content based on locale
const privacyHtmlContent = computed(() => {
  return locale.value === 'ja' ? privacyJaHtml : privacyEnHtml
})

// Current content based on active tab
const currentHtmlContent = computed(() => {
  return activeTab.value === 'tos' ? tosHtmlContent.value : privacyHtmlContent.value
})

// State
const loading = ref(false)
const tosVersion = ref(1)
const agreed = ref(false)
const hasScrolledTos = ref(false)
const hasScrolledPrivacy = ref(false)
const scrollProgress = ref(0)
const tosContentRef = ref<HTMLElement | null>(null)

const hasScrolledToBottom = computed(() => hasScrolledTos.value && hasScrolledPrivacy.value)
const currentTabScrolled = computed(() => activeTab.value === 'tos' ? hasScrolledTos.value : hasScrolledPrivacy.value)

const canAgree = computed(() => hasScrolledToBottom.value)

const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (!target) return

  const scrollHeight = target.scrollHeight - target.clientHeight
  if (scrollHeight > 0) {
    scrollProgress.value = Math.min(100, (target.scrollTop / scrollHeight) * 100)

    if (target.scrollTop >= scrollHeight - 10) {
      if (activeTab.value === 'tos') hasScrolledTos.value = true
      else hasScrolledPrivacy.value = true
    }
  } else {
    if (activeTab.value === 'tos') hasScrolledTos.value = true
    else hasScrolledPrivacy.value = true
    scrollProgress.value = 100
  }
}

const handleClose = () => {
  if (!props.required) {
    emit('close')
  }
}

const handleOverlayClick = () => {
  if (!props.required) {
    emit('close')
  }
}

const handleAccept = () => {
  if (agreed.value) {
    emit('accept', tosVersion.value)
  }
}

const handleDecline = () => {
  emit('decline')
  emit('close')
}

// Prevent background scroll when modal is open
const lockBodyScroll = () => {
  if (import.meta.client) {
    document.body.style.overflow = 'hidden'
  }
}

const unlockBodyScroll = () => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
}

watch(activeTab, (tab) => {
  if (tosContentRef.value) {
    tosContentRef.value.scrollTop = 0
  }
  const alreadyScrolled = tab === 'tos' ? hasScrolledTos.value : hasScrolledPrivacy.value
  scrollProgress.value = alreadyScrolled ? 100 : 0
  nextTick(() => {
    if (tosContentRef.value) {
      const { scrollHeight, clientHeight } = tosContentRef.value
      if (scrollHeight <= clientHeight) {
        if (tab === 'tos') hasScrolledTos.value = true
        else hasScrolledPrivacy.value = true
        scrollProgress.value = 100
      }
    }
  })
})

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    lockBodyScroll()
    loading.value = true
    agreed.value = false
    hasScrolledTos.value = false
    hasScrolledPrivacy.value = false
    scrollProgress.value = 0
    activeTab.value = 'tos'

    try {
      const settings = await getTosSettings()
      tosVersion.value = settings.tosVersion
    } catch (error) {
      console.error('Failed to fetch ToS settings:', error)
    } finally {
      loading.value = false
    }

    nextTick(() => {
      if (tosContentRef.value) {
        const { scrollHeight, clientHeight } = tosContentRef.value
        if (scrollHeight <= clientHeight) {
          hasScrolledTos.value = true
          scrollProgress.value = 100
        }
      }
    })
  } else {
    unlockBodyScroll()
  }
})

// Cleanup on unmount
onUnmounted(() => {
  unlockBodyScroll()
})
</script>

<style scoped>
.tos-content :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  color: var(--color-text);
}

.tos-content :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

.tos-content :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

.tos-content :deep(p) {
  margin-bottom: 0.75rem;
  line-height: 1.6;
  color: var(--color-text);
}

.tos-content :deep(ul),
.tos-content :deep(ol) {
  margin-bottom: 0.75rem;
  padding-left: 1.25rem;
}

.tos-content :deep(li) {
  margin-bottom: 0.25rem;
  color: var(--color-text);
}

.tos-content :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.tos-content :deep(strong) {
  font-weight: 600;
}

.tos-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 1.5rem 0;
}

.tos-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.875rem;
}

.tos-content :deep(th),
.tos-content :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.5rem;
  text-align: left;
}

.tos-content :deep(th) {
  background-color: var(--color-surface-hover);
  font-weight: 600;
}

.tos-content :deep(blockquote) {
  border-left: 3px solid var(--color-border);
  padding-left: 0.75rem;
  margin: 0.75rem 0;
  color: var(--color-text-muted);
}
</style>
