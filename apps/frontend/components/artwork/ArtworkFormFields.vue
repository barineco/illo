<template>
  <div class="space-y-6">
    <!-- Title -->
    <div class="form-section">
      <label for="title" class="section-label required">{{ $t('upload.title_field') }}</label>
      <input
        id="title"
        :value="modelValue.title"
        @input="updateField('title', ($event.target as HTMLInputElement).value)"
        type="text"
        class="input-field"
        :placeholder="$t('upload.titlePlaceholder')"
        maxlength="200"
        required
      />
      <p class="char-count">{{ modelValue.title.length }}/200</p>
    </div>

    <!-- Description -->
    <div class="form-section">
      <label for="description" class="section-label">{{ $t('upload.caption') }}</label>
      <textarea
        id="description"
        :value="modelValue.description"
        @input="updateField('description', ($event.target as HTMLTextAreaElement).value)"
        class="textarea-field"
        :placeholder="$t('upload.descriptionPlaceholder')"
        rows="6"
        maxlength="5000"
      />
      <p class="char-count">{{ modelValue.description.length }}/5000</p>
    </div>

    <!-- Tags -->
    <div class="form-section">
      <label for="tags" class="section-label">
        {{ $t('upload.tags') }}
        <span class="label-hint">({{ $t('upload.tagsHint') }})</span>
      </label>
      <input
        id="tags"
        :value="tagsInput"
        @input="$emit('update:tagsInput', ($event.target as HTMLInputElement).value)"
        type="text"
        class="input-field"
        :placeholder="$t('upload.tagsPlaceholder')"
      />
      <div v-if="parsedTags.length > 0" class="tag-preview">
        <TagChip v-for="tag in parsedTags" :key="tag" :tag="tag" />
      </div>
    </div>

    <!-- Artwork Type -->
    <div class="form-section">
      <label class="section-label required">{{ $t('upload.artworkType') }}</label>
      <div class="radio-group">
        <label class="radio-label">
          <input
            :checked="modelValue.type === 'ILLUSTRATION'"
            @change="updateField('type', 'ILLUSTRATION')"
            type="radio"
            name="artworkType"
            required
          />
          <span>{{ $t('upload.typeIllustration') }}</span>
        </label>
        <label class="radio-label">
          <input
            :checked="modelValue.type === 'MANGA'"
            @change="updateField('type', 'MANGA')"
            type="radio"
            name="artworkType"
          />
          <span>{{ $t('upload.typeManga') }}</span>
        </label>
      </div>
    </div>

    <!-- Age Rating -->
    <div class="form-section">
      <label class="section-label required">{{ $t('upload.ageRating') }}</label>
      <div class="radio-group">
        <label class="radio-label">
          <input
            :checked="modelValue.ageRating === 'ALL_AGES'"
            @change="updateField('ageRating', 'ALL_AGES')"
            type="radio"
            name="ageRating"
            required
          />
          <span>{{ $t('upload.allAges') }}</span>
        </label>
        <label class="radio-label">
          <input
            :checked="modelValue.ageRating === 'NSFW'"
            @change="updateField('ageRating', 'NSFW')"
            type="radio"
            name="ageRating"
          />
          <span>{{ $t('upload.nsfw') }}</span>
          <Tooltip :content="$t('upload.nsfwTooltip')" position="top" />
        </label>
        <label class="radio-label">
          <input
            :checked="modelValue.ageRating === 'R18'"
            @change="updateField('ageRating', 'R18')"
            type="radio"
            name="ageRating"
          />
          <span>{{ $t('upload.r18') }}</span>
        </label>
        <label class="radio-label">
          <input
            :checked="modelValue.ageRating === 'R18G'"
            @change="updateField('ageRating', 'R18G')"
            type="radio"
            name="ageRating"
          />
          <span>{{ $t('upload.r18g') }}</span>
        </label>
      </div>
    </div>

    <!-- Visibility -->
    <div class="form-section">
      <label class="section-label required">{{ $t('upload.visibility') }}</label>
      <div class="radio-group vertical">
        <label class="radio-label with-icon">
          <input
            :checked="modelValue.visibility === 'PUBLIC'"
            @change="updateField('visibility', 'PUBLIC')"
            type="radio"
            name="visibility"
            required
          />
          <Icon name="GlobeAlt" class="visibility-icon" />
          <div class="radio-content">
            <span class="radio-title">{{ $t('upload.visibilityPublic') }}</span>
          </div>
          <Tooltip :content="$t('upload.visibilityPublicTooltip')" position="right" />
        </label>
        <label class="radio-label with-icon">
          <input
            :checked="modelValue.visibility === 'UNLISTED'"
            @change="updateField('visibility', 'UNLISTED')"
            type="radio"
            name="visibility"
          />
          <Icon name="Moon" class="visibility-icon" />
          <div class="radio-content">
            <span class="radio-title">{{ $t('upload.visibilityUnlisted') }}</span>
          </div>
          <Tooltip :content="$t('upload.visibilityUnlistedTooltip')" position="right" />
        </label>
        <label class="radio-label with-icon">
          <input
            :checked="modelValue.visibility === 'FOLLOWERS_ONLY'"
            @change="updateField('visibility', 'FOLLOWERS_ONLY')"
            type="radio"
            name="visibility"
          />
          <Icon name="LockClosed" class="visibility-icon" />
          <div class="radio-content">
            <span class="radio-title">{{ $t('upload.visibilityFollowers') }}</span>
          </div>
          <Tooltip :content="$t('upload.visibilityFollowersTooltip')" position="right" />
        </label>
        <label class="radio-label with-icon">
          <input
            :checked="modelValue.visibility === 'PRIVATE'"
            @change="updateField('visibility', 'PRIVATE')"
            type="radio"
            name="visibility"
          />
          <Icon name="AtSymbol" class="visibility-icon" />
          <div class="radio-content">
            <span class="radio-title">{{ $t('upload.visibilityPrivate') }}</span>
          </div>
          <Tooltip :content="$t('upload.visibilityPrivateTooltip')" position="right" />
        </label>
      </div>
    </div>

    <!-- License Settings -->
    <div class="form-section">
      <label class="section-label">{{ $t('upload.licenseSettings') }}</label>
      <p class="text-sm text-[var(--color-text-muted)] mb-3">{{ $t('upload.licenseHint') }}</p>
      <select
        :value="modelValue.license"
        @change="updateField('license', ($event.target as HTMLSelectElement).value)"
        class="input-field mb-3"
      >
        <option value="">{{ $t('upload.licenseDefault') }}</option>
        <option value="All Rights Reserved">{{ $t('upload.licenseAllRights') }}</option>
        <option value="Fan Art">{{ $t('upload.licenseFanArt') }}</option>
        <option value="CC0">{{ $t('upload.licenseCC0') }}</option>
        <option value="CC BY 4.0">{{ $t('upload.licenseCCBY') }}</option>
        <option value="CC BY-SA 4.0">{{ $t('upload.licenseCCBYSA') }}</option>
        <option value="CC BY-NC 4.0">{{ $t('upload.licenseCCBYNC') }}</option>
        <option value="CC BY-NC-ND 4.0">{{ $t('upload.licenseCCBYNCND') }}</option>
        <option value="CC BY-ND 4.0">{{ $t('upload.licenseCCBYND') }}</option>
        <option value="CC BY-NC-SA 4.0">{{ $t('upload.licenseCCBYNCSA') }}</option>
        <option value="Custom">{{ $t('upload.licenseCustom') }}</option>
      </select>

      <!-- Custom License Inputs -->
      <div v-if="modelValue.license === 'Custom'" class="mt-3 space-y-3">
        <div>
          <label for="customLicenseUrl" class="text-sm text-[var(--color-text-muted)] block mb-2">
            {{ $t('upload.customLicenseUrl') }}
          </label>
          <input
            id="customLicenseUrl"
            :value="modelValue.customLicenseUrl"
            @input="updateField('customLicenseUrl', ($event.target as HTMLInputElement).value)"
            type="url"
            class="input-field"
            :placeholder="$t('upload.customLicenseUrlPlaceholder')"
          />
        </div>
        <div>
          <label for="customLicenseText" class="text-sm text-[var(--color-text-muted)] block mb-2">
            {{ $t('upload.customLicenseText') }}
          </label>
          <textarea
            id="customLicenseText"
            :value="modelValue.customLicenseText"
            @input="updateField('customLicenseText', ($event.target as HTMLTextAreaElement).value)"
            class="input-field"
            rows="4"
            :placeholder="$t('upload.customLicenseTextPlaceholder')"
          />
        </div>
      </div>
    </div>

    <!-- Creation Info Section (Collapsible) -->
    <div class="form-section">
      <button
        type="button"
        class="section-header-toggle"
        @click="showCreationInfo = !showCreationInfo"
      >
        <label class="section-label cursor-pointer">{{ $t('upload.creationInfo') }}</label>
        <span class="text-sm text-[var(--color-text-muted)]">({{ $t('upload.optional') }})</span>
        <Icon
          :name="showCreationInfo ? 'ChevronUp' : 'ChevronDown'"
          class="w-5 h-5 text-[var(--color-text-muted)] ml-auto"
        />
      </button>

      <div v-if="showCreationInfo" class="creation-info-content">
        <!-- Creation Date -->
        <div class="sub-section">
          <label for="creationDate" class="sub-label">{{ $t('upload.creationDate') }}</label>
          <input
            id="creationDate"
            :value="modelValue.creationDate"
            @input="updateField('creationDate', ($event.target as HTMLInputElement).value)"
            type="date"
            class="input-field"
          />
          <p class="field-hint">{{ $t('upload.creationDateHint') }}</p>
        </div>

        <!-- Creation Period -->
        <div class="sub-section">
          <label class="sub-label">{{ $t('upload.creationPeriod') }}</label>
          <div class="flex gap-3">
            <input
              :value="modelValue.creationPeriodValue"
              @input="updateField('creationPeriodValue', parseInt(($event.target as HTMLInputElement).value) || undefined)"
              type="number"
              min="1"
              max="999"
              class="input-field !w-24 flex-shrink-0"
              :placeholder="$t('upload.creationPeriodValuePlaceholder')"
            />
            <select
              :value="modelValue.creationPeriodUnit"
              @change="updateField('creationPeriodUnit', (($event.target as HTMLSelectElement).value || undefined) as CreationPeriodUnit | undefined)"
              class="input-field flex-1 min-w-0"
            >
              <option value="">{{ $t('upload.creationPeriodUnitSelect') }}</option>
              <option value="HOURS">{{ $t('upload.periodHours') }}</option>
              <option value="DAYS">{{ $t('upload.periodDays') }}</option>
              <option value="WEEKS">{{ $t('upload.periodWeeks') }}</option>
              <option value="MONTHS">{{ $t('upload.periodMonths') }}</option>
            </select>
          </div>
        </div>

        <!-- Medium -->
        <div class="sub-section">
          <label class="sub-label">{{ $t('upload.medium') }}</label>
          <div class="radio-group">
            <label class="radio-label">
              <input
                :checked="!modelValue.medium"
                @change="updateField('medium', undefined)"
                type="radio"
                name="medium"
              />
              <span>{{ $t('upload.mediumUnset') }}</span>
            </label>
            <label class="radio-label">
              <input
                :checked="modelValue.medium === 'DIGITAL'"
                @change="updateField('medium', 'DIGITAL')"
                type="radio"
                name="medium"
              />
              <span>{{ $t('upload.mediumDigital') }}</span>
            </label>
            <label class="radio-label">
              <input
                :checked="modelValue.medium === 'TRADITIONAL'"
                @change="updateField('medium', 'TRADITIONAL')"
                type="radio"
                name="medium"
              />
              <span>{{ $t('upload.mediumTraditional') }}</span>
            </label>
            <label class="radio-label">
              <input
                :checked="modelValue.medium === 'THREE_D'"
                @change="updateField('medium', 'THREE_D')"
                type="radio"
                name="medium"
              />
              <span>{{ $t('upload.medium3D') }}</span>
            </label>
            <label class="radio-label">
              <input
                :checked="modelValue.medium === 'MIXED'"
                @change="updateField('medium', 'MIXED')"
                type="radio"
                name="medium"
              />
              <span>{{ $t('upload.mediumMixed') }}</span>
            </label>
          </div>
        </div>

        <!-- Tools Used -->
        <div class="sub-section">
          <label class="sub-label">{{ $t('upload.toolsUsed') }}</label>
          <ArtworkToolsSelector
            :model-value="modelValue.toolsUsed || []"
            @update:model-value="updateField('toolsUsed', $event)"
          />
        </div>

        <!-- Project Name -->
        <div class="sub-section">
          <label for="projectName" class="sub-label">{{ $t('upload.projectName') }}</label>
          <input
            id="projectName"
            :value="modelValue.projectName"
            @input="updateField('projectName', ($event.target as HTMLInputElement).value)"
            type="text"
            class="input-field"
            maxlength="200"
            :placeholder="$t('upload.projectNamePlaceholder')"
          />
        </div>

        <!-- Commission -->
        <div class="sub-section">
          <div class="toggle-option">
            <div class="toggle-content">
              <span class="toggle-title">{{ $t('upload.isCommission') }}</span>
              <p class="field-hint">{{ $t('upload.isCommissionHint') }}</p>
            </div>
            <ToggleSwitch
              :model-value="modelValue.isCommission || false"
              @update:model-value="updateField('isCommission', $event)"
            />
          </div>
          <div v-if="modelValue.isCommission" class="mt-3">
            <label for="clientName" class="sub-label">{{ $t('upload.clientName') }}</label>
            <input
              id="clientName"
              :value="modelValue.clientName"
              @input="updateField('clientName', ($event.target as HTMLInputElement).value)"
              type="text"
              class="input-field"
              maxlength="200"
              :placeholder="$t('upload.clientNamePlaceholder')"
            />
            <p class="field-hint">{{ $t('upload.clientNameHint') }}</p>
          </div>
        </div>

        <!-- External URL -->
        <div class="sub-section">
          <label for="externalUrl" class="sub-label">{{ $t('upload.externalUrl') }}</label>
          <input
            id="externalUrl"
            :value="modelValue.externalUrl"
            @input="updateField('externalUrl', ($event.target as HTMLInputElement).value)"
            type="url"
            class="input-field"
            :placeholder="$t('upload.externalUrlPlaceholder')"
          />
          <p class="field-hint">{{ $t('upload.externalUrlHint') }}</p>
        </div>
      </div>
    </div>

    <!-- Privacy Settings -->
    <div class="form-section">
      <label class="section-label">{{ $t('upload.privacySettings') }}</label>
      <div class="toggle-options">
        <div class="toggle-option">
          <div class="toggle-content">
            <div class="flex items-center gap-2">
              <span class="toggle-title">{{ $t('upload.disableRightClick') }}</span>
              <Tooltip :content="$t('upload.disableRightClickTooltip')" position="top" />
            </div>
          </div>
          <ToggleSwitch
            :model-value="modelValue.disableRightClick"
            @update:model-value="updateField('disableRightClick', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

export type CreationPeriodUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS'
export type ArtworkMedium = 'DIGITAL' | 'TRADITIONAL' | 'THREE_D' | 'MIXED'

export interface ArtworkFormData {
  title: string
  description: string
  type: 'ILLUSTRATION' | 'MANGA'
  ageRating: 'ALL_AGES' | 'NSFW' | 'R18' | 'R18G'
  visibility: 'PUBLIC' | 'UNLISTED' | 'FOLLOWERS_ONLY' | 'PRIVATE'
  disableRightClick: boolean
  license: string
  customLicenseUrl: string
  customLicenseText: string
  // Creation metadata (portfolio fields)
  creationDate?: string
  creationPeriodValue?: number
  creationPeriodUnit?: CreationPeriodUnit
  isCommission?: boolean
  clientName?: string
  projectName?: string
  medium?: ArtworkMedium
  externalUrl?: string
  toolsUsed?: string[]
}

const props = defineProps<{
  modelValue: ArtworkFormData
  tagsInput: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ArtworkFormData]
  'update:tagsInput': [value: string]
}>()

const showCreationInfo = ref(false)

const parsedTags = computed(() => {
  if (!props.tagsInput.trim()) return []
  return props.tagsInput
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
})

const updateField = <K extends keyof ArtworkFormData>(field: K, value: ArtworkFormData[K]) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: value,
  })
}
</script>

<style scoped>
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
  content: attr(data-required-text, '必須');
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

.input-field,
.textarea-field {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.75rem;
  color: var(--color-text);
  font-size: 1rem;
  transition: border-color 0.2s;
  width: 100%;
}

.input-field:focus,
.textarea-field:focus {
  outline: none;
  border-color: var(--color-primary);
}

.textarea-field {
  resize: vertical;
  font-family: inherit;
}

.char-count {
  text-align: right;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

.tag-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.radio-group {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.radio-group.vertical {
  flex-direction: column;
  gap: 0.75rem;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: var(--color-text);
  font-size: 0.9375rem;
}

.radio-label input[type="radio"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
}

.radio-label.with-icon {
  align-items: center;
}

.visibility-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.radio-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.radio-title {
  font-weight: 500;
}

.toggle-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.toggle-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1rem;
}

.toggle-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toggle-title {
  font-weight: 500;
  color: var(--color-text);
}

/* Creation Info Section */
.section-header-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.section-header-toggle:hover {
  background: var(--color-hover);
}

.creation-info-content {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sub-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}
</style>
