<template>
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold">{{ $t('about.pageTitle') }}</h1>
      <p class="text-[var(--color-text-muted)] mt-2">{{ $t('about.pageDescription') }}</p>
    </div>

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
        @click="fetchInstanceInfo"
      >
        {{ $t('common.retry') }}
      </BaseButton>
    </div>

    <!-- Instance Info -->
    <div v-else-if="instanceInfo" class="space-y-6">
      <!-- Instance Overview -->
      <div class="bg-[var(--color-surface)] rounded-xl p-6 shadow-sm">
        <div class="flex items-center gap-4 mb-4">
          <img
            src="/assets/logo/illo-logo.svg"
            alt="Logo"
            class="w-16 h-16"
          />
          <div>
            <h2 class="text-2xl font-bold">{{ instanceInfo.instanceName }}</h2>
            <span
              class="inline-block mt-1 px-2 py-0.5 text-xs rounded-full"
              :class="instanceModeClass"
            >
              {{ instanceModeLabel }}
            </span>
          </div>
        </div>

        <p v-if="instanceInfo.description" class="text-[var(--color-text-muted)] mb-4">
          {{ instanceInfo.description }}
        </p>

        <!-- Registration Status -->
        <div class="flex items-center gap-2 text-sm">
          <Icon
            :name="instanceInfo.allowRegistration ? 'CheckCircle' : 'XCircle'"
            class="w-5 h-5"
            :class="instanceInfo.allowRegistration ? 'text-green-500' : 'text-[var(--color-text-muted)]'"
          />
          <span>
            {{ instanceInfo.allowRegistration
              ? (instanceInfo.requireApproval ? $t('about.registrationApproval') : $t('about.registrationOpen'))
              : $t('about.registrationClosed')
            }}
          </span>
        </div>
      </div>

      <!-- Legal Links -->
      <div class="bg-[var(--color-surface)] rounded-xl p-6 shadow-sm">
        <h3 class="text-lg font-semibold mb-4">{{ $t('about.legalDocuments') }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NuxtLink
            to="/tos"
            class="flex items-center gap-3 p-4 bg-[var(--color-surface-secondary)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Icon name="DocumentText" class="w-6 h-6 text-[var(--color-primary)]" />
            <div>
              <div class="font-medium">{{ $t('about.termsOfService') }}</div>
              <div class="text-sm text-[var(--color-text-muted)]">
                {{ $t('about.tosVersion', { version: instanceInfo.tosVersion }) }}
              </div>
            </div>
            <Icon name="ChevronRight" class="w-5 h-5 ml-auto text-[var(--color-text-muted)]" />
          </NuxtLink>

          <NuxtLink
            to="/privacy"
            class="flex items-center gap-3 p-4 bg-[var(--color-surface-secondary)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Icon name="ShieldCheck" class="w-6 h-6 text-[var(--color-primary)]" />
            <div>
              <div class="font-medium">{{ $t('about.privacyPolicy') }}</div>
              <div class="text-sm text-[var(--color-text-muted)]">{{ $t('about.privacyDescription') }}</div>
            </div>
            <Icon name="ChevronRight" class="w-5 h-5 ml-auto text-[var(--color-text-muted)]" />
          </NuxtLink>
        </div>
      </div>

      <!-- Contact Information -->
      <div v-if="instanceInfo.adminUsername || instanceInfo.contactInfo" class="bg-[var(--color-surface)] rounded-xl p-6 shadow-sm">
        <h3 class="text-lg font-semibold mb-4">{{ $t('about.contact') }}</h3>
        <div class="space-y-3">
          <div v-if="instanceInfo.adminUsername" class="flex items-center gap-3">
            <Icon name="User" class="w-5 h-5 text-[var(--color-text-muted)]" />
            <span class="text-[var(--color-text-muted)]">{{ $t('about.administrator') }}:</span>
            <NuxtLink
              :to="`/users/${instanceInfo.adminUsername}`"
              class="text-[var(--color-primary)] hover:underline"
            >
              @{{ instanceInfo.adminUsername }}
            </NuxtLink>
          </div>
          <div v-if="instanceInfo.contactInfo" class="flex items-center gap-3">
            <Icon name="Envelope" class="w-5 h-5 text-[var(--color-text-muted)]" />
            <span class="text-[var(--color-text-muted)]">{{ $t('about.contactInfo') }}:</span>
            <span>{{ instanceInfo.contactInfo }}</span>
          </div>
          <div v-if="instanceInfo.publicUrl" class="flex items-center gap-3">
            <Icon name="GlobeAlt" class="w-5 h-5 text-[var(--color-text-muted)]" />
            <span class="text-[var(--color-text-muted)]">URL:</span>
            <a
              :href="instanceInfo.publicUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--color-primary)] hover:underline"
            >
              {{ instanceInfo.publicUrl }}
            </a>
          </div>
        </div>
      </div>

      <!-- Software Info -->
      <div class="bg-[var(--color-surface)] rounded-xl p-6 shadow-sm">
        <h3 class="text-lg font-semibold mb-4">{{ $t('about.software') }}</h3>
        <div class="flex items-center gap-3">
          <img
            src="/assets/logo/illo-logo.svg"
            alt="illo"
            class="w-8 h-8"
          />
          <div>
            <div class="font-medium">illo</div>
            <div class="text-sm text-[var(--color-text-muted)]">
              {{ $t('about.openSource') }}
            </div>
          </div>
          <a
            href="https://github.com/barineco/illo"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-auto text-[var(--color-primary)] hover:underline flex items-center gap-1"
          >
            <span>GitHub</span>
            <Icon name="ArrowTopRightOnSquare" class="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
})

const { t } = useI18n()
const api = useApi()

interface InstanceInfo {
  instanceName: string
  instanceMode: string
  description: string | null
  publicUrl: string | null
  contactInfo: string | null
  adminUsername: string | null
  allowRegistration: boolean
  requireApproval: boolean
  tosVersion: number
  tosUpdatedAt: string | null
}

const instanceInfo = ref<InstanceInfo | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const instanceModeLabel = computed(() => {
  if (!instanceInfo.value) return ''
  switch (instanceInfo.value.instanceMode) {
    case 'PERSONAL':
      return t('about.modePersonal')
    case 'FEDERATION_ONLY':
      return t('about.modeFederation')
    case 'FULL_FEDIVERSE':
      return t('about.modeFullFediverse')
    default:
      return instanceInfo.value.instanceMode
  }
})

const instanceModeClass = computed(() => {
  if (!instanceInfo.value) return ''
  switch (instanceInfo.value.instanceMode) {
    case 'PERSONAL':
      return 'bg-blue-500/20 text-blue-400'
    case 'FEDERATION_ONLY':
      return 'bg-purple-500/20 text-purple-400'
    case 'FULL_FEDIVERSE':
      return 'bg-green-500/20 text-green-400'
    default:
      return 'bg-gray-500/20 text-gray-400'
  }
})

const fetchInstanceInfo = async () => {
  try {
    loading.value = true
    error.value = null
    instanceInfo.value = await api.get<InstanceInfo>('/api/instance/info')
  } catch (e: any) {
    console.error('Failed to fetch instance info:', e)
    error.value = e.message || t('about.fetchError')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchInstanceInfo()
})

useHead({
  title: () => t('about.pageTitle'),
})
</script>
