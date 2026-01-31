<template>
  <!-- Toast overlay positioned within sidebar -->
  <div class="toast-overlay">
    <TransitionGroup
      name="toast"
      tag="div"
      class="toast-list"
      @before-leave="onBeforeLeave"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'toast-item flex items-start gap-2 p-3 rounded-lg text-sm border shadow-lg',
          toastClasses[toast.type],
        ]"
      >
        <!-- Icon -->
        <Icon :name="toastIcons[toast.type]" class="w-4 h-4 flex-shrink-0 mt-0.5" />

        <!-- Message -->
        <span class="flex-1 break-words">{{ toast.message }}</span>

        <!-- Close button -->
        <button
          @click="removeToast(toast.id)"
          class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <Icon name="XMark" class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const { toasts, remove: removeToast } = useToast()

const toastClasses: Record<string, string> = {
  success: 'bg-[var(--color-success-bg)] border-[var(--color-success-border)] text-[var(--color-success-text)]',
  error: 'bg-[var(--color-danger-bg)] border-[var(--color-danger-border)] text-[var(--color-danger-text)]',
  info: 'bg-[var(--color-info-bg)] border-[var(--color-info-border)] text-[var(--color-info-text)]',
  warning: 'bg-[var(--color-warning-bg)] border-[var(--color-warning-text)] text-[var(--color-warning-text)]',
}

const toastIcons: Record<string, string> = {
  success: 'CheckCircle',
  error: 'ExclamationCircle',
  info: 'InformationCircle',
  warning: 'ExclamationTriangle',
}

/**
 * Before leave: capture current height and set max-height for collapse animation
 */
function onBeforeLeave(el: Element) {
  const htmlEl = el as HTMLElement
  // Set max-height for collapse animation
  htmlEl.style.maxHeight = `${htmlEl.offsetHeight}px`
}
</script>

<style scoped>
/*
 * Toast overlay spans from top of sidebar to bottom bar.
 * Uses flex-end to anchor content to bottom.
 *
 * Array order: [oldest, ..., newest] (push adds to end, shift removes from start)
 * With normal column: oldest at top, newest at bottom
 *
 * Animation strategy:
 * - Leave items stay in document flow and animate with transform (like move)
 * - Height collapse happens simultaneously so remaining items fill the gap
 * - This allows leaving items to "move while fading" when new items are added
 */
.toast-overlay {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 56px; /* Above the bottom settings bar */
  padding: 0 0.75rem;
  pointer-events: none;
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.toast-list {
  display: flex;
  flex-direction: column;
}

.toast-item {
  pointer-events: auto;
  box-sizing: border-box;
  margin-bottom: 0.5rem;
}

.toast-item:last-child {
  margin-bottom: 0;
}

/* Enter animation - slide up from below */
.toast-enter-active {
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.toast-enter-to {
  opacity: 1;
  transform: translateY(0);
}

/*
 * Leave animation - fade out while allowing transform (FLIP) animation
 * The key is to include 'transform' in the transition so the element
 * can move smoothly if new items are added during its leave animation.
 * Height collapse happens to make space for remaining items.
 */
.toast-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease,
    max-height 0.3s ease,
    margin 0.3s ease,
    padding 0.3s ease;
  overflow: hidden;
}

.toast-leave-to {
  opacity: 0;
  max-height: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* Move animation - smooth repositioning when items are added/removed */
.toast-move {
  transition: transform 0.3s ease;
}
</style>
