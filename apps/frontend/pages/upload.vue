<template>
  <div class="upload-page">
    <div class="container">
      <h1 class="page-title">{{ $t('upload.title') }}</h1>

      <form @submit.prevent="handleSubmit" class="upload-form">
        <!-- 画像アップロード -->
        <div class="form-section">
          <label class="section-label required">{{ $t('upload.images') }}</label>
          <ImageUploader @update:images="images = $event" />
        </div>

        <!-- Form Fields Component -->
        <ArtworkFormFields
          v-model="form"
          v-model:tags-input="tagsInput"
        />

        <!-- コレクション選択 -->
        <div class="form-section">
          <label class="section-label">
            {{ $t('upload.addToCollection') }}
            <span class="label-hint">({{ $t('linkCard.optional') }})</span>
          </label>
          <CollectionSelector v-model="selectedCollectionIds" />
        </div>

        <!-- リンクカード画像 -->
        <div class="form-section">
          <label class="section-label">
            {{ $t('linkCard.title') }}
            <span class="label-hint">({{ $t('linkCard.optional') }})</span>
          </label>
          <p class="text-sm text-[var(--color-text-muted)] mb-3">
            {{ $t('linkCard.description') }}
          </p>
          <LinkCardUploader
            :image-source="firstImage"
            v-model:blur="linkCardBlur"
            v-model:crop-coordinates="linkCardCropCoordinates"
            :age-rating="form.ageRating"
            :original-width="firstImageOriginalWidth"
            :original-height="firstImageOriginalHeight"
          />
        </div>

        <!-- エラーメッセージ -->
        <div v-if="error" class="error-box">
          {{ error }}
        </div>

        <!-- アップロードプログレス -->
        <div v-if="isSubmitting" class="upload-progress-section">
          <div class="progress-header">
            <span class="progress-label">{{ $t('upload.uploading') }}</span>
            <span class="progress-percent">{{ uploadProgress }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: `${uploadProgress}%` }"
            />
          </div>
          <p class="progress-hint">{{ $t('upload.uploadingHint') }}</p>
        </div>

        <!-- 送信ボタン -->
        <div class="form-actions">
          <BaseButton
            variant="outline"
            size="lg"
            shape="rounded"
            @click="navigateTo('/')"
          >
            {{ $t('common.cancel') }}
          </BaseButton>
          <BaseButton
            type="submit"
            variant="primary"
            size="lg"
            shape="rounded"
            :disabled="isSubmitting || !isValid"
            :loading="isSubmitting"
          >
            {{ $t('upload.submit') }}
          </BaseButton>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ArtworkFormData } from '~/components/artwork/ArtworkFormFields.vue'
import type { CropCoordinates } from '~/components/CropperModal.vue'

const { t } = useI18n()
const route = useRoute()

definePageMeta({
  middleware: 'auth',
})

const api = useApi()
const { isAuthenticated } = useAuth()
const { getSignedUrl } = useSignedImageUrlOnce()

const images = ref<File[]>([])
const linkCardCropCoordinates = ref<CropCoordinates | null>(null)
const linkCardBlur = ref(false)

// First image for link card cropping
const firstImage = computed(() => images.value[0] || null)

// Original image dimensions for first image (needed for coordinate transformation)
const firstImageOriginalWidth = ref<number | undefined>(undefined)
const firstImageOriginalHeight = ref<number | undefined>(undefined)

// Reset crop coordinates and get dimensions when first image changes
watch(firstImage, (file) => {
  linkCardCropCoordinates.value = null
  firstImageOriginalWidth.value = undefined
  firstImageOriginalHeight.value = undefined

  if (file) {
    // Get dimensions from File
    const img = new Image()
    img.onload = () => {
      firstImageOriginalWidth.value = img.naturalWidth
      firstImageOriginalHeight.value = img.naturalHeight
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  }
})
const tagsInput = ref('')
const selectedCollectionIds = ref<string[]>([])
const isSubmitting = ref(false)
const uploadProgress = ref(0)
const error = ref('')

const form = ref<ArtworkFormData>({
  title: '',
  description: '',
  type: 'ILLUSTRATION',
  ageRating: 'ALL_AGES',
  visibility: 'PUBLIC',
  disableRightClick: true,
  license: '',  // Empty = use default license
  customLicenseUrl: '',
  customLicenseText: '',
  // Creation metadata (portfolio fields)
  creationDate: '',
  creationPeriodValue: undefined,
  creationPeriodUnit: undefined,
  isCommission: false,
  clientName: '',
  projectName: '',
  medium: undefined,
  externalUrl: '',
  toolsUsed: [],
  // Copyright/Rights information
  copyrightType: undefined,
  copyrightHolder: '',
  copyrightNote: '',
  originalCreatorId: undefined,
  originalCreator: undefined,
  originalCreatorAllowDownload: false,
  // Fan art character
  characterId: undefined,
  character: undefined,
})

const parsedTags = computed(() => {
  if (!tagsInput.value.trim()) return []
  return tagsInput.value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
})

const isValid = computed(() => {
  return (
    images.value.length > 0 &&
    form.value.title.trim().length > 0 &&
    form.value.type &&
    form.value.ageRating
  )
})

const handleSubmit = async () => {
  if (!isAuthenticated.value) {
    error.value = t('upload.loginRequired')
    return
  }

  if (!isValid.value) {
    error.value = t('upload.fillRequired')
    return
  }

  isSubmitting.value = true
  uploadProgress.value = 0
  error.value = ''

  try {
    const formData = new FormData()
    formData.append('title', form.value.title)
    formData.append('description', form.value.description)
    formData.append('type', form.value.type)
    formData.append('ageRating', form.value.ageRating)
    formData.append('visibility', form.value.visibility)
    formData.append('disableRightClick', String(form.value.disableRightClick))

    // ライセンス情報を追加
    if (form.value.license) {
      formData.append('license', form.value.license)
    }
    if (form.value.customLicenseUrl) {
      formData.append('customLicenseUrl', form.value.customLicenseUrl)
    }
    if (form.value.customLicenseText) {
      formData.append('customLicenseText', form.value.customLicenseText)
    }

    // タグを追加
    parsedTags.value.forEach(tag => {
      formData.append('tags', tag)
    })

    // 制作メタデータを追加
    if (form.value.creationDate) {
      formData.append('creationDate', form.value.creationDate)
    }
    if (form.value.creationPeriodValue) {
      formData.append('creationPeriodValue', String(form.value.creationPeriodValue))
    }
    if (form.value.creationPeriodUnit) {
      formData.append('creationPeriodUnit', form.value.creationPeriodUnit)
    }
    formData.append('isCommission', String(form.value.isCommission))
    if (form.value.clientName) {
      formData.append('clientName', form.value.clientName)
    }
    if (form.value.projectName) {
      formData.append('projectName', form.value.projectName)
    }
    if (form.value.medium) {
      formData.append('medium', form.value.medium)
    }
    if (form.value.externalUrl) {
      formData.append('externalUrl', form.value.externalUrl)
    }
    if (form.value.toolsUsed && form.value.toolsUsed.length > 0) {
      formData.append('toolsUsed', JSON.stringify(form.value.toolsUsed))
    }

    // 権利情報を追加
    if (form.value.copyrightType) {
      formData.append('copyrightType', form.value.copyrightType)
    }
    if (form.value.copyrightHolder) {
      formData.append('copyrightHolder', form.value.copyrightHolder)
    }
    if (form.value.copyrightNote) {
      formData.append('copyrightNote', form.value.copyrightNote)
    }
    if (form.value.originalCreatorId) {
      formData.append('originalCreatorId', form.value.originalCreatorId)
    }
    if (form.value.originalCreatorAllowDownload) {
      formData.append('originalCreatorAllowDownload', String(form.value.originalCreatorAllowDownload))
    }
    if (form.value.characterId) {
      formData.append('characterId', form.value.characterId)
    }

    // コレクションを追加
    if (selectedCollectionIds.value.length > 0) {
      formData.append('collectionIds', JSON.stringify(selectedCollectionIds.value))
    }

    // 画像を追加
    images.value.forEach((file) => {
      formData.append('images', file)
    })

    // リンクカード切り抜き座標を追加
    if (linkCardCropCoordinates.value) {
      formData.append('ogCardCropX', String(linkCardCropCoordinates.value.x))
      formData.append('ogCardCropY', String(linkCardCropCoordinates.value.y))
      formData.append('ogCardCropWidth', String(linkCardCropCoordinates.value.width))
      formData.append('ogCardCropHeight', String(linkCardCropCoordinates.value.height))
    }
    formData.append('ogCardBlur', String(linkCardBlur.value))

    const result = await api.uploadFormDataWithProgress<any>(
      '/api/artworks',
      formData,
      (percent) => {
        uploadProgress.value = percent
      }
    )

    // OGカード生成（常に実行 - 座標未指定時はデフォルト中央切り抜き）
    const firstImageId = result.images?.[0]?.id
    if (firstImageId) {
      try {
        await api.post(`/api/artworks/${result.id}/og-card`, {
          imageId: firstImageId,
          cropRegion: linkCardCropCoordinates.value || undefined,
          blur: linkCardBlur.value,
        })
      } catch (e) {
        console.error('Failed to generate OG card:', e)
      }
    }

    // 投稿成功 - 作品詳細ページへリダイレクト
    navigateTo(`/artworks/${result.id}`)
  } catch (err: any) {
    console.error('Upload failed:', err)
    error.value = err.data?.message || t('upload.uploadFailed')
  } finally {
    isSubmitting.value = false
  }
}

// Fetch user tools settings and apply defaults
const fetchToolsSettings = async () => {
  try {
    const data = await api.get<{ tools: string[]; useProfileToolsAsDefault: boolean }>('/api/users/me/tools')
    if (data.useProfileToolsAsDefault && data.tools && data.tools.length > 0) {
      form.value.toolsUsed = [...data.tools]
    }
  } catch (e) {
    // Silently fail - not critical for upload functionality
    console.error('Failed to fetch tools settings:', e)
  }
}

// Fetch character from query parameter
const fetchCharacterFromQuery = async () => {
  const characterId = route.query.characterId as string | undefined
  if (!characterId) return

  try {
    interface CharacterResponse {
      id: string
      name: string
      allowFanArt: boolean
      representativeArtwork?: {
        id: string
        images?: { id: string; thumbnailUrl?: string | null }[]
      } | null
      creator?: {
        id: string
        username: string
        displayName?: string | null
      }
    }
    const character = await api.get<CharacterResponse>(`/api/ocs/${characterId}`)
    if (character.allowFanArt) {
      form.value.characterId = character.id
      // Get signed URL for avatar from representative artwork
      let avatarUrl: string | null = null
      const firstImage = character.representativeArtwork?.images?.[0]
      if (firstImage) {
        try {
          avatarUrl = await getSignedUrl(firstImage.id, true)
        } catch {
          avatarUrl = firstImage.thumbnailUrl || null
        }
      }
      form.value.character = {
        id: character.id,
        name: character.name,
        avatarUrl,
        creator: character.creator,
      }
    }
  } catch (e) {
    console.error('Failed to fetch character from query:', e)
  }
}

// 認証チェック
onMounted(async () => {
  if (!isAuthenticated.value) {
    navigateTo('/login')
  } else {
    // Fetch default tools and character from query in parallel
    await Promise.all([
      fetchToolsSettings(),
      fetchCharacterFromQuery(),
    ])
  }
})
</script>

<style scoped>
.upload-page {
  min-height: 100vh;
  background: var(--color-background);
  padding: 2rem 0;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 2rem;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.section-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-label.required::after {
  content: '必須';
  background: var(--color-danger);
  color: white;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
}

.label-hint {
  font-weight: 400;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.error-box {
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger);
  border-radius: 6px;
  padding: 1rem;
  color: var(--color-danger-text);
  font-size: 0.875rem;
}

.upload-progress-section {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.25rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-label {
  font-weight: 500;
  color: var(--color-text);
}

.progress-percent {
  font-weight: 600;
  color: var(--color-primary);
}

.progress-bar {
  height: 8px;
  background: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 4px;
  transition: width 0.2s ease-out;
}

.progress-hint {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
}
</style>
