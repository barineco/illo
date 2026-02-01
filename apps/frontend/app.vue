<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()

// Initialize user interaction tracking for bot detection
useUserInteraction()

const siteTitle = computed(() => {
  const name = config.public.instanceName || 'illo'
  const tagline = config.public.instanceTagline
  return tagline ? `${name} - ${tagline}` : name
})

useHead({
  titleTemplate: (titleChunk) => {
    const name = config.public.instanceName || 'illo'
    return titleChunk ? `${titleChunk} | ${name}` : siteTitle.value
  },
  meta: [
    { property: 'og:site_name', content: config.public.instanceName || 'illo' },
  ],
})
</script>
