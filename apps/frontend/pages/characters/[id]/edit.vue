<template>
  <div class="min-h-screen bg-[var(--color-background)]">
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-24">
      <div
        class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"
      ></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="text-center py-24 text-[var(--color-danger-text)]"
    >
      <Icon name="ExclamationCircle" class="w-16 h-16 mx-auto mb-4" />
      <p class="text-lg">{{ error }}</p>
    </div>

    <!-- Form -->
    <div v-else-if="character" class="max-w-3xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-6">
        <button
          type="button"
          class="inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-4"
          @click="goBack"
        >
          <Icon name="ArrowLeft" class="w-5 h-5" />
          {{ $t('common.back') }}
        </button>
        <h1 class="text-2xl font-bold text-[var(--color-text)]">
          {{ $t('character.edit') }}
        </h1>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Representative Artwork Section -->
        <div class="bg-[var(--color-surface)] rounded-xl p-6">
          <h2 class="text-lg font-semibold text-[var(--color-text)] mb-4">
            {{ $t('character.representativeArtwork') }}
          </h2>

          <div class="flex items-start gap-6">
            <!-- Current Avatar -->
            <div
              class="w-32 h-32 rounded-xl overflow-hidden bg-[var(--color-surface-hover)] flex-shrink-0"
            >
              <img
                v-if="avatarImageUrl"
                :src="avatarImageUrl"
                :alt="character.name"
                class="w-full h-full object-cover"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]"
              >
                <Icon name="User" class="w-12 h-12" />
              </div>
            </div>

            <!-- Selection Controls -->
            <div class="flex-1 space-y-3">
              <p class="text-sm text-[var(--color-text-muted)]">
                {{ $t('character.representativeArtworkHint') }}
              </p>
              <div class="flex gap-2">
                <BaseButton
                  type="button"
                  variant="primary"
                  size="md"
                  shape="rounded"
                  @click="showArtworkSelector = true"
                >
                  <Icon name="Photo" class="w-4 h-4 mr-2" />
                  {{ character.representativeArtwork ? $t('character.changeRepresentative') : $t('character.selectRepresentative') }}
                </BaseButton>
                <BaseButton
                  v-if="character.representativeArtwork"
                  type="button"
                  variant="outline"
                  size="md"
                  shape="rounded"
                  :loading="isRemovingRepresentative"
                  @click="handleRemoveRepresentative"
                >
                  {{ $t('character.removeRepresentative') }}
                </BaseButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Basic Info -->
        <div class="bg-[var(--color-surface)] rounded-xl p-6">
          <h2 class="text-lg font-semibold text-[var(--color-text)] mb-4">
            {{ $t('common.basicInfo') }}
          </h2>

          <!-- Name -->
          <div class="mb-4">
            <label
              for="name"
              class="block text-sm font-medium text-[var(--color-text)] mb-1"
            >
              {{ $t('character.name') }} *
            </label>
            <input
              id="name"
              v-model="form.name"
              type="text"
              :placeholder="$t('character.namePlaceholder')"
              class="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              required
              maxlength="100"
            />
          </div>

          <!-- Description -->
          <div class="mb-4">
            <label
              for="description"
              class="block text-sm font-medium text-[var(--color-text)] mb-1"
            >
              {{ $t('character.description') }}
            </label>
            <textarea
              id="description"
              v-model="form.description"
              :placeholder="$t('character.descriptionPlaceholder')"
              rows="4"
              class="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              maxlength="5000"
            ></textarea>
          </div>

          <!-- Tags -->
          <div>
            <label
              for="tags"
              class="block text-sm font-medium text-[var(--color-text)] mb-1"
            >
              {{ $t('character.tags') }}
              <span class="text-[var(--color-text-muted)] font-normal ml-1">
                ({{ $t('character.tagsHint') }})
              </span>
            </label>
            <input
              id="tags"
              v-model="tagInput"
              type="text"
              :placeholder="$t('character.tagsPlaceholder')"
              class="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <div v-if="parsedTags.length > 0" class="flex flex-wrap gap-2 mt-2">
              <TagChip
                v-for="tag in parsedTags"
                :key="tag"
                :tag="tag"
                :clickable="false"
              />
            </div>
          </div>
        </div>

        <!-- Fan Art Settings -->
        <div class="bg-[var(--color-surface)] rounded-xl p-6">
          <h2 class="text-lg font-semibold text-[var(--color-text)] mb-4">
            {{ $t('character.fanArtWelcome') }}
          </h2>

          <!-- Allow Fan Art Toggle -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <p class="font-medium text-[var(--color-text)]">
                {{ $t('character.fanArtWelcome') }}
              </p>
              <p class="text-sm text-[var(--color-text-muted)]">
                {{ $t('character.fanArtWelcomeDesc') }}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="form.allowFanArt"
                type="checkbox"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"
              ></div>
            </label>
          </div>

          <!-- Permission Level -->
          <div v-if="form.allowFanArt" class="mb-6">
            <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
              {{ $t('character.permission.title') }}
            </label>
            <div class="space-y-2">
              <label
                class="flex items-start gap-3 p-3 border border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)]"
                :class="{
                  'border-[var(--color-primary)] bg-[var(--color-primary)]/5':
                    form.fanArtPermission === 'EVERYONE',
                }"
              >
                <input
                  v-model="form.fanArtPermission"
                  type="radio"
                  value="EVERYONE"
                  class="mt-1"
                />
                <div>
                  <p class="font-medium text-[var(--color-text)]">
                    {{ $t('character.permission.everyone') }}
                  </p>
                  <p class="text-sm text-[var(--color-text-muted)]">
                    {{ $t('character.permission.everyoneDesc') }}
                  </p>
                </div>
              </label>
              <label
                class="flex items-start gap-3 p-3 border border-[var(--color-border)] rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)]"
                :class="{
                  'border-[var(--color-primary)] bg-[var(--color-primary)]/5':
                    form.fanArtPermission === 'FOLLOWERS_ONLY',
                }"
              >
                <input
                  v-model="form.fanArtPermission"
                  type="radio"
                  value="FOLLOWERS_ONLY"
                  class="mt-1"
                />
                <div>
                  <p class="font-medium text-[var(--color-text)]">
                    {{ $t('character.permission.followersOnly') }}
                  </p>
                  <p class="text-sm text-[var(--color-text-muted)]">
                    {{ $t('character.permission.followersOnlyDesc') }}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Guidelines -->
          <div v-if="form.allowFanArt">
            <h3 class="text-md font-medium text-[var(--color-text)] mb-3">
              {{ $t('character.guidelines.title') }}
            </h3>

            <div class="space-y-3">
              <label class="flex items-center gap-3">
                <input
                  v-model="form.allowR18"
                  type="checkbox"
                  class="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span class="text-[var(--color-text)]">
                  {{ $t('character.guidelines.r18Allowed') }}
                </span>
              </label>

              <label class="flex items-center gap-3">
                <input
                  v-model="form.allowCommercial"
                  type="checkbox"
                  class="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span class="text-[var(--color-text)]">
                  {{ $t('character.guidelines.commercialAllowed') }}
                </span>
              </label>

              <label class="flex items-center gap-3">
                <input
                  v-model="form.requireCredit"
                  type="checkbox"
                  class="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span class="text-[var(--color-text)]">
                  {{ $t('character.guidelines.creditRequired') }}
                </span>
              </label>
            </div>

            <div class="mt-4">
              <label
                for="guidelines"
                class="block text-sm font-medium text-[var(--color-text)] mb-1"
              >
                {{ $t('character.guidelines.freeText') }}
              </label>
              <textarea
                id="guidelines"
                v-model="form.guidelines"
                :placeholder="$t('character.guidelines.freeTextPlaceholder')"
                rows="3"
                class="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                maxlength="2000"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Reference Materials -->
        <div class="bg-[var(--color-surface)] rounded-xl p-6">
          <h2 class="text-lg font-semibold text-[var(--color-text)] mb-4">
            {{ $t('character.reference.title') }}
          </h2>

          <div class="mb-4">
            <label
              for="referenceNotes"
              class="block text-sm font-medium text-[var(--color-text)] mb-1"
            >
              {{ $t('character.reference.notes') }}
            </label>
            <textarea
              id="referenceNotes"
              v-model="form.referenceNotes"
              :placeholder="$t('character.reference.notesPlaceholder')"
              rows="3"
              class="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
              maxlength="5000"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
              {{ $t('character.reference.visibility') }}
            </label>
            <select
              v-model="form.referenceVisibility"
              class="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="PUBLIC">{{ $t('character.reference.public') }}</option>
              <option value="FOLLOWERS_ONLY">
                {{ $t('character.reference.followersOnly') }}
              </option>
              <option value="PRIVATE">{{ $t('character.reference.private') }}</option>
            </select>
          </div>

          <!-- Reference Artworks -->
          <div class="mt-6">
            <div class="flex items-center justify-between mb-3">
              <label class="block text-sm font-medium text-[var(--color-text)]">
                {{ $t('character.reference.artworks') }}
              </label>
              <BaseButton
                type="button"
                variant="outline"
                size="sm"
                shape="rounded"
                @click="showReferenceSelector = true"
              >
                <Icon name="Plus" class="w-4 h-4 mr-1" />
                {{ $t('character.reference.addArtwork') }}
              </BaseButton>
            </div>

            <!-- Reference Artworks Grid -->
            <div
              v-if="character.referenceArtworks && character.referenceArtworks.length > 0"
              class="grid grid-cols-3 md:grid-cols-4 gap-3"
            >
              <div
                v-for="ref in character.referenceArtworks"
                :key="ref.id"
                class="relative group"
              >
                <img
                  :src="getArtworkThumbnail(ref.artwork)"
                  :alt="ref.caption || ref.artwork.title || 'Reference'"
                  class="w-full aspect-square object-cover rounded-lg"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  @click="handleRemoveReference(ref.artworkId)"
                >
                  <Icon name="XMark" class="w-4 h-4" />
                </button>
              </div>
            </div>
            <p v-else class="text-sm text-[var(--color-text-muted)]">
              {{ $t('character.reference.noArtworks') }}
            </p>
          </div>
        </div>

        <!-- Submit & Delete -->
        <div class="flex justify-between">
          <BaseButton
            type="button"
            variant="danger"
            size="lg"
            shape="rounded"
            :loading="isDeleting"
            @click="handleDelete"
          >
            <Icon name="Trash" class="w-5 h-5 mr-2" />
            {{ $t('character.delete') }}
          </BaseButton>

          <div class="flex gap-4">
            <BaseButton
              type="button"
              variant="outline"
              size="lg"
              shape="rounded"
              @click="goBack"
            >
              {{ $t('common.cancel') }}
            </BaseButton>
            <BaseButton
              type="submit"
              variant="primary"
              size="lg"
              shape="rounded"
              :loading="isSaving"
              :disabled="!form.name.trim()"
            >
              {{ $t('common.save') }}
            </BaseButton>
          </div>
        </div>
      </form>
    </div>

    <!-- Artwork Selector Modal for Representative -->
    <ArtworkSelectorModal
      v-if="showArtworkSelector"
      :title="$t('character.selectRepresentative')"
      @close="showArtworkSelector = false"
      @select="handleSelectRepresentative"
    />

    <!-- Artwork Selector Modal for References -->
    <ArtworkSelectorModal
      v-if="showReferenceSelector"
      :title="$t('character.reference.selectArtwork')"
      :exclude-ids="referenceArtworkIds"
      @close="showReferenceSelector = false"
      @select="handleAddReference"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const api = useApi()
const toast = useToast()
const { user } = useAuth()
const { getSignedUrl } = useSignedImageUrlOnce()

const characterId = computed(() => route.params.id as string)

interface ArtworkImage {
  id: string
  url?: string | null
  thumbnailUrl?: string | null
}

interface ReferenceArtwork {
  id: string
  title?: string
  images?: ArtworkImage[]
}

interface CharacterReferenceArtwork {
  id: string
  artworkId: string
  artwork: ReferenceArtwork
  order: number
  caption?: string | null
}

interface RepresentativeArtwork {
  id: string
  title?: string
  images?: ArtworkImage[]
}

interface Character {
  id: string
  name: string
  description?: string | null
  representativeArtwork?: RepresentativeArtwork | null
  allowFanArt: boolean
  fanArtPermission: 'EVERYONE' | 'FOLLOWERS_ONLY'
  allowR18: boolean
  allowCommercial: boolean
  requireCredit: boolean
  guidelines?: string | null
  referenceNotes?: string | null
  referenceVisibility: 'PUBLIC' | 'UNLISTED' | 'FOLLOWERS_ONLY' | 'PRIVATE'
  tags: string[]
  referenceArtworks: CharacterReferenceArtwork[]
  creator?: {
    id: string
    username: string
  }
}

const character = ref<Character | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const isRemovingRepresentative = ref(false)
const showArtworkSelector = ref(false)
const showReferenceSelector = ref(false)

const form = reactive({
  name: '',
  description: '',
  allowFanArt: true,
  fanArtPermission: 'EVERYONE' as 'EVERYONE' | 'FOLLOWERS_ONLY',
  allowR18: false,
  allowCommercial: false,
  requireCredit: true,
  guidelines: '',
  referenceNotes: '',
  referenceVisibility: 'PUBLIC' as 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE',
})

const tagInput = ref('')

// Parse comma-separated tags
const parsedTags = computed(() => {
  if (!tagInput.value.trim()) return []
  return tagInput.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
})

// Signed URL for avatar image
const avatarImageUrl = ref<string | null>(null)

// Signed URL cache for reference artworks
const referenceArtworkUrls = ref<Map<string, string>>(new Map())

// Fetch signed URL for avatar when character is loaded
const fetchAvatarSignedUrl = async () => {
  const artwork = character.value?.representativeArtwork
  if (!artwork?.images?.length) {
    avatarImageUrl.value = null
    return
  }
  const imageId = artwork.images[0].id
  try {
    avatarImageUrl.value = await getSignedUrl(imageId, true)
  } catch {
    const firstImage = artwork.images[0]
    avatarImageUrl.value = firstImage.thumbnailUrl || firstImage.url || null
  }
}

// Fetch signed URLs for reference artworks
const fetchReferenceArtworkUrls = async () => {
  const refs = character.value?.referenceArtworks
  if (!refs?.length) return

  for (const ref of refs) {
    const artwork = ref.artwork
    if (!artwork?.images?.length) continue
    const imageId = artwork.images[0].id
    if (referenceArtworkUrls.value.has(imageId)) continue

    try {
      const signedUrl = await getSignedUrl(imageId, true)
      referenceArtworkUrls.value.set(imageId, signedUrl)
    } catch {
      const firstImage = artwork.images[0]
      referenceArtworkUrls.value.set(imageId, firstImage.thumbnailUrl || firstImage.url || '')
    }
  }
}

const referenceArtworkIds = computed(() => {
  return character.value?.referenceArtworks?.map((r) => r.artworkId) || []
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    navigateTo(`/characters/${characterId.value}`)
  }
}

const getArtworkThumbnail = (artwork: ReferenceArtwork): string => {
  if (!artwork.images?.length) return ''
  const imageId = artwork.images[0].id
  return referenceArtworkUrls.value.get(imageId) || artwork.images[0].thumbnailUrl || artwork.images[0].url || ''
}

const fetchCharacter = async () => {
  try {
    isLoading.value = true
    error.value = null

    const data = await api.get<Character>(`/api/ocs/${characterId.value}`)

    // Check ownership
    if (data.creator?.id !== user.value?.id) {
      error.value = 'You can only edit your own characters'
      return
    }

    character.value = data

    // Populate form
    form.name = data.name
    form.description = data.description || ''
    tagInput.value = (data.tags || []).join(', ')
    form.allowFanArt = data.allowFanArt
    form.fanArtPermission = data.fanArtPermission
    form.allowR18 = data.allowR18
    form.allowCommercial = data.allowCommercial
    form.requireCredit = data.requireCredit
    form.guidelines = data.guidelines || ''
    form.referenceNotes = data.referenceNotes || ''
    form.referenceVisibility = data.referenceVisibility === 'UNLISTED' ? 'PUBLIC' : data.referenceVisibility
  } catch (e: any) {
    console.error('Failed to fetch character:', e)
    error.value = e.message || t('common.error')
  } finally {
    isLoading.value = false
  }
}

const handleSubmit = async () => {
  if (!form.name.trim()) return

  try {
    isSaving.value = true

    await api.put(`/api/ocs/${characterId.value}`, {
      name: form.name.trim(),
      description: form.description.trim() || null,
      tags: parsedTags.value,
      allowFanArt: form.allowFanArt,
      fanArtPermission: form.fanArtPermission,
      allowR18: form.allowR18,
      allowCommercial: form.allowCommercial,
      requireCredit: form.requireCredit,
      guidelines: form.guidelines.trim() || null,
      referenceNotes: form.referenceNotes.trim() || null,
      referenceVisibility: form.referenceVisibility,
    })

    toast.success(t('character.updated'))
    navigateTo(`/characters/${characterId.value}`)
  } catch (e: any) {
    console.error('Failed to update character:', e)
    toast.error(e.message || t('character.saveFailed'))
  } finally {
    isSaving.value = false
  }
}

const handleDelete = async () => {
  if (!confirm(t('character.deleteConfirm'))) return

  try {
    isDeleting.value = true
    await api.delete(`/api/ocs/${characterId.value}`)
    toast.success(t('character.deleted'))
    navigateTo('/characters')
  } catch (e: any) {
    console.error('Failed to delete character:', e)
    toast.error(e.message || t('common.error'))
  } finally {
    isDeleting.value = false
  }
}

const handleSelectRepresentative = async (artworkId: string) => {
  try {
    const updated = await api.put<Character>(
      `/api/ocs/${characterId.value}/representative`,
      { artworkId }
    )
    character.value = { ...character.value!, representativeArtwork: updated.representativeArtwork }
    showArtworkSelector.value = false
    // Update signed URL for new representative artwork
    await fetchAvatarSignedUrl()
    toast.success(t('character.saved'))
  } catch (e: any) {
    console.error('Failed to set representative artwork:', e)
    toast.error(e.message || t('common.error'))
  }
}

const handleRemoveRepresentative = async () => {
  try {
    isRemovingRepresentative.value = true
    await api.put(`/api/ocs/${characterId.value}/representative`, { artworkId: null })
    character.value = { ...character.value!, representativeArtwork: null }
    avatarImageUrl.value = null
    toast.success(t('character.saved'))
  } catch (e: any) {
    console.error('Failed to remove representative artwork:', e)
    toast.error(e.message || t('common.error'))
  } finally {
    isRemovingRepresentative.value = false
  }
}

const handleAddReference = async (artworkId: string) => {
  try {
    const newRef = await api.post<CharacterReferenceArtwork>(
      `/api/ocs/${characterId.value}/references`,
      { artworkId }
    )
    character.value = {
      ...character.value!,
      referenceArtworks: [...(character.value?.referenceArtworks || []), newRef],
    }
    showReferenceSelector.value = false

    // Fetch signed URL for the new reference artwork
    if (newRef.artwork?.images?.length) {
      const imageId = newRef.artwork.images[0].id
      try {
        const signedUrl = await getSignedUrl(imageId, true)
        referenceArtworkUrls.value.set(imageId, signedUrl)
      } catch {
        const firstImage = newRef.artwork.images[0]
        referenceArtworkUrls.value.set(imageId, firstImage.thumbnailUrl || firstImage.url || '')
      }
    }

    toast.success(t('character.reference.added'))
  } catch (e: any) {
    console.error('Failed to add reference artwork:', e)
    toast.error(e.message || t('common.error'))
  }
}

const handleRemoveReference = async (artworkId: string) => {
  try {
    await api.delete(`/api/ocs/${characterId.value}/references/${artworkId}`)
    character.value = {
      ...character.value!,
      referenceArtworks: character.value!.referenceArtworks.filter(
        (r) => r.artworkId !== artworkId
      ),
    }
    toast.success(t('character.reference.removed'))
  } catch (e: any) {
    console.error('Failed to remove reference artwork:', e)
    toast.error(e.message || t('common.error'))
  }
}

onMounted(async () => {
  await fetchCharacter()
  if (character.value) {
    await Promise.all([
      fetchAvatarSignedUrl(),
      fetchReferenceArtworkUrls(),
    ])
  }
})

useHead({
  title: () =>
    character.value
      ? `${t('character.edit')} - ${character.value.name}`
      : t('character.edit'),
})
</script>
