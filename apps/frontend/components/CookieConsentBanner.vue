<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="translate-y-full opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-full opacity-0"
    >
      <div
        v-if="showBanner"
        class="fixed bottom-0 left-0 right-0 z-[60] p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)] shadow-lg"
      >
        <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex-1 text-sm text-[var(--color-text-muted)]">
            <p>
              {{ $t('tos.guestBannerDescription') }}
              <NuxtLink
                to="/tos"
                class="text-[var(--color-primary)] hover:underline ml-1"
              >
                {{ $t('tos.viewTerms') }}
              </NuxtLink>
              <span> · </span>
              <NuxtLink
                to="/privacy"
                class="text-[var(--color-primary)] hover:underline"
              >
                {{ $t('tos.viewPrivacy') }}
              </NuxtLink>
            </p>
          </div>
          <div class="flex gap-3">
            <BaseButton
              variant="primary"
              size="sm"
              shape="rounded"
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
const { hasConsented, acceptCookies } = useCookieConsent()
const { isAuthenticated } = useAuth()

// Only show banner for non-authenticated users who haven't consented
const showBanner = computed(() => {
  return !isAuthenticated.value && !hasConsented.value
})

const handleAccept = () => {
  acceptCookies()
}
</script>
