<template>
  <div class="min-h-screen bg-[var(--color-background)]">
    <div class="max-w-4xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-4">
        <button
          type="button"
          @click="goBack"
          class="inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <Icon name="ArrowLeft" class="w-5 h-5" />
          {{ $t('common.back') }}
        </button>
      </div>

      <!-- Content -->
      <div
        v-if="htmlContent"
        class="bg-[var(--color-surface)] rounded-xl p-6 md:p-8 shadow-sm"
      >
        <div class="prose prose-sm md:prose max-w-none text-[var(--color-text)]">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="htmlContent"></div>
        </div>
      </div>

      <!-- Not Available -->
      <div
        v-else
        class="bg-[var(--color-surface)] rounded-xl p-8 text-center"
      >
        <Icon name="ShieldCheck" class="w-16 h-16 mx-auto text-[var(--color-text-muted)] mb-4" />
        <p class="text-[var(--color-text-muted)]">
          {{ $t('privacy.notConfigured') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Import pre-built HTML content (vite-plugin-md-to-html transforms at build time)
import privacyJaHtml from '~/content/legal/privacy-ja.md'
import privacyEnHtml from '~/content/legal/privacy-en.md'

definePageMeta({
  layout: 'default',
})

const { locale } = useI18n()
const router = useRouter()

const goBack = () => {
  // Check if there's history to go back to
  if (window.history.length > 1) {
    router.back()
  } else {
    // Fallback to home if no history
    router.push('/')
  }
}

// HTML is pre-generated at build time, no client-side parsing needed
const htmlContent = computed(() => {
  return locale.value === 'ja' ? privacyJaHtml : privacyEnHtml
})

useHead({
  title: () => `${useI18n().t('privacy.pageTitle')}`,
})
</script>

<style scoped>
.prose :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.prose :deep(h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}

.prose :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}

.prose :deep(p) {
  margin-bottom: 1rem;
  line-height: 1.75;
}

.prose :deep(ul) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  list-style-type: disc;
}

.prose :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  list-style-type: decimal;
}

.prose :deep(li) {
  margin-bottom: 0.5rem;
}

.prose :deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
}

.prose :deep(strong) {
  font-weight: 600;
}

.prose :deep(blockquote) {
  border-left: 4px solid var(--color-border);
  padding-left: 1rem;
  margin: 1rem 0;
  color: var(--color-text-muted);
}

.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.prose :deep(th),
.prose :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.5rem 1rem;
  text-align: left;
}

.prose :deep(th) {
  background-color: var(--color-surface-hover);
  font-weight: 600;
}

.prose :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 2rem 0;
}
</style>
