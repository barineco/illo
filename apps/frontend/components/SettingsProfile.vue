<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
      <p class="mt-4 text-[var(--color-text-muted)]">{{ $t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-[var(--color-danger-text)] mb-4">{{ error }}</p>
      <BaseButton
        variant="primary"
        size="md"
        shape="rounded"
        @click="fetchProfile"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Edit Form -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Error Message -->
      <div v-if="submitError" class="bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] rounded-lg p-4 mb-6">
        <p class="text-[var(--color-danger-text)]">{{ submitError }}</p>
      </div>

      <!-- Display Name -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <label for="displayName" class="block text-sm font-medium mb-2">
          {{ $t('settings.displayName') }}
        </label>
        <input
          id="displayName"
          v-model="form.displayName"
          type="text"
          maxlength="50"
          class="w-full px-4 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
          :placeholder="$t('settings.displayNamePlaceholder')"
        />
        <p class="text-sm text-[var(--color-text-muted)] mt-2">{{ form.displayName?.length || 0 }}/50</p>
      </div>

      <!-- Bio -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <label for="bio" class="block text-sm font-medium mb-2">
          {{ $t('settings.bio') }}
        </label>
        <textarea
          id="bio"
          v-model="form.bio"
          rows="6"
          maxlength="500"
          class="w-full px-4 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors resize-none"
          :placeholder="$t('settings.bioPlaceholder')"
        ></textarea>
        <p class="text-sm text-[var(--color-text-muted)] mt-2">{{ form.bio?.length || 0 }}/500</p>
      </div>

      <!-- Social Links -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">{{ $t('settings.websiteSocial') }}</h3>

        <!-- Custom Links -->
        <div class="flex items-center justify-between mb-3">
          <label class="flex items-center gap-2 text-sm font-medium">
            <Icon name="Link" class="w-4 h-4" />
            {{ $t('settings.customLinks') }}
          </label>
          <span class="text-xs text-[var(--color-text-muted)]">
            {{ form.socialLinks.customLinks?.length || 0 }}/5
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="(link, index) in form.socialLinks.customLinks"
            :key="index"
            class="flex gap-2 items-start"
          >
            <input
              v-model="link.title"
              type="text"
              maxlength="30"
              class="w-32 px-3 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors text-sm"
              :placeholder="$t('settings.linkTitle')"
            />
            <input
              v-model="link.url"
              type="url"
              class="flex-1 px-3 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors text-sm"
              placeholder="https://..."
            />
            <button
              type="button"
              class="flex items-center justify-center w-10 h-10 bg-[var(--color-danger-bg)] hover:bg-[var(--color-danger-border)] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] rounded-lg transition-colors"
              :title="$t('common.delete')"
              @click="removeCustomLink(index)"
            >
              <Icon name="XMark" class="w-4 h-4" />
            </button>
          </div>
          <button
            v-if="canAddMoreLinks"
            type="button"
            class="flex items-center gap-2 px-4 py-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-hover)] rounded-lg transition-colors"
            @click="addCustomLink"
          >
            <Icon name="Plus" class="w-4 h-4" />
            {{ $t('settings.addLink') }}
          </button>
        </div>
      </div>

      <!-- Avatar Image -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">{{ $t('settings.avatar') }}</h3>

        <div class="flex items-center gap-6">
          <!-- Current Avatar -->
          <div class="w-24 h-24 rounded-full bg-[var(--color-surface-secondary)] flex-shrink-0 overflow-hidden">
            <img
              v-if="currentProfile?.avatarUrl"
              :src="currentProfile.avatarUrl"
              :alt="$t('settings.avatar')"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Icon name="UserCircle" class="w-16 h-16 text-[var(--color-text-muted)]" />
            </div>
          </div>

          <!-- Upload Controls -->
          <div class="flex-1">
            <input
              ref="avatarInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleAvatarChange"
            />
            <BaseButton
              type="button"
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="isUploadingAvatar"
              :loading="isUploadingAvatar"
              @click="avatarInput?.click()"
            >
              {{ $t('settings.selectImage') }}
            </BaseButton>
            <p class="text-sm text-[var(--color-text-muted)] mt-2">
              {{ $t('settings.recommendedAvatar') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Cover Image -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">{{ $t('settings.coverImage') }}</h3>

        <div class="space-y-4">
          <!-- Current Cover -->
          <div class="w-full h-48 rounded-lg bg-[var(--color-surface-secondary)] overflow-hidden">
            <img
              v-if="currentProfile?.coverImageUrl"
              :src="currentProfile.coverImageUrl"
              :alt="$t('settings.coverImage')"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
              {{ $t('settings.noCoverImage') }}
            </div>
          </div>

          <!-- Upload Controls -->
          <div>
            <input
              ref="coverInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleCoverChange"
            />
            <BaseButton
              type="button"
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="isUploadingCover"
              :loading="isUploadingCover"
              @click="coverInput?.click()"
            >
              {{ $t('settings.selectImage') }}
            </BaseButton>
            <p class="text-sm text-[var(--color-text-muted)] mt-2">
              {{ $t('settings.recommendedCover') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Submit Buttons -->
      <div class="flex gap-4 justify-end">
        <BaseButton
          type="button"
          variant="secondary"
          size="lg"
          shape="rounded"
          @click="navigateTo(`/users/${user?.username}`)"
        >
          {{ $t('common.cancel') }}
        </BaseButton>
        <BaseButton
          type="submit"
          variant="primary"
          size="lg"
          shape="rounded"
          :disabled="isSubmitting"
          :loading="isSubmitting"
        >
          {{ $t('common.save') }}
        </BaseButton>
      </div>
    </form>

    <!-- Tools Section (integrated from SettingsTools) -->
    <div class="mt-8">
      <SettingsTools />
    </div>

    <!-- Avatar Cropper Modal -->
    <CropperModal
      :is-open="showAvatarCropper"
      :image-source="avatarFileToUpload"
      :aspect-ratio="1"
      stencil-type="circle"
      :title="$t('cropper.cropAvatar')"
      @close="cancelAvatarUpload"
      @confirm="onAvatarCropConfirm"
    />

    <!-- Cover Cropper Modal -->
    <CropperModal
      :is-open="showCoverCropper"
      :image-source="coverFileToUpload"
      :aspect-ratio="16/9"
      stencil-type="rectangle"
      :title="$t('cropper.cropCover')"
      @close="cancelCoverUpload"
      @confirm="onCoverCropConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { CropCoordinates } from '~/components/CropperModal.vue'
const { t } = useI18n()
const { user, updateUserProfile } = useAuth()
const api = useApi()
const toast = useToast()

const loading = ref(true)
const error = ref<string | null>(null)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const isUploadingAvatar = ref(false)
const isUploadingCover = ref(false)

const avatarInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const currentProfile = ref<any>(null)

// Cropper state
const showAvatarCropper = ref(false)
const showCoverCropper = ref(false)
const avatarFileToUpload = ref<File | null>(null)
const coverFileToUpload = ref<File | null>(null)

interface CustomLink {
  url: string
  title: string
}

interface SocialLinks {
  bluesky?: string
  customLinks?: CustomLink[]
}

interface ProfileForm {
  displayName: string
  bio: string
  socialLinks: SocialLinks
}

const form = ref<ProfileForm>({
  displayName: '',
  bio: '',
  socialLinks: {
    bluesky: '',
    customLinks: [],
  },
})

// Custom links helpers
const MAX_CUSTOM_LINKS = 5

const canAddMoreLinks = computed(() => {
  return (form.value.socialLinks.customLinks?.length || 0) < MAX_CUSTOM_LINKS
})

const addCustomLink = () => {
  if (!form.value.socialLinks.customLinks) {
    form.value.socialLinks.customLinks = []
  }
  if (form.value.socialLinks.customLinks.length < MAX_CUSTOM_LINKS) {
    form.value.socialLinks.customLinks.push({ url: '', title: '' })
  }
}

const removeCustomLink = (index: number) => {
  form.value.socialLinks.customLinks?.splice(index, 1)
}

// Fetch current profile
const fetchProfile = async () => {
  if (!user.value) {
    error.value = t('settings.loginRequired')
    return
  }

  try {
    loading.value = true
    error.value = null

    // Use /users/:username (without /api prefix) for GET - ActivityPub compatible endpoint
    // Need to use baseURL from api composable to ensure proper routing in dev environment
    const response = await fetch(`${api.baseURL}/users/${user.value.username}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`)
    }
    const profile = await response.json()

    currentProfile.value = profile
    form.value = {
      displayName: profile.displayName || '',
      bio: profile.bio || '',
      socialLinks: {
        bluesky: profile.socialLinks?.bluesky || '',
        customLinks: profile.socialLinks?.customLinks || [],
      },
    }
  } catch (e: any) {
    console.error('Failed to fetch profile:', e)
    error.value = e.message || t('settings.profileLoadFailed')
  } finally {
    loading.value = false
  }
}

// Submit profile update
const handleSubmit = async () => {
  if (!user.value) return

  try {
    isSubmitting.value = true
    submitError.value = null

    // Filter out empty social links
    const socialLinks: SocialLinks = {}
    if (form.value.socialLinks.bluesky) socialLinks.bluesky = form.value.socialLinks.bluesky

    // Filter custom links to only include those with both title and url
    const validCustomLinks = form.value.socialLinks.customLinks?.filter(
      link => link.url.trim() && link.title.trim()
    ) || []
    if (validCustomLinks.length > 0) {
      socialLinks.customLinks = validCustomLinks
    }

    await api.put(`/api/users/${user.value.username}`, {
      displayName: form.value.displayName,
      bio: form.value.bio,
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
    })

    toast.success(t('settings.profileUpdated'))
  } catch (e: any) {
    console.error('Failed to update profile:', e)
    submitError.value = e.message || t('settings.profileUpdateFailed')
  } finally {
    isSubmitting.value = false
  }
}

// Upload avatar - open cropper first
const handleAvatarChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file || !user.value) return

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    submitError.value = t('settings.imageSizeLimit')
    if (avatarInput.value) avatarInput.value.value = ''
    return
  }

  // Store file and open cropper
  avatarFileToUpload.value = file
  showAvatarCropper.value = true
}

// Cancel avatar upload
const cancelAvatarUpload = () => {
  showAvatarCropper.value = false
  avatarFileToUpload.value = null
  if (avatarInput.value) avatarInput.value.value = ''
}

// Confirm avatar crop and upload
const onAvatarCropConfirm = async (coordinates: CropCoordinates) => {
  showAvatarCropper.value = false

  if (!avatarFileToUpload.value || !user.value) {
    avatarFileToUpload.value = null
    return
  }

  try {
    isUploadingAvatar.value = true
    submitError.value = null

    const formData = new FormData()
    formData.append('avatar', avatarFileToUpload.value)
    formData.append('cropX', String(coordinates.x))
    formData.append('cropY', String(coordinates.y))
    formData.append('cropWidth', String(coordinates.width))
    formData.append('cropHeight', String(coordinates.height))

    const data = await api.uploadFormData<{ avatarUrl: string }>(
      `/api/users/${user.value.username}/avatar`,
      formData
    )

    // Update current profile with cache-busting parameter
    const updatedAvatarUrl = data.avatarUrl + '?t=' + Date.now()
    if (currentProfile.value) {
      currentProfile.value.avatarUrl = updatedAvatarUrl
    }

    // Update auth user state to reflect in header immediately
    updateUserProfile({ avatarUrl: updatedAvatarUrl })

    toast.success(t('settings.avatarUpdated'))
  } catch (e: any) {
    console.error('Failed to upload avatar:', e)
    submitError.value = e.message || t('settings.uploadFailed')
  } finally {
    isUploadingAvatar.value = false
    avatarFileToUpload.value = null
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

// Upload cover - open cropper first
const handleCoverChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file || !user.value) return

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    submitError.value = t('settings.imageSizeLimit')
    if (coverInput.value) coverInput.value.value = ''
    return
  }

  // Store file and open cropper
  coverFileToUpload.value = file
  showCoverCropper.value = true
}

// Cancel cover upload
const cancelCoverUpload = () => {
  showCoverCropper.value = false
  coverFileToUpload.value = null
  if (coverInput.value) coverInput.value.value = ''
}

// Confirm cover crop and upload
const onCoverCropConfirm = async (coordinates: CropCoordinates) => {
  showCoverCropper.value = false

  if (!coverFileToUpload.value || !user.value) {
    coverFileToUpload.value = null
    return
  }

  try {
    isUploadingCover.value = true
    submitError.value = null

    const formData = new FormData()
    formData.append('cover', coverFileToUpload.value)
    formData.append('cropX', String(coordinates.x))
    formData.append('cropY', String(coordinates.y))
    formData.append('cropWidth', String(coordinates.width))
    formData.append('cropHeight', String(coordinates.height))

    const data = await api.uploadFormData<{ coverImageUrl: string }>(
      `/api/users/${user.value.username}/cover`,
      formData
    )

    // Update current profile with cache-busting parameter
    const updatedCoverUrl = data.coverImageUrl + '?t=' + Date.now()
    if (currentProfile.value) {
      currentProfile.value.coverImageUrl = updatedCoverUrl
    }

    // Update auth user state to reflect in header immediately
    updateUserProfile({ coverImageUrl: updatedCoverUrl })

    toast.success(t('settings.coverUpdated'))
  } catch (e: any) {
    console.error('Failed to upload cover:', e)
    submitError.value = e.message || t('settings.uploadFailed')
  } finally {
    isUploadingCover.value = false
    coverFileToUpload.value = null
    if (coverInput.value) coverInput.value.value = ''
  }
}

// Fetch profile on mount
onMounted(() => {
  fetchProfile()
})
</script>
