<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      @click.self="close"
    >
      <div class="bg-[var(--color-surface)] rounded-xl p-8 max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col relative">
        <h2 class="text-2xl font-bold mb-6">{{ $t('licenses.title') }}</h2>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto space-y-6 pr-2">
          <!-- Project License -->
          <section>
            <h3 class="text-lg font-semibold mb-3 text-[var(--color-primary)]">
              {{ $t('licenses.projectLicense') }}
            </h3>
            <div class="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
              <p class="font-medium mb-2">open-illustboard</p>
              <p class="text-sm text-[var(--color-text-muted)] mb-2">
                {{ $t('licenses.agplDescription') }}
              </p>
              <a
                href="https://www.gnu.org/licenses/agpl-3.0.html"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
              >
                AGPL-3.0 License
                <Icon name="ArrowTopRightOnSquare" class="w-4 h-4" />
              </a>
            </div>
          </section>

          <!-- Frontend Dependencies -->
          <section>
            <h3 class="text-lg font-semibold mb-3 text-[var(--color-primary)]">
              {{ $t('licenses.frontendDependencies') }}
            </h3>
            <div class="space-y-2">
              <LicenseItem
                v-for="dep in frontendDependencies"
                :key="dep.name"
                :name="dep.name"
                :license="dep.license"
                :url="dep.url"
                :description="dep.description"
              />
            </div>
          </section>

          <!-- Backend Dependencies -->
          <section>
            <h3 class="text-lg font-semibold mb-3 text-[var(--color-primary)]">
              {{ $t('licenses.backendDependencies') }}
            </h3>
            <div class="space-y-2">
              <LicenseItem
                v-for="dep in backendDependencies"
                :key="dep.name"
                :name="dep.name"
                :license="dep.license"
                :url="dep.url"
                :description="dep.description"
              />
            </div>
          </section>

          <!-- Icons & Assets -->
          <section>
            <h3 class="text-lg font-semibold mb-3 text-[var(--color-primary)]">
              {{ $t('licenses.iconsAndAssets') }}
            </h3>
            <div class="space-y-2">
              <LicenseItem
                v-for="dep in iconDependencies"
                :key="dep.name"
                :name="dep.name"
                :license="dep.license"
                :url="dep.url"
                :description="dep.description"
              />
            </div>
          </section>
        </div>

        <!-- Close Button -->
        <div class="mt-6 pt-4 border-t border-[var(--color-border)]">
          <BaseButton
            variant="outline"
            size="md"
            shape="rounded"
            full-width
            @click="close"
          >
            {{ $t('common.close') }}
          </BaseButton>
        </div>

        <!-- Close Button (X) -->
        <IconButton
          variant="ghost"
          size="sm"
          shape="rounded"
          class="absolute top-4 right-4"
          :aria-label="$t('common.close')"
          @click="close"
        >
          <Icon name="XMark" class="w-6 h-6" />
        </IconButton>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

interface Dependency {
  name: string
  license: string
  url: string
  description?: string
}

// Frontend Dependencies
const frontendDependencies: Dependency[] = [
  {
    name: 'Nuxt',
    license: 'MIT',
    url: 'https://nuxt.com/',
    description: 'Vue.js Framework',
  },
  {
    name: 'Vue.js',
    license: 'MIT',
    url: 'https://vuejs.org/',
    description: 'Progressive JavaScript Framework',
  },
  {
    name: 'Tailwind CSS',
    license: 'MIT',
    url: 'https://tailwindcss.com/',
    description: 'Utility-first CSS Framework',
  },
  {
    name: 'Pinia',
    license: 'MIT',
    url: 'https://pinia.vuejs.org/',
    description: 'State Management for Vue',
  },
  {
    name: 'VueUse',
    license: 'MIT',
    url: 'https://vueuse.org/',
    description: 'Vue Composition Utilities',
  },
  {
    name: 'Vue I18n',
    license: 'MIT',
    url: 'https://vue-i18n.intlify.dev/',
    description: 'Internationalization Plugin',
  },
  {
    name: 'SimpleWebAuthn',
    license: 'MIT',
    url: 'https://simplewebauthn.dev/',
    description: 'WebAuthn/Passkey Library',
  },
]

// Backend Dependencies
const backendDependencies: Dependency[] = [
  {
    name: 'NestJS',
    license: 'MIT',
    url: 'https://nestjs.com/',
    description: 'Node.js Framework',
  },
  {
    name: 'Prisma',
    license: 'Apache-2.0',
    url: 'https://www.prisma.io/',
    description: 'Database ORM',
  },
  {
    name: 'BullMQ',
    license: 'MIT',
    url: 'https://docs.bullmq.io/',
    description: 'Message Queue Library',
  },
  {
    name: 'Sharp',
    license: 'Apache-2.0',
    url: 'https://sharp.pixelplumbing.com/',
    description: 'Image Processing Library',
  },
  {
    name: 'MinIO Client',
    license: 'Apache-2.0',
    url: 'https://min.io/',
    description: 'S3-compatible Storage Client',
  },
  {
    name: 'Nodemailer',
    license: 'MIT',
    url: 'https://nodemailer.com/',
    description: 'Email Sending Library',
  },
  {
    name: '@noble/curves',
    license: 'MIT',
    url: 'https://github.com/paulmillr/noble-curves',
    description: 'Cryptographic Curves Library',
  },
  {
    name: 'AT Protocol (Bluesky)',
    license: 'MIT/Apache-2.0',
    url: 'https://atproto.com/',
    description: 'Bluesky OAuth Integration',
  },
]

// Icons & Assets
const iconDependencies: Dependency[] = [
  {
    name: 'Heroicons',
    license: 'MIT',
    url: 'https://heroicons.com/',
    description: 'Icons by Tailwind Labs',
  },
]

// Close Modal
const close = () => {
  emit('close')
}
</script>
