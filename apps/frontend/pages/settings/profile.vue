<script setup lang="ts">
// Redirect to /settings instead
definePageMeta({
  middleware: () => {
    return navigateTo('/settings')
  }
})
</script>

<template>
  <div></div>
</template>
