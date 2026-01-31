<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <!-- Modal -->
      <div class="bg-[var(--color-surface)] rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 class="text-lg font-bold">{{ $t('artwork.addToCollection') }}</h2>
          <button
            @click="close"
            class="p-1 hover:bg-[var(--color-hover)] rounded transition-colors"
          >
            ✕
          </button>
        </div>

        <!-- Content -->
        <div class="p-4 overflow-y-auto flex-1">
          <!-- Loading -->
          <div v-if="isLoading" class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
            <p class="mt-2 text-[var(--color-text-muted)] text-sm">{{ $t('common.loading') }}</p>
          </div>

          <!-- Content -->
          <template v-else>
            <!-- Create new collection -->
            <div class="mb-4">
              <button
                v-if="!showCreateForm"
                @click="showCreateForm = true"
                class="w-full p-3 border border-dashed border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2"
              >
                <span>＋</span>
                <span>{{ $t('collection.createNew') }}</span>
              </button>

              <!-- Create form -->
              <div v-else class="border border-[var(--color-border)] rounded-lg p-3">
                <input
                  v-model="newCollectionTitle"
                  type="text"
                  :placeholder="$t('collection.titlePlaceholder')"
                  class="w-full px-3 py-2 bg-[var(--color-background)] rounded border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none mb-2"
                  maxlength="100"
                />
                <textarea
                  v-model="newCollectionDescription"
                  :placeholder="$t('collection.descriptionOptional')"
                  rows="2"
                  class="w-full px-3 py-2 bg-[var(--color-background)] rounded border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none mb-2 resize-none"
                  maxlength="2000"
                ></textarea>
                <div class="flex gap-2">
                  <button
                    @click="showCreateForm = false; newCollectionTitle = ''; newCollectionDescription = ''"
                    class="flex-1 px-3 py-2 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)] rounded transition-colors text-sm"
                  >
                    {{ $t('common.cancel') }}
                  </button>
                  <button
                    @click="createAndAdd"
                    :disabled="!newCollectionTitle.trim() || isCreating"
                    class="flex-1 px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ isCreating ? $t('collection.creating') : $t('collection.createAndAdd') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Existing collections -->
            <div v-if="collections.length > 0" class="space-y-2">
              <p class="text-sm text-[var(--color-text-muted)] mb-2">{{ $t('collection.existingCollections') }}</p>
              <button
                v-for="collection in collections"
                :key="collection.id"
                @click="toggleCollection(collection)"
                class="w-full p-3 rounded-lg text-left transition-colors flex items-center justify-between"
                :class="isInCollection(collection.id) ? 'bg-[var(--color-primary)]/20 border border-[var(--color-primary)]' : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'"
              >
                <div>
                  <div class="font-medium">{{ collection.title }}</div>
                  <div class="text-sm text-[var(--color-text-muted)]">{{ $t('collection.artworkCount', { count: collection.artworkCount }) }}</div>
                </div>
                <span v-if="isInCollection(collection.id)" class="text-[var(--color-primary)]">✓</span>
              </button>
            </div>

            <div v-else-if="!showCreateForm" class="text-center py-8 text-[var(--color-text-muted)]">
              <p>{{ $t('collection.noCollectionsYet') }}</p>
              <p class="text-sm mt-1">{{ $t('collection.createFromAbove') }}</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface Collection {
  id: string
  title: string
  artworkCount: number
  artworkIds: string[]
}

const props = defineProps<{
  isOpen: boolean
  artworkId: string
}>()

const emit = defineEmits<{
  close: []
  added: [collectionId: string, collectionTitle: string]
  removed: [collectionId: string]
}>()

const api = useApi()

const collections = ref<Collection[]>([])
const isLoading = ref(false)
const showCreateForm = ref(false)
const newCollectionTitle = ref('')
const newCollectionDescription = ref('')
const isCreating = ref(false)

const close = () => {
  showCreateForm.value = false
  newCollectionTitle.value = ''
  newCollectionDescription.value = ''
  emit('close')
}

const isInCollection = (collectionId: string) => {
  const collection = collections.value.find((c) => c.id === collectionId)
  return collection?.artworkIds.includes(props.artworkId) ?? false
}

const fetchCollections = async () => {
  isLoading.value = true
  try {
    const data = await api.get<Collection[]>('/api/collections/my')
    collections.value = data
  } catch (error) {
    console.error('Failed to fetch collections:', error)
  } finally {
    isLoading.value = false
  }
}

const createAndAdd = async () => {
  if (!newCollectionTitle.value.trim() || isCreating.value) return

  isCreating.value = true
  try {
    const payload: any = {
      title: newCollectionTitle.value.trim(),
    }
    if (newCollectionDescription.value.trim()) {
      payload.description = newCollectionDescription.value.trim()
    }
    const newCollection = await api.post<any>('/api/collections', payload)

    await api.post(`/api/collections/${newCollection.id}/artworks`, {
      artworkId: props.artworkId,
    })

    collections.value.unshift({
      id: newCollection.id,
      title: newCollection.title,
      artworkCount: 1,
      artworkIds: [props.artworkId],
    })

    emit('added', newCollection.id, newCollection.title)
    showCreateForm.value = false
    newCollectionTitle.value = ''
    newCollectionDescription.value = ''
  } catch (error) {
    console.error('Failed to create collection:', error)
    alert(t('collection.createFailed'))
  } finally {
    isCreating.value = false
  }
}

const toggleCollection = async (collection: Collection) => {
  const inCollection = isInCollection(collection.id)

  try {
    if (inCollection) {
      await api.delete(`/api/collections/${collection.id}/artworks/${props.artworkId}`)
      collection.artworkIds = collection.artworkIds.filter((id) => id !== props.artworkId)
      collection.artworkCount--
      emit('removed', collection.id)
    } else {
      await api.post(`/api/collections/${collection.id}/artworks`, {
        artworkId: props.artworkId,
      })
      collection.artworkIds.push(props.artworkId)
      collection.artworkCount++
      emit('added', collection.id, collection.title)
    }
  } catch (error: any) {
    console.error('Failed to toggle collection:', error)
    alert(error.data?.message || t('collection.toggleFailed'))
  }
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      fetchCollections()
    }
  },
  { immediate: true },
)
</script>
