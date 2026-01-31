<template>
  <div class="p-1 -m-1">
    <div
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
    >
      <ArtworkCard
        v-for="artwork in artworks"
        :key="artwork.id"
        :artwork="artwork"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArtworkCardData } from '~/composables/useArtworkTransform'

// Extended type that includes isDeleted for deleted artwork placeholders
type ArtworkCardInput = ArtworkCardData & {
  isDeleted?: boolean
}

interface ArtworkGridProps {
  artworks: ArtworkCardInput[]
}

defineProps<ArtworkGridProps>()
</script>
