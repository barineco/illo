<template>
  <div class="space-y-4">
    <!-- Selected Collections Display -->
    <div v-if="selectedCollections.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="collection in selectedCollections"
        :key="collection.id"
        class="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)]/10 border border-[var(--color-primary)] rounded-full text-sm"
      >
        <Icon name="FolderOpen" class="w-4 h-4 text-[var(--color-primary)]" />
        <span>{{ collection.title }}</span>
        <button
          type="button"
          @click="removeCollection(collection.id)"
          class="ml-1 p-0.5 hover:bg-[var(--color-primary)]/20 rounded-full transition-colors"
        >
          <Icon name="XMark" class="w-3 h-3 text-[var(--color-primary)]" />
        </button>
      </div>
    </div>

    <!-- Add to Collection Button -->
    <button
      type="button"
      @click="isModalOpen = true"
      class="w-full p-3 border border-dashed border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2"
    >
      <Icon name="FolderPlus" class="w-5 h-5" />
      <span>{{ $t('upload.addToCollection') }}</span>
    </button>

    <!-- Collection Selection Modal -->
    <Teleport to="body">
      <div
        v-if="isModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
        @click.self="isModalOpen = false"
      >
        <div class="bg-[var(--color-surface)] rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 class="text-lg font-bold">{{ $t('upload.selectCollections') }}</h2>
            <button
              type="button"
              @click="isModalOpen = false"
              class="p-1 hover:bg-[var(--color-hover)] rounded transition-colors"
            >
              <Icon name="XMark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-4 overflow-y-auto flex-1">
            <!-- Loading -->
            <div v-if="isLoading" class="text-center py-8">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
              <p class="mt-2 text-[var(--color-text-muted)] text-sm">{{ $t('common.loading') }}</p>
            </div>

            <template v-else>
              <!-- Create new collection -->
              <div class="mb-4">
                <button
                  v-if="!showCreateForm"
                  type="button"
                  @click="showCreateForm = true"
                  class="w-full p-3 border border-dashed border-[var(--color-border)] rounded-lg text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="Plus" class="w-4 h-4" />
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
                      type="button"
                      @click="showCreateForm = false; newCollectionTitle = ''; newCollectionDescription = ''"
                      class="flex-1 px-3 py-2 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)] rounded transition-colors text-sm"
                    >
                      {{ $t('common.cancel') }}
                    </button>
                    <button
                      type="button"
                      @click="createCollection"
                      :disabled="!newCollectionTitle.trim() || isCreating"
                      class="flex-1 px-3 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {{ isCreating ? $t('collection.creating') : $t('common.add') }}
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
                  type="button"
                  @click="toggleCollection(collection)"
                  class="w-full p-3 rounded-lg text-left transition-colors flex items-center justify-between"
                  :class="isSelected(collection.id) ? 'bg-[var(--color-primary)]/20 border border-[var(--color-primary)]' : 'bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-hover)]'"
                >
                  <div>
                    <div class="font-medium">{{ collection.title }}</div>
                    <div class="text-sm text-[var(--color-text-muted)]">{{ $t('collection.artworkCount', { count: collection.artworkCount }) }}</div>
                  </div>
                  <Icon v-if="isSelected(collection.id)" name="Check" class="w-5 h-5 text-[var(--color-primary)]" />
                </button>
              </div>

              <div v-else-if="!showCreateForm" class="text-center py-8 text-[var(--color-text-muted)]">
                <p>{{ $t('collection.noCollectionsYet') }}</p>
                <p class="text-sm mt-1">{{ $t('collection.createFromAbove') }}</p>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="p-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              @click="isModalOpen = false"
              class="w-full px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg transition-colors"
            >
              {{ $t('common.done') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface Collection {
  id: string
  title: string
  description?: string
  artworkCount: number
}

const props = defineProps<{
  modelValue: string[] // Array of collection IDs
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const api = useApi()
const { t } = useI18n()

const isModalOpen = ref(false)
const isLoading = ref(false)
const isCreating = ref(false)
const showCreateForm = ref(false)
const newCollectionTitle = ref('')
const newCollectionDescription = ref('')
const collections = ref<Collection[]>([])

// Track selected collections with full data for display
const selectedCollections = computed<Collection[]>(() => {
  return props.modelValue
    .map(id => collections.value.find(c => c.id === id))
    .filter((c): c is Collection => c !== undefined)
})

const isSelected = (collectionId: string): boolean => {
  return props.modelValue.includes(collectionId)
}

const toggleCollection = (collection: Collection) => {
  const currentIds = [...props.modelValue]
  const index = currentIds.indexOf(collection.id)

  if (index > -1) {
    currentIds.splice(index, 1)
  } else {
    currentIds.push(collection.id)
  }

  emit('update:modelValue', currentIds)
}

const removeCollection = (collectionId: string) => {
  emit('update:modelValue', props.modelValue.filter(id => id !== collectionId))
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

const createCollection = async () => {
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

    // Add to collections list
    collections.value.unshift({
      id: newCollection.id,
      title: newCollection.title,
      description: newCollection.description || undefined,
      artworkCount: 0,
    })

    // Auto-select the new collection
    emit('update:modelValue', [...props.modelValue, newCollection.id])

    // Reset form
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

// Fetch collections when modal opens
watch(isModalOpen, (open) => {
  if (open && collections.value.length === 0) {
    fetchCollections()
  }
})

// Also fetch on mount if already have selected collections
onMounted(() => {
  if (props.modelValue.length > 0) {
    fetchCollections()
  }
})
</script>
