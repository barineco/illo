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
        @click="fetchTools"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Tools Settings -->
    <div v-else class="space-y-6">
      <!-- Description -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h3 class="text-lg font-medium mb-2">{{ $t('settings.tools.title') }}</h3>
        <p class="text-[var(--color-text-muted)] text-sm">
          {{ $t('settings.tools.description') }}
        </p>
      </div>

      <!-- Current Tools -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-medium">{{ $t('settings.tools.myTools') }}</h3>
          <div class="flex items-center gap-2">
            <span v-if="isSaving" class="text-xs text-[var(--color-text-muted)]">
              {{ $t('common.saving') }}
            </span>
            <span class="text-sm text-[var(--color-text-muted)]">
              {{ tools.length }} {{ $t('settings.tools.registered') }}
            </span>
          </div>
        </div>

        <!-- Tools List -->
        <div v-if="tools.length > 0" class="flex flex-wrap gap-2 mb-4">
          <div
            v-for="(tool, index) in tools"
            :key="index"
            class="flex items-center gap-1 px-3 py-1.5 bg-[var(--color-background)] rounded-full border border-[var(--color-border)] group"
          >
            <span class="text-sm">{{ tool }}</span>
            <button
              type="button"
              class="p-0.5 hover:bg-[var(--color-danger-bg)] rounded-full transition-colors"
              :title="$t('common.delete')"
              @click="removeTool(index)"
            >
              <Icon name="XMark" class="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-danger-text)]" />
            </button>
          </div>
        </div>

        <div v-else class="text-center py-8 text-[var(--color-text-muted)]">
          <Icon name="Wrench" class="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{{ $t('settings.tools.noTools') }}</p>
        </div>
      </div>

      <!-- Default Settings -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">{{ $t('settings.tools.defaultSettings') }}</h3>
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            v-model="useProfileToolsAsDefault"
            type="checkbox"
            class="mt-1 w-5 h-5 rounded border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-0"
            @change="autoSave"
          />
          <div>
            <span class="text-[var(--color-text)]">{{ $t('settings.tools.useAsDefault') }}</span>
            <p class="text-sm text-[var(--color-text-muted)] mt-1">
              {{ $t('settings.tools.useAsDefaultDesc') }}
            </p>
          </div>
        </label>
      </div>

      <!-- Add Tools -->
      <div class="bg-[var(--color-surface)] rounded-lg p-6">
        <h3 class="text-lg font-medium mb-4">{{ $t('settings.tools.presets') }}</h3>

        <!-- Search -->
        <div class="mb-4">
          <div class="relative">
            <Icon name="MagnifyingGlass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              v-model="searchQuery"
              type="text"
              class="w-full pl-10 pr-4 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors text-sm"
              :placeholder="$t('settings.tools.searchPlaceholder')"
            />
          </div>
        </div>

        <!-- Preset Categories -->
        <div class="space-y-4">
          <!-- Digital Painting -->
          <div v-if="filteredPresetToolsDigital.length > 0">
            <h4 class="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              {{ $t('settings.tools.categories.digitalPaint') }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tool in filteredPresetToolsDigital"
                :key="tool"
                type="button"
                :class="[
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  tools.includes(tool)
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-background)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
                ]"
                @click="toggleTool(tool)"
              >
                {{ tool }}
              </button>
            </div>
          </div>

          <!-- 3D -->
          <div v-if="filteredPresetTools3D.length > 0">
            <h4 class="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              {{ $t('settings.tools.categories.threeD') }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tool in filteredPresetTools3D"
                :key="tool"
                type="button"
                :class="[
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  tools.includes(tool)
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-background)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
                ]"
                @click="toggleTool(tool)"
              >
                {{ tool }}
              </button>
            </div>
          </div>

          <!-- Vector -->
          <div v-if="filteredPresetToolsVector.length > 0">
            <h4 class="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              {{ $t('settings.tools.categories.vector') }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tool in filteredPresetToolsVector"
                :key="tool"
                type="button"
                :class="[
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  tools.includes(tool)
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-background)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
                ]"
                @click="toggleTool(tool)"
              >
                {{ tool }}
              </button>
            </div>
          </div>

          <!-- Animation -->
          <div v-if="filteredPresetToolsAnimation.length > 0">
            <h4 class="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              {{ $t('settings.tools.categories.animation') }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tool in filteredPresetToolsAnimation"
                :key="tool"
                type="button"
                :class="[
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  tools.includes(tool)
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-[var(--color-background)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
                ]"
                @click="toggleTool(tool)"
              >
                {{ tool }}
              </button>
            </div>
          </div>

          <!-- No results -->
          <div v-if="searchQuery && !hasFilteredResults" class="text-center py-4 text-[var(--color-text-muted)]">
            <p class="text-sm">{{ $t('settings.tools.noSearchResults') }}</p>
          </div>
        </div>

        <!-- Custom Tool Input -->
        <div class="mt-6 pt-6 border-t border-[var(--color-border)]">
          <h4 class="text-sm font-medium text-[var(--color-text-muted)] mb-2">
            {{ $t('settings.tools.custom') }}
          </h4>
          <div class="flex gap-2">
            <input
              v-model="customToolInput"
              type="text"
              maxlength="50"
              class="flex-1 px-4 py-2 bg-[var(--color-background)] rounded-lg border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
              :placeholder="$t('settings.tools.customPlaceholder')"
              @keydown.enter.prevent="addCustomTool"
            />
            <BaseButton
              variant="primary"
              size="md"
              shape="rounded"
              :disabled="!customToolInput.trim()"
              @click="addCustomTool"
            >
              {{ $t('common.add') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const api = useApi()
const toast = useToast()

const loading = ref(true)
const error = ref<string | null>(null)
const isSaving = ref(false)

// Tools state
const tools = ref<string[]>([])
const originalTools = ref<string[]>([])
const customToolInput = ref('')
const searchQuery = ref('')

// Default settings state
const useProfileToolsAsDefault = ref(true)
const originalUseProfileToolsAsDefault = ref(true)

// Preset tool lists
const presetToolsDigital = [
  'Photoshop',
  'CLIP STUDIO PAINT',
  'Procreate',
  'SAI',
  'MediBang Paint',
  'ibisPaint',
  'Krita',
  'GIMP',
  'Affinity',
  'Affinity Photo',
]

const presetTools3D = [
  'Blender',
  'ZBrush',
  'Maya',
  'Cinema 4D',
  '3ds Max',
]

const presetToolsVector = [
  'Illustrator',
  'Affinity Designer',
  'Inkscape',
]

const presetToolsAnimation = [
  'After Effects',
  'Procreate Dreams',
  'Live2D',
  'Spine',
]

// Filter function for search
const filterTools = (toolList: string[]) => {
  if (!searchQuery.value.trim()) return toolList
  const query = searchQuery.value.toLowerCase()
  return toolList.filter(tool => tool.toLowerCase().includes(query))
}

// Filtered preset lists
const filteredPresetToolsDigital = computed(() => filterTools(presetToolsDigital))
const filteredPresetTools3D = computed(() => filterTools(presetTools3D))
const filteredPresetToolsVector = computed(() => filterTools(presetToolsVector))
const filteredPresetToolsAnimation = computed(() => filterTools(presetToolsAnimation))

// Check if there are any filtered results
const hasFilteredResults = computed(() => {
  return filteredPresetToolsDigital.value.length > 0 ||
    filteredPresetTools3D.value.length > 0 ||
    filteredPresetToolsVector.value.length > 0 ||
    filteredPresetToolsAnimation.value.length > 0
})

// Check if there are unsaved changes
const hasChanges = computed(() => {
  if (useProfileToolsAsDefault.value !== originalUseProfileToolsAsDefault.value) return true
  if (tools.value.length !== originalTools.value.length) return true
  return tools.value.some((tool, i) => tool !== originalTools.value[i])
})

// Debounce timer for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null

// Auto-save with debounce
const autoSave = () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(() => {
    if (hasChanges.value) {
      saveTools(true) // silent save
    }
  }, 500)
}

// Fetch current tools and settings
const fetchTools = async () => {
  try {
    loading.value = true
    error.value = null

    const data = await api.get<{ tools: string[]; useProfileToolsAsDefault: boolean }>('/api/users/me/tools')
    tools.value = data.tools || []
    originalTools.value = [...tools.value]
    useProfileToolsAsDefault.value = data.useProfileToolsAsDefault ?? true
    originalUseProfileToolsAsDefault.value = useProfileToolsAsDefault.value
  } catch (e: any) {
    console.error('Failed to fetch tools:', e)
    error.value = e.message || t('common.error')
  } finally {
    loading.value = false
  }
}

// Toggle tool selection
const toggleTool = (tool: string) => {
  const index = tools.value.indexOf(tool)
  if (index === -1) {
    tools.value.push(tool)
  } else {
    tools.value.splice(index, 1)
  }
  autoSave()
}

// Remove tool by index
const removeTool = (index: number) => {
  tools.value.splice(index, 1)
  autoSave()
}

// Add custom tool
const addCustomTool = () => {
  const tool = customToolInput.value.trim()
  if (!tool) return

  // Check if already exists (case-insensitive)
  const exists = tools.value.some(t => t.toLowerCase() === tool.toLowerCase())
  if (exists) {
    toast.warning(t('settings.tools.alreadyExists'))
    return
  }

  tools.value.push(tool)
  customToolInput.value = ''
  autoSave()
}

// Save tools and settings
const saveTools = async (silent = false) => {
  try {
    isSaving.value = true

    await api.put('/api/users/me/tools', {
      tools: tools.value,
      useProfileToolsAsDefault: useProfileToolsAsDefault.value,
    })

    originalTools.value = [...tools.value]
    originalUseProfileToolsAsDefault.value = useProfileToolsAsDefault.value
    if (!silent) {
      toast.success(t('settings.tools.saved'))
    }
  } catch (e: any) {
    console.error('Failed to save tools:', e)
    toast.error(e.message || t('common.error'))
  } finally {
    isSaving.value = false
  }
}

// Fetch on mount
onMounted(() => {
  fetchTools()
})

// Cleanup on unmount
onUnmounted(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
})
</script>
