<template>
  <div class="pending-page">
    <div class="pending-container">
      <div class="pending-state">
        <ClockIcon class="pending-icon" />
        <h1 class="pending-title">{{ $t('auth.pendingApproval.title') }}</h1>
        <p class="pending-message">{{ $t('auth.pendingApproval.message') }}</p>
        <p v-if="via === 'bluesky'" class="pending-hint">
          {{ $t('auth.pendingApproval.blueskyHint') }}
        </p>
        <NuxtLink to="/login" class="btn-link">
          {{ $t('auth.pendingApproval.backToLogin') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClockIcon } from '@heroicons/vue/24/outline'

definePageMeta({
  layout: false,
})

const route = useRoute()
const via = computed(() => route.query.via as string | undefined)
</script>

<style scoped>
.pending-page {
  min-height: 100vh;
  background: var(--color-background);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.pending-container {
  width: 100%;
  max-width: 400px;
  background: var(--color-surface);
  border-radius: 12px;
  padding: 2.5rem;
  text-align: center;
}

.pending-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.pending-icon {
  width: 4rem;
  height: 4rem;
  color: var(--color-warning-text);
}

.pending-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text);
}

.pending-message {
  color: var(--color-text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}

.pending-hint {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.btn-link {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: var(--color-primary-text);
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-link:hover {
  background: var(--color-primary-hover);
}
</style>
