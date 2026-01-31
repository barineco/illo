<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '~/composables/useApi'
import { useAuth } from '~/composables/useAuth'

const { t } = useI18n()

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const api = useApi()
const { user } = useAuth()

const collectionId = computed(() => route.params.id as string)

const collection = ref<any>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const avatarLoaded = ref(false)

const onAvatarLoaded = () => {
  avatarLoaded.value = true
}

// Edit mode
const isEditing = ref(false)
const editTitle = ref('')
const editDescription = ref('')
const isSaving = ref(false)

// Check if current user is the owner
const isOwner = computed(() => {
  if (!user.value || !collection.value) return false
  return user.value.id === collection.value.userId
})

// Extract artworks from collection with proper transformation
const artworks = computed(() => {
  if (!collection.value?.artworks) return []
  return collection.value.artworks.map((ca: any) => {
    const artwork = ca.artwork
    return {
      id: artwork.id,
      title: artwork.title,
      thumbnailUrl: artwork.thumbnailUrl || artwork.images?.[0]?.thumbnailUrl || artwork.images?.[0]?.url || '',
      likeCount: artwork._count?.likes || 0,
      imageCount: artwork.imageCount || artwork._count?.images || artwork.images?.length || 1,
      images: artwork.images || [],
      author: artwork.author || {},
    }
  })
})

// Fetch collection data
const fetchCollection = async () => {
  isLoading.value = true
  error.value = null
  avatarLoaded.value = false

  try {
    const response = await api.get(`/api/collections/${collectionId.value}`)
    collection.value = response
  } catch (err: any) {
    console.error('Failed to fetch collection:', err)
    if (err.response?.status === 404) {
      error.value = t('collection.notFound')
    } else if (err.response?.status === 403) {
      error.value = t('collection.noAccessPermission')
    } else {
      error.value = t('collection.loadFailed')
    }
  } finally {
    isLoading.value = false
  }
}

// Start editing
const startEdit = () => {
  if (!collection.value) return
  editTitle.value = collection.value.title
  editDescription.value = collection.value.description || ''
  isEditing.value = true
}

// Cancel editing
const cancelEdit = () => {
  isEditing.value = false
  editTitle.value = ''
  editDescription.value = ''
}

// Save changes
const saveChanges = async () => {
  if (!editTitle.value.trim()) return

  isSaving.value = true
  try {
    const response = await api.put(`/api/collections/${collectionId.value}`, {
      title: editTitle.value.trim(),
      description: editDescription.value.trim() || null,
    })
    collection.value = response
    isEditing.value = false
  } catch (err) {
    console.error('Failed to update collection:', err)
    alert(t('collection.updateFailed'))
  } finally {
    isSaving.value = false
  }
}

// Delete collection
const deleteCollection = async () => {
  if (!confirm(t('collection.deleteConfirm'))) return

  try {
    await api.delete(`/api/collections/${collectionId.value}`)
    router.push(`/users/${collection.value.user.username}`)
  } catch (err) {
    console.error('Failed to delete collection:', err)
    alert(t('collection.deleteFailed'))
  }
}

// Remove artwork from collection
const removeArtwork = async (artworkId: string) => {
  try {
    await api.delete(`/api/collections/${collectionId.value}/artworks/${artworkId}`)
    // Update local state without full refresh
    if (collection.value) {
      collection.value.artworks = collection.value.artworks.filter(
        (ca: any) => ca.artwork.id !== artworkId
      )
      collection.value.artworkCount = collection.value.artworks.length
    }
  } catch (err) {
    console.error('Failed to remove artwork:', err)
    alert(t('collection.removeArtworkFailed'))
  }
}

// Get user handle for profile link
const getUserHandle = (u: any) => {
  if (u.domain) {
    return `${u.username}@${u.domain}`
  }
  return u.username
}

onMounted(() => {
  fetchCollection()
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-32">
      <div class="text-[var(--color-text-muted)]">{{ $t('common.loading') }}</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-32">
      <p class="text-[var(--color-text-muted)] text-lg mb-4">{{ error }}</p>
      <NuxtLink to="/" class="text-[var(--color-primary)] hover:underline">
        {{ $t('common.backToHome') }}
      </NuxtLink>
    </div>

    <!-- Collection Content -->
    <div v-else-if="collection" class="max-w-6xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <!-- Creator Info -->
        <NuxtLink
          :to="`/users/${getUserHandle(collection.user)}`"
          class="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity w-fit"
        >
          <div class="relative w-10 h-10">
            <!-- Avatar loading spinner -->
            <div
              v-if="collection.user.avatarUrl && !avatarLoaded"
              class="absolute inset-0 flex items-center justify-center rounded-full bg-[var(--color-surface-secondary)]"
            >
              <div class="w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
            </div>
            <img
              v-if="collection.user.avatarUrl"
              :src="collection.user.avatarUrl"
              :alt="collection.user.displayName || collection.user.username"
              class="w-10 h-10 rounded-full object-cover"
              :class="{ 'opacity-0': !avatarLoaded }"
              @load="onAvatarLoaded"
              @error="onAvatarLoaded"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center text-[var(--color-text-muted)]"
            >
              {{ (collection.user.displayName || collection.user.username).charAt(0).toUpperCase() }}
            </div>
          </div>
          <div>
            <p class="font-medium">{{ collection.user.displayName || collection.user.username }}</p>
            <p class="text-sm text-[var(--color-text-muted)]">@{{ getUserHandle(collection.user) }}</p>
          </div>
        </NuxtLink>

        <!-- Collection Title & Description -->
        <div v-if="!isEditing">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold mb-2">{{ collection.title }}</h1>
              <p v-if="collection.description" class="text-[var(--color-text-muted)] mb-4">
                {{ collection.description }}
              </p>
              <p class="text-sm text-[var(--color-text-muted)]">
                {{ $t('collection.artworkCount', { count: collection.artworkCount }) }}
              </p>
            </div>

            <!-- Owner Actions -->
            <div v-if="isOwner" class="flex gap-2 flex-shrink-0">
              <button
                @click="startEdit"
                class="px-4 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-hover)] rounded-lg transition-colors"
              >
                {{ $t('common.edit') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Edit Form -->
        <div v-else class="bg-[var(--color-surface)] rounded-lg p-6">
          <h2 class="text-lg font-bold mb-4">{{ $t('collection.editTitle') }}</h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm text-[var(--color-text-muted)] mb-1">{{ $t('collection.title') }}</label>
              <input
                v-model="editTitle"
                type="text"
                maxlength="100"
                class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                :placeholder="$t('collection.titlePlaceholder')"
              />
            </div>

            <div>
              <label class="block text-sm text-[var(--color-text-muted)] mb-1">{{ $t('collection.descriptionOptional') }}</label>
              <textarea
                v-model="editDescription"
                rows="3"
                maxlength="2000"
                class="w-full px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] resize-none"
                :placeholder="$t('collection.descriptionPlaceholder')"
              ></textarea>
            </div>

            <div class="flex gap-2 justify-between">
              <button
                @click="deleteCollection"
                class="px-4 py-2 bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-hover-bg)] hover:text-[var(--color-danger-hover-text)] rounded-lg transition-colors"
                :disabled="isSaving"
              >
                {{ $t('collection.delete') }}
              </button>
              <div class="flex gap-2">
                <button
                  @click="cancelEdit"
                  class="px-4 py-2 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded-lg transition-colors"
                  :disabled="isSaving"
                >
                  {{ $t('common.cancel') }}
                </button>
                <button
                  @click="saveChanges"
                  class="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-hover)] rounded-lg transition-colors disabled:opacity-50"
                  :disabled="isSaving || !editTitle.trim()"
                >
                  {{ isSaving ? $t('common.saving') : $t('common.save') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Artworks Grid -->
      <div v-if="artworks.length > 0" class="p-1 -m-1">
        <!-- Grid with ArtworkCard and delete overlay in edit mode -->
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
        >
          <div
            v-for="artwork in artworks"
            :key="artwork.id"
            class="relative"
          >
            <ArtworkCard :artwork="artwork" />

            <!-- Delete overlay button (shown in edit mode) -->
            <button
              v-if="isOwner && isEditing"
              @click.prevent="removeArtwork(artwork.id)"
              class="absolute top-2 left-2 z-20 w-8 h-8 bg-[var(--color-danger)] hover:bg-[var(--color-danger-hover-bg)] rounded-full flex items-center justify-center text-white shadow-lg transition-colors"
              :title="$t('collection.removeFromCollection')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-16">
        <p class="text-[var(--color-text-muted)] text-lg mb-4">{{ $t('collection.empty') }}</p>
        <NuxtLink
          v-if="isOwner"
          to="/"
          class="inline-block px-6 py-3 bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-hover)] rounded-full font-medium transition-colors"
        >
          {{ $t('collection.findAndAdd') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
