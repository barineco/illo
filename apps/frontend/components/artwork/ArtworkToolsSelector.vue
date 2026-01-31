<template>
  <div class="tools-selector">
    <!-- Selected Tools -->
    <div v-if="modelValue.length > 0" class="selected-tools">
      <div
        v-for="(tool, index) in modelValue"
        :key="index"
        class="tool-chip selected"
      >
        <span>{{ tool }}</span>
        <button
          type="button"
          class="remove-btn"
          @click="removeTool(index)"
        >
          <Icon name="XMark" class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Tool Selection Dropdown -->
    <div class="tool-input-wrapper">
      <div class="relative">
        <input
          v-model="searchInput"
          type="text"
          class="tool-input"
          :placeholder="$t('upload.toolsSelectPlaceholder')"
          @focus="showDropdown = true"
          @keydown.enter.prevent="addCustomTool"
        />
        <button
          v-if="searchInput.trim()"
          type="button"
          class="add-btn"
          @click="addCustomTool"
        >
          <Icon name="Plus" class="w-4 h-4" />
        </button>
      </div>

      <!-- Dropdown -->
      <div v-if="showDropdown && filteredTools.length > 0" class="tools-dropdown">
        <button
          v-for="tool in filteredTools"
          :key="tool"
          type="button"
          class="dropdown-item"
          @click="selectTool(tool)"
        >
          {{ tool }}
        </button>
      </div>
    </div>

    <!-- Profile Tools Hint -->
    <p v-if="profileTools.length === 0" class="hint-text">
      {{ $t('upload.toolsProfileHint') }}
      <NuxtLink to="/settings" class="hint-link">{{ $t('upload.toolsProfileLink') }}</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const api = useApi()
const { user } = useAuth()

const searchInput = ref('')
const showDropdown = ref(false)
const profileTools = ref<string[]>([])

// Preset tools for suggestions
const presetTools = [
  'Photoshop',
  'CLIP STUDIO PAINT',
  'Procreate',
  'SAI',
  'MediBang Paint',
  'ibisPaint',
  'Krita',
  'GIMP',
  'Affinity Photo',
  'Blender',
  'ZBrush',
  'Maya',
  'Cinema 4D',
  '3ds Max',
  'Illustrator',
  'Affinity Designer',
  'Inkscape',
  'After Effects',
  'Live2D',
  'Spine',
]

// Combine profile tools with presets, removing duplicates
const allAvailableTools = computed(() => {
  const combined = [...profileTools.value]
  presetTools.forEach(tool => {
    if (!combined.some(t => t.toLowerCase() === tool.toLowerCase())) {
      combined.push(tool)
    }
  })
  return combined
})

const filteredTools = computed(() => {
  const search = searchInput.value.toLowerCase().trim()
  return allAvailableTools.value
    .filter(tool => {
      const isSelected = props.modelValue.some(t => t.toLowerCase() === tool.toLowerCase())
      if (isSelected) return false

      if (!search) return true
      return tool.toLowerCase().includes(search)
    })
    .slice(0, 10)
})

const selectTool = (tool: string) => {
  if (!props.modelValue.includes(tool)) {
    emit('update:modelValue', [...props.modelValue, tool])
  }
  searchInput.value = ''
  showDropdown.value = false
}

const removeTool = (index: number) => {
  const newTools = [...props.modelValue]
  newTools.splice(index, 1)
  emit('update:modelValue', newTools)
}

const addCustomTool = async () => {
  const tool = searchInput.value.trim()
  if (!tool) return

  if (props.modelValue.some(t => t.toLowerCase() === tool.toLowerCase())) {
    searchInput.value = ''
    return
  }

  emit('update:modelValue', [...props.modelValue, tool])
  searchInput.value = ''
  showDropdown.value = false

  if (user.value) {
    try {
      await api.post('/api/users/me/tools', { tool })
      fetchProfileTools()
    } catch {
      // Ignore errors - tool is still added to artwork
    }
  }
}

const fetchProfileTools = async () => {
  if (!user.value) return

  try {
    const data = await api.get<{ tools: string[] }>('/api/users/me/tools')
    profileTools.value = data.tools || []
  } catch {
    profileTools.value = []
  }
}

// Close dropdown when clicking outside
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.tools-selector')) {
    showDropdown.value = false
  }
}

onMounted(() => {
  fetchProfileTools()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.tools-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selected-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tool-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-primary);
  color: white;
  border-radius: 9999px;
  font-size: 0.875rem;
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem;
  border-radius: 9999px;
  transition: background-color 0.2s;
}

.remove-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.tool-input-wrapper {
  position: relative;
}

.tool-input {
  width: 100%;
  padding: 0.75rem;
  padding-right: 2.5rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.tool-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.add-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: var(--color-primary);
  color: white;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.add-btn:hover {
  background: var(--color-primary-hover);
}

.tools-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.625rem 0.75rem;
  text-align: left;
  color: var(--color-text);
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background: var(--color-hover);
}

.hint-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

.hint-link {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
