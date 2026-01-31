<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]"
      >
        <!-- Modal -->
        <div class="bg-[var(--color-surface)] rounded-lg w-full max-w-md mx-4 p-6 text-center shadow-xl">
          <!-- Warning Icon -->
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--color-warning-bg)] flex items-center justify-center">
            <Icon name="ExclamationTriangle" class="w-10 h-10 text-[var(--color-warning-text)]" />
          </div>

          <!-- Title -->
          <h2 class="text-xl font-bold mb-2">{{ $t('ageVerification.title') }}</h2>

          <!-- Rating Badge -->
          <div class="inline-flex items-center gap-1 px-3 py-1 mb-4 rounded-full text-sm font-medium bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]">
            {{ ratingLabel }}
          </div>

          <!-- Description -->
          <p class="text-[var(--color-text-muted)] mb-6">
            {{ $t('ageVerification.description') }}
          </p>

          <!-- Buttons -->
          <div class="flex flex-col gap-3">
            <BaseButton
              variant="primary"
              size="lg"
              shape="rounded"
              @click="handleConfirm"
            >
              {{ $t('ageVerification.confirm') }}
            </BaseButton>
            <BaseButton
              variant="ghost"
              size="md"
              shape="rounded"
              @click="handleCancel"
            >
              {{ $t('ageVerification.goBack') }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const { t } = useI18n()

interface Props {
  isOpen: boolean
  rating?: 'R18' | 'R18G'
}

const props = withDefaults(defineProps<Props>(), {
  rating: 'R18',
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const ratingLabel = computed(() => {
  if (props.rating === 'R18G') {
    return t('artwork.rating.r18g')
  }
  return t('artwork.rating.r18')
})

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>
