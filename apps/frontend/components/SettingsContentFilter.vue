<template>
  <div class="space-y-8">
    <!-- Birthday Section -->
    <section class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-lg font-semibold mb-4">{{ $t('settings.birthday') }}</h2>

      <!-- Birthday Input -->
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">{{ $t('settings.birthday') }}</label>
          <input
            v-model="birthdayInput"
            type="date"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            :max="maxBirthdayDate"
          />
        </div>

        <!-- Birthday Display Setting -->
        <div>
          <label class="block text-sm font-medium mb-2">{{ $t('settings.birthdayDisplay') }}</label>
          <select
            v-model="birthdayDisplay"
            class="w-full px-3 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="HIDDEN">{{ $t('settings.birthdayHidden') }}</option>
            <option value="MONTH_DAY">{{ $t('settings.birthdayMonthDay') }}</option>
            <option value="FULL_DATE">{{ $t('settings.birthdayFullDate') }}</option>
          </select>
        </div>

        <!-- Age Verification Status -->
        <div class="flex items-center gap-2 p-3 rounded-lg" :class="isAdult ? 'bg-green-500/10' : 'bg-yellow-500/10'">
          <Icon :name="isAdult ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'" class="w-5 h-5" :class="isAdult ? 'text-green-500' : 'text-yellow-500'" />
          <span class="text-sm">
            {{ isAdult ? $t('settings.ageVerified') : $t('settings.ageNotVerified') }}
          </span>
        </div>

        <button
          @click="saveBirthday"
          :disabled="isSavingBirthday"
          class="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {{ isSavingBirthday ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </section>

    <!-- Content Filters Section -->
    <section class="bg-[var(--color-surface)] rounded-lg p-6">
      <h2 class="text-lg font-semibold mb-2">{{ $t('settings.contentFilters') }}</h2>
      <p class="text-sm text-[var(--color-text-muted)] mb-4">{{ $t('settings.contentFiltersHint') }}</p>

      <div class="space-y-4">
        <!-- NSFW Filter -->
        <div class="flex items-center justify-between p-4 bg-[var(--color-background)] rounded-lg">
          <div>
            <div class="font-medium">{{ $t('settings.filterNsfw') }}</div>
            <div class="text-sm text-[var(--color-text-muted)]">{{ $t('settings.filterNsfwDesc') }}</div>
          </div>
          <select
            v-model="filters.nsfw"
            class="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="show">{{ $t('settings.filterShow') }}</option>
            <option value="blur">{{ $t('settings.filterBlur') }}</option>
            <option value="hide">{{ $t('settings.filterHide') }}</option>
          </select>
        </div>

        <!-- R-18 Filter -->
        <div class="flex items-center justify-between p-4 bg-[var(--color-background)] rounded-lg" :class="{ 'opacity-50': !isAdult }">
          <div>
            <div class="font-medium">{{ $t('settings.filterR18') }}</div>
            <div class="text-sm text-[var(--color-text-muted)]">{{ $t('settings.filterR18Desc') }}</div>
            <div v-if="!isAdult" class="text-xs text-[var(--color-warning-text)] mt-1">
              {{ $t('settings.filterDisabledUnder18') }}
            </div>
          </div>
          <select
            v-model="filters.r18"
            :disabled="!isAdult"
            class="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed"
          >
            <option value="show">{{ $t('settings.filterShow') }}</option>
            <option value="blur">{{ $t('settings.filterBlur') }}</option>
            <option value="hide">{{ $t('settings.filterHide') }}</option>
          </select>
        </div>

        <!-- R-18G Filter -->
        <div class="flex items-center justify-between p-4 bg-[var(--color-background)] rounded-lg" :class="{ 'opacity-50': !isAdult }">
          <div>
            <div class="font-medium">{{ $t('settings.filterR18g') }}</div>
            <div class="text-sm text-[var(--color-text-muted)]">{{ $t('settings.filterR18gDesc') }}</div>
            <div v-if="!isAdult" class="text-xs text-[var(--color-warning-text)] mt-1">
              {{ $t('settings.filterDisabledUnder18') }}
            </div>
          </div>
          <select
            v-model="filters.r18g"
            :disabled="!isAdult"
            class="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed"
          >
            <option value="show">{{ $t('settings.filterShow') }}</option>
            <option value="blur">{{ $t('settings.filterBlur') }}</option>
            <option value="hide">{{ $t('settings.filterHide') }}</option>
          </select>
        </div>

        <button
          @click="saveFilters"
          :disabled="isSavingFilters"
          class="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {{ isSavingFilters ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </section>

    <!-- Info Box -->
    <div class="p-4 bg-blue-500/10 rounded-lg">
      <div class="flex items-start gap-3">
        <Icon name="InformationCircleIcon" class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p class="text-sm text-[var(--color-text-muted)]">
          {{ $t('settings.ageVerificationHint') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const toast = useToast()

type FilterSetting = 'show' | 'blur' | 'hide'

interface ContentFilters {
  nsfw: FilterSetting
  r18: FilterSetting
  r18g: FilterSetting
}

// Birthday state
const birthdayInput = ref('')
const birthdayDisplay = ref<'HIDDEN' | 'MONTH_DAY' | 'FULL_DATE'>('HIDDEN')
const isAdult = ref(false)
const isSavingBirthday = ref(false)

// Content filters state
const filters = ref<ContentFilters>({
  nsfw: 'show',
  r18: 'hide',
  r18g: 'hide',
})
const isSavingFilters = ref(false)

// Max birthday date (must be at least 13 years old)
const maxBirthdayDate = computed(() => {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 13)
  return date.toISOString().split('T')[0]
})

// Response type for combined content settings
interface ContentSettingsResponse {
  birthday: string | null
  birthdayDisplay: 'HIDDEN' | 'MONTH_DAY' | 'FULL_DATE'
  isAdult: boolean
  contentFilters: ContentFilters
}

// Load initial data
const loadData = async () => {
  try {
    // Fetch all content settings (birthday + filters) in one request
    const data = await api.get<ContentSettingsResponse>('/api/users/me/content-settings')

    // Set birthday data
    birthdayInput.value = data.birthday || ''
    birthdayDisplay.value = data.birthdayDisplay
    isAdult.value = data.isAdult

    // Set content filters
    filters.value = data.contentFilters
  } catch (error) {
    console.error('Failed to load content filter settings:', error)
  }
}

// Save birthday
const saveBirthday = async () => {
  isSavingBirthday.value = true
  try {
    const result = await api.put<{ birthday: string | null; birthdayDisplay: string; isAdult: boolean }>(
      '/api/users/me/birthday',
      {
        birthday: birthdayInput.value || null,
        birthdayDisplay: birthdayDisplay.value,
      },
    )
    isAdult.value = result.isAdult
    toast.success(t('settings.birthdayUpdated'))

    // If user became adult, reload content filters (R-18 now available)
    if (result.isAdult) {
      await loadData()
    }
  } catch (error) {
    toast.error(t('settings.birthdayUpdateFailed'))
    console.error('Failed to save birthday:', error)
  } finally {
    isSavingBirthday.value = false
  }
}

// Save content filters
const saveFilters = async () => {
  isSavingFilters.value = true
  try {
    const result = await api.put<ContentFilters>('/api/users/me/content-filters', filters.value)
    filters.value = result
    toast.success(t('settings.filtersUpdated'))
  } catch (error) {
    toast.error(t('settings.filtersUpdateFailed'))
    console.error('Failed to save content filters:', error)
  } finally {
    isSavingFilters.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
