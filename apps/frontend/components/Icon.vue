<script setup lang="ts">
import * as OutlineIcons from '@heroicons/vue/24/outline'
import * as SolidIcons from '@heroicons/vue/24/solid'

type IconName = keyof typeof OutlineIcons | keyof typeof SolidIcons

const props = defineProps<{
  name: string
  solid?: boolean
}>()

const IconComponent = computed(() => {
  const icons = props.solid ? SolidIcons : OutlineIcons
  const iconName = (props.name + 'Icon') as IconName
  return icons[iconName] || null
})
</script>

<template>
  <component :is="IconComponent" v-if="IconComponent" />
</template>
