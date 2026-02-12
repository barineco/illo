<template>
  <div class="min-h-screen bg-[var(--color-background)]">
    <div class="max-w-3xl mx-auto px-4 py-8">
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
          {{ $t('character.create') }}
        </h1>
      </div>

      <!-- Form -->
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
                v-if="selectedArtworkThumbnail"
                :src="selectedArtworkThumbnail"
                alt=""
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
                  {{ selectedArtworkId ? $t('character.changeRepresentative') : $t('character.selectRepresentative') }}
                </BaseButton>
                <BaseButton
                  v-if="selectedArtworkId"
                  type="button"
                  variant="outline"
                  size="md"
                  shape="rounded"
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
              <!-- Allow R18 -->
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

              <!-- Allow Commercial -->
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

              <!-- Require Credit -->
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

            <!-- Free Text Guidelines -->
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

          <!-- Reference Notes -->
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

          <!-- Visibility -->
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
            <p class="text-sm text-[var(--color-text-muted)] mt-1">
              {{ $t('character.reference.visibilityHint') }}
            </p>
          </div>
        </div>

        <!-- Submit -->
        <div class="flex justify-end gap-4">
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
            {{ $t('common.create') }}
          </BaseButton>
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

const router = useRouter()
const { t } = useI18n()
const api = useApi()
const toast = useToast()
const { getSignedUrl } = useSignedImageUrlOnce()

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
const isSaving = ref(false)
const showArtworkSelector = ref(false)
const selectedArtworkId = ref<string | null>(null)
const selectedArtworkThumbnail = ref<string | null>(null)

// Parse comma-separated tags
const parsedTags = computed(() => {
  if (!tagInput.value.trim()) return []
  return tagInput.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    navigateTo('/characters')
  }
}

interface ArtworkWithImages {
  id: string
  images?: Array<{
    id: string
    thumbnailUrl?: string | null
    url?: string | null
  }>
}

const handleSelectRepresentative = async (artworkId: string) => {
  try {
    // Fetch the artwork to get its thumbnail
    const artwork = await api.get<ArtworkWithImages>(`/api/artworks/${artworkId}`)
    selectedArtworkId.value = artworkId
    showArtworkSelector.value = false

    // Get signed URL for thumbnail
    if (artwork.images?.length) {
      const firstImage = artwork.images[0]
      try {
        selectedArtworkThumbnail.value = await getSignedUrl(firstImage.id, true)
      } catch {
        selectedArtworkThumbnail.value = firstImage.thumbnailUrl || firstImage.url || null
      }
    }
  } catch (e: any) {
    console.error('Failed to select artwork:', e)
    toast.error(e.message || t('common.error'))
  }
}

const handleRemoveRepresentative = () => {
  selectedArtworkId.value = null
  selectedArtworkThumbnail.value = null
}

const handleSubmit = async () => {
  if (!form.name.trim()) return

  try {
    isSaving.value = true

    const character = await api.post<{ id: string }>('/api/ocs', {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      tags: parsedTags.value.length > 0 ? parsedTags.value : undefined,
      representativeArtworkId: selectedArtworkId.value || undefined,
      allowFanArt: form.allowFanArt,
      fanArtPermission: form.allowFanArt ? form.fanArtPermission : undefined,
      allowR18: form.allowFanArt ? form.allowR18 : undefined,
      allowCommercial: form.allowFanArt ? form.allowCommercial : undefined,
      requireCredit: form.allowFanArt ? form.requireCredit : undefined,
      guidelines: form.allowFanArt && form.guidelines.trim() ? form.guidelines.trim() : undefined,
      referenceNotes: form.referenceNotes.trim() || undefined,
      referenceVisibility: form.referenceVisibility,
    })

    toast.success(t('character.created'))
    navigateTo(`/characters/${character.id}`)
  } catch (e: any) {
    console.error('Failed to create character:', e)
    toast.error(e.message || t('character.saveFailed'))
  } finally {
    isSaving.value = false
  }
}

useHead({
  title: () => t('character.create'),
})
</script>
