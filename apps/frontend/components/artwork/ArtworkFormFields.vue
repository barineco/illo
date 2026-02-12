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

      <!-- Copyright/Rights Information (nested toggle) -->
      <button
        type="button"
        class="section-header-toggle mt-4"
        @click="showCopyrightInfo = !showCopyrightInfo"
      >
        <label class="section-label cursor-pointer">
          {{ showCopyrightInfo ? $t('upload.copyrightSettings') : $t('upload.copyrightSettingsCollapsed') }}
        </label>
        <Icon
          :name="showCopyrightInfo ? 'ChevronUp' : 'ChevronDown'"
          class="w-5 h-5 text-[var(--color-text-muted)] ml-auto"
        />
      </button>

      <div v-if="showCopyrightInfo" class="creation-info-content">
        <!-- Copyright Type -->
        <div class="sub-section">
          <label class="sub-label">{{ $t('upload.copyrightType') }}</label>
          <p class="field-hint mb-2">{{ $t('upload.copyrightTypeHint') }}</p>
          <select
            :value="modelValue.copyrightType || 'CREATOR'"
            @change="updateField('copyrightType', ($event.target as HTMLSelectElement).value as CopyrightType)"
            class="input-field"
          >
            <option value="CREATOR">{{ $t('upload.copyrightTypeCreator') }}</option>
            <option value="COMMISSION">{{ $t('upload.copyrightTypeCommission') }}</option>
            <option value="LICENSED">{{ $t('upload.copyrightTypeLicensed') }}</option>
            <option value="CORPORATE">{{ $t('upload.copyrightTypeCorporate') }}</option>
            <option value="FAN_ART">{{ $t('upload.copyrightTypeFanArt') }}</option>
            <option value="OTHER">{{ $t('upload.copyrightTypeOther') }}</option>
          </select>
        </div>

        <!-- Copyright Holder (shown for non-CREATOR types) -->
        <div v-if="modelValue.copyrightType && modelValue.copyrightType !== 'CREATOR'" class="sub-section">
          <label for="copyrightHolder" class="sub-label">{{ $t('upload.copyrightHolder') }}</label>
          <input
            id="copyrightHolder"
            :value="modelValue.copyrightHolder"
            @input="updateField('copyrightHolder', ($event.target as HTMLInputElement).value)"
            type="text"
            class="input-field"
            maxlength="200"
            :placeholder="$t('upload.copyrightHolderPlaceholder')"
          />
          <p class="field-hint">{{ $t('upload.copyrightHolderHint') }}</p>
        </div>

        <!-- Original Creator (shown for FAN_ART type) -->
        <div v-if="modelValue.copyrightType === 'FAN_ART'" class="sub-section">
          <label class="sub-label">{{ $t('upload.originalCreator') }}</label>
          <p class="field-hint mb-2">{{ $t('upload.originalCreatorHint') }}</p>

          <!-- Selected Original Creator -->
          <div v-if="modelValue.originalCreator" class="flex items-center gap-3 p-3 bg-[var(--color-surface-secondary)] rounded-lg mb-2">
            <div class="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                v-if="modelValue.originalCreator.avatarUrl"
                :src="modelValue.originalCreator.avatarUrl"
                :alt="modelValue.originalCreator.displayName || modelValue.originalCreator.username"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="UserCircle" class="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ modelValue.originalCreator.displayName || modelValue.originalCreator.username }}</div>
              <div class="text-sm text-[var(--color-text-muted)] truncate">@{{ modelValue.originalCreator.username }}</div>
            </div>
            <button
              type="button"
              @click="clearOriginalCreator"
              class="p-1.5 hover:bg-[var(--color-hover)] rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
            >
              <Icon name="XMark" class="w-5 h-5" />
            </button>
          </div>

          <!-- User Search Input -->
          <div v-else class="relative">
            <input
              v-model="originalCreatorSearch"
              type="text"
              class="input-field"
              :placeholder="$t('upload.originalCreatorPlaceholder')"
              @focus="showUserDropdown = true"
              @blur="handleUserDropdownBlur"
            />
            <!-- Search Results Dropdown -->
            <div
              v-if="showUserDropdown && (originalCreatorSearchResults.length > 0 || isSearchingUsers)"
              class="absolute z-10 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              <div v-if="isSearchingUsers" class="p-3 text-center text-[var(--color-text-muted)]">
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
              </div>
              <button
                v-for="user in originalCreatorSearchResults"
                :key="user.id"
                type="button"
                class="w-full flex items-center gap-3 p-3 hover:bg-[var(--color-hover)] transition-colors text-left"
                @mousedown.prevent="selectOriginalCreator(user)"
              >
                <div class="w-8 h-8 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img
                    v-if="user.avatarUrl"
                    :src="user.avatarUrl"
                    :alt="user.displayName || user.username"
                    class="w-full h-full object-cover"
                  />
                  <Icon v-else name="UserCircle" class="w-5 h-5 text-[var(--color-text-muted)]" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ user.displayName || user.username }}</div>
                  <div class="text-sm text-[var(--color-text-muted)] truncate">@{{ user.username }}</div>
                </div>
              </button>
            </div>
          </div>

          <!-- Allow Original Creator to Download -->
          <div v-if="modelValue.originalCreator" class="mt-3">
            <div class="toggle-option">
              <div class="toggle-content">
                <span class="toggle-title">{{ $t('upload.originalCreatorAllowDownload') }}</span>
                <p class="field-hint">{{ $t('upload.originalCreatorAllowDownloadHint') }}</p>
              </div>
              <ToggleSwitch
                :model-value="modelValue.originalCreatorAllowDownload || false"
                @update:model-value="updateField('originalCreatorAllowDownload', $event)"
              />
            </div>
          </div>
        </div>

        <!-- Character Selection -->
        <div v-if="modelValue.copyrightType === 'CREATOR' || modelValue.copyrightType === 'FAN_ART'" class="sub-section">
          <label class="sub-label">
            {{ modelValue.copyrightType === 'CREATOR' ? $t('upload.ownCharacter') : $t('upload.fanArtCharacter') }}
          </label>
          <p class="field-hint mb-2">
            {{ modelValue.copyrightType === 'CREATOR' ? $t('upload.ownCharacterHint') : $t('upload.fanArtCharacterHint') }}
          </p>

          <!-- Selected Character -->
          <div v-if="modelValue.character" class="flex items-center gap-3 p-3 bg-[var(--color-surface-secondary)] rounded-lg mb-2">
            <div class="w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                v-if="modelValue.character.avatarThumbnailUrl || modelValue.character.avatarUrl"
                :src="modelValue.character.avatarThumbnailUrl || modelValue.character.avatarUrl || ''"
                :alt="modelValue.character.name"
                class="w-full h-full object-cover"
              />
              <Icon v-else name="User" class="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ modelValue.character.name }}</div>
              <div v-if="modelValue.character.creator" class="text-sm text-[var(--color-text-muted)] truncate">
                @{{ modelValue.character.creator.username }}
              </div>
            </div>
            <button
              type="button"
              @click="clearCharacter"
              class="p-1.5 hover:bg-[var(--color-hover)] rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
            >
              <Icon name="XMark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Character Search Input -->
          <div v-else class="relative">
            <input
              v-model="characterSearch"
              type="text"
              class="input-field"
              :placeholder="$t('upload.fanArtCharacterPlaceholder')"
              @focus="showCharacterDropdown = true"
              @blur="handleCharacterDropdownBlur"
            />
            <!-- Search Results Dropdown -->
            <div
              v-if="showCharacterDropdown && (characterSearchResults.length > 0 || isSearchingCharacters)"
              class="absolute z-10 w-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              <div v-if="isSearchingCharacters" class="p-3 text-center text-[var(--color-text-muted)]">
                <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-border)] border-t-[var(--color-primary)]"></div>
              </div>
              <button
                v-for="character in characterSearchResults"
                :key="character.id"
                type="button"
                class="w-full flex items-center gap-3 p-3 hover:bg-[var(--color-hover)] transition-colors text-left"
                @mousedown.prevent="selectCharacter(character)"
              >
                <div class="w-8 h-8 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img
                    v-if="character.avatarThumbnailUrl || character.avatarUrl"
                    :src="character.avatarThumbnailUrl || character.avatarUrl || ''"
                    :alt="character.name"
                    class="w-full h-full object-cover"
                  />
                  <Icon v-else name="User" class="w-5 h-5 text-[var(--color-text-muted)]" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ character.name }}</div>
                  <div v-if="character.creator" class="text-sm text-[var(--color-text-muted)] truncate">
                    @{{ character.creator.username }}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Copyright Note -->
        <div class="sub-section">
          <label for="copyrightNote" class="sub-label">{{ $t('upload.copyrightNote') }}</label>
          <textarea
            id="copyrightNote"
            :value="modelValue.copyrightNote"
            @input="updateField('copyrightNote', ($event.target as HTMLTextAreaElement).value)"
            class="input-field"
            rows="3"
            maxlength="2000"
            :placeholder="$t('upload.copyrightNotePlaceholder')"
          />
        </div>
      </div>
    </div>

    <!-- Creation Info Section -->
    <div class="form-section">
      <label class="section-label">{{ $t('upload.creationInfoSection') }}</label>

      <!-- Creation Info (toggle) -->
      <button
        type="button"
        class="section-header-toggle mt-3"
        @click="showCreationInfo = !showCreationInfo"
      >
        <label class="section-label cursor-pointer">{{ $t('upload.creationInfo') }}</label>
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
import { ref, computed, watch } from 'vue'

export type CreationPeriodUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS'
export type ArtworkMedium = 'DIGITAL' | 'TRADITIONAL' | 'THREE_D' | 'MIXED'
export type CopyrightType = 'CREATOR' | 'COMMISSION' | 'LICENSED' | 'CORPORATE' | 'FAN_ART' | 'OTHER'

export interface OriginalCreatorInfo {
  id: string
  username: string
  displayName?: string
  avatarUrl?: string
}

export interface CharacterInfo {
  id: string
  name: string
  avatarUrl?: string | null
  avatarThumbnailUrl?: string | null
  creator?: {
    id: string
    username: string
    displayName?: string | null
  }
}

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
  // Copyright/Rights information
  copyrightType?: CopyrightType
  copyrightHolder?: string
  copyrightNote?: string
  // Fan art original creator
  originalCreatorId?: string
  originalCreator?: OriginalCreatorInfo
  originalCreatorAllowDownload?: boolean
  // Fan art character
  characterId?: string
  character?: CharacterInfo
}

const props = defineProps<{
  modelValue: ArtworkFormData
  tagsInput: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ArtworkFormData]
  'update:tagsInput': [value: string]
}>()

const api = useApi()
const { user: currentUser } = useAuth()

const showCreationInfo = ref(false)
const showCopyrightInfo = ref(false)

// User search for original creator
const originalCreatorSearch = ref('')
const originalCreatorSearchResults = ref<OriginalCreatorInfo[]>([])
const isSearchingUsers = ref(false)
const showUserDropdown = ref(false)

// Blur handlers for dropdowns (need to delay so that click on dropdown item works)
const handleUserDropdownBlur = () => {
  window.setTimeout(() => {
    showUserDropdown.value = false
  }, 200)
}

// Character search for fan art
const characterSearch = ref('')
const characterSearchResults = ref<CharacterInfo[]>([])
const isSearchingCharacters = ref(false)
const showCharacterDropdown = ref(false)

const handleCharacterDropdownBlur = () => {
  window.setTimeout(() => {
    showCharacterDropdown.value = false
  }, 200)
}

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

// Search users for original creator selection
const searchUsers = async (query: string) => {
  if (!query || query.length < 2) {
    originalCreatorSearchResults.value = []
    return
  }

  isSearchingUsers.value = true
  try {
    const results = await api.get<{ users: any[] }>('/api/users/search', {
      params: { q: query, limit: 5 },
    })
    originalCreatorSearchResults.value = results.users.map((u: any) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName || u.username,
      avatarUrl: u.avatarUrl,
    }))
  } catch (e) {
    console.error('Failed to search users:', e)
    originalCreatorSearchResults.value = []
  } finally {
    isSearchingUsers.value = false
  }
}

// Debounced user search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(originalCreatorSearch, (query) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => searchUsers(query), 300)
})

const selectOriginalCreator = (user: OriginalCreatorInfo) => {
  updateField('originalCreatorId', user.id)
  updateField('originalCreator', user)
  originalCreatorSearch.value = ''
  showUserDropdown.value = false
  originalCreatorSearchResults.value = []
}

const clearOriginalCreator = () => {
  updateField('originalCreatorId', undefined)
  updateField('originalCreator', undefined)
  updateField('originalCreatorAllowDownload', false)
}

const { getSignedUrl } = useSignedImageUrlOnce()

const searchCharacters = async (query: string) => {
  if (!query || query.length < 1) {
    characterSearchResults.value = []
    return
  }

  isSearchingCharacters.value = true
  try {
    const isOwnCharacter = props.modelValue.copyrightType === 'CREATOR'
    const endpoint = isOwnCharacter && currentUser.value
      ? `/api/users/${currentUser.value.username}/characters`
      : '/api/ocs'
    const results = await api.get<{ characters: any[] }>(endpoint, {
      params: { search: query, limit: 10 },
    })
    characterSearchResults.value = await Promise.all(
      results.characters.map(async (c: any) => {
        const img = c.representativeArtwork?.images?.[0]
        let avatarThumbnailUrl: string | null = null
        if (img?.id) {
          try {
            avatarThumbnailUrl = await getSignedUrl(img.id, true)
          } catch {
            avatarThumbnailUrl = null
          }
        }
        return {
          id: c.id,
          name: c.name,
          avatarUrl: null,
          avatarThumbnailUrl,
          creator: c.creator,
        }
      })
    )
  } catch (e) {
    console.error('Failed to search characters:', e)
    characterSearchResults.value = []
  } finally {
    isSearchingCharacters.value = false
  }
}

// Debounced character search
let characterSearchTimeout: ReturnType<typeof setTimeout> | null = null
watch(characterSearch, (query) => {
  if (characterSearchTimeout) clearTimeout(characterSearchTimeout)
  characterSearchTimeout = setTimeout(() => searchCharacters(query), 300)
})

const selectCharacter = (character: CharacterInfo) => {
  updateField('characterId', character.id)
  updateField('character', character)
  characterSearch.value = ''
  showCharacterDropdown.value = false
  characterSearchResults.value = []
}

const clearCharacter = () => {
  updateField('characterId', undefined)
  updateField('character', undefined)
}

// Auto-expand copyright section if data exists
watch(() => props.modelValue.copyrightType, (type) => {
  if (type && type !== 'CREATOR') {
    showCopyrightInfo.value = true
  }
}, { immediate: true })
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
