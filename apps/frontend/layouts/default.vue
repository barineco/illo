<template>
  <div class="min-h-screen bg-[var(--color-background)]">
    <!-- Sidebar -->
    <aside
      :class="[
        'sidebar fixed left-0 top-0 h-screen bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col z-50 transition-all duration-300',
        isCollapsed ? 'w-16 collapsed' : 'w-60'
      ]"
    >
      <!-- Top Section: Logo & Navigation -->
      <div class="flex-1 overflow-y-auto p-2">
        <!-- Logo -->
        <NuxtLink to="/" class="logo-link flex items-center mb-4 mt-2 h-12 px-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-300">
          <img
            src="/assets/logo/illo-logo.svg"
            alt="Logo"
            class="w-10 h-10 flex-shrink-0"
          />
          <h1
            class="app-title text-[var(--color-primary)] text-2xl whitespace-nowrap overflow-hidden transition-all duration-300"
            :class="showText ? 'opacity-100 max-w-[200px] ml-3' : 'opacity-0 max-w-0 ml-0'"
          >
            {{ instanceName }}
          </h1>
        </NuxtLink>

        <!-- Navigation -->
        <nav class="space-y-2">
          <NuxtLink
            to="/"
            class="nav-link flex items-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-300 h-11 px-4"
            :title="isCollapsed ? $t('nav.home') : undefined"
          >
            <Icon name="Home" class="nav-icon w-5 h-5 flex-shrink-0" />
            <span
              class="whitespace-nowrap overflow-hidden transition-all duration-300"
              :class="showText ? 'opacity-100 max-w-[200px] ml-3' : 'opacity-0 max-w-0 ml-0'"
            >{{ $t('nav.home') }}</span>
          </NuxtLink>

          <!-- Authenticated: Show Dashboard, Profile, Settings -->
          <template v-if="isAuthenticated && user">
            <NuxtLink
              to="/dashboard"
              class="nav-link flex items-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-300 h-11 px-4"
              :title="isCollapsed ? $t('nav.dashboard') : undefined"
            >
              <Icon name="Squares2X2" class="nav-icon w-5 h-5 flex-shrink-0" />
              <span
                class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="showText ? 'opacity-100 max-w-[200px] ml-3' : 'opacity-0 max-w-0 ml-0'"
              >{{ $t('nav.dashboard') }}</span>
            </NuxtLink>

            <NuxtLink
              :to="`/users/${user.username}`"
              class="nav-link flex items-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-300 h-11 px-4"
              :title="isCollapsed ? $t('nav.profile') : undefined"
            >
              <Icon name="User" class="nav-icon w-5 h-5 flex-shrink-0" />
              <span
                class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="showText ? 'opacity-100 max-w-[200px] ml-3' : 'opacity-0 max-w-0 ml-0'"
              >{{ $t('nav.profile') }}</span>
            </NuxtLink>

            <NuxtLink
              to="/settings"
              class="nav-link flex items-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-300 h-11 px-4"
              :title="isCollapsed ? $t('nav.settings') : undefined"
            >
              <Icon name="Cog6Tooth" class="nav-icon w-5 h-5 flex-shrink-0" />
              <span
                class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="showText ? 'opacity-100 max-w-[200px] ml-3' : 'opacity-0 max-w-0 ml-0'"
              >{{ $t('nav.settings') }}</span>
            </NuxtLink>

            <NuxtLink
              v-if="user?.role === 'ADMIN'"
              to="/admin"
              class="nav-link flex items-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-all duration-300 h-11 px-4"
              :title="isCollapsed ? $t('nav.admin') : undefined"
            >
              <Icon name="Cog8Tooth" class="nav-icon w-5 h-5 flex-shrink-0" />
              <span
                class="whitespace-nowrap overflow-hidden transition-all duration-300"
                :class="showText ? 'opacity-100 max-w-[200px] ml-3' : 'opacity-0 max-w-0 ml-0'"
              >{{ $t('nav.admin') }}</span>
            </NuxtLink>
          </template>

          <!-- Unauthenticated: Show Login CTA -->
          <template v-else>
            <div v-if="showText" class="mt-4 p-4 bg-[var(--color-surface-secondary)]/50 rounded-lg">
              <p class="text-sm text-[var(--color-text-muted)] mb-3">
                {{ allowRegistration ? $t('auth.loginCta') : $t('auth.loginOnlyCta') }}
              </p>
              <BaseButton
                variant="primary"
                size="lg"
                shape="rounded"
                full-width
                @click="navigateTo('/login')"
              >
                {{ $t('nav.login') }}
              </BaseButton>
              <BaseButton
                v-if="allowRegistration"
                variant="secondary"
                size="sm"
                shape="rounded"
                full-width
                class="mt-2"
                @click="navigateTo('/register')"
              >
                {{ $t('nav.register') }}
              </BaseButton>
            </div>
            <!-- Collapsed: Show login icon only -->
            <div v-else-if="isCollapsed" class="mt-4 flex justify-center">
              <IconButton
                variant="primary"
                size="sm"
                shape="rounded"
                :aria-label="$t('nav.login')"
                :title="$t('nav.login')"
                @click="navigateTo('/login')"
              >
                <Icon name="Key" class="w-5 h-5" />
              </IconButton>
            </div>
          </template>
        </nav>
      </div>

      <!-- Toast Notifications -->
      <SidebarToast />

      <!-- Bottom Section: Theme & Language Settings -->
      <div class="border-t border-[var(--color-border)] p-3">
        <div :class="['flex items-center gap-2', isCollapsed ? 'flex-col' : 'justify-center']">
          <!-- About / Instance Info -->
          <IconButton
            variant="ghost"
            size="sm"
            shape="rounded"
            :aria-label="$t('about.pageTitle')"
            :title="$t('about.pageTitle')"
            @click="navigateTo('/about')"
          >
            <Icon name="InformationCircle" class="w-5 h-5" />
          </IconButton>

          <!-- Theme Toggle -->
          <IconButton
            variant="ghost"
            size="sm"
            shape="rounded"
            :aria-label="$colorMode.value === 'dark' ? $t('theme.switchToLight') : $t('theme.switchToDark')"
            :title="$colorMode.value === 'dark' ? $t('theme.switchToLight') : $t('theme.switchToDark')"
            @click="toggleTheme"
          >
            <Icon v-if="$colorMode.value === 'dark'" name="Moon" class="w-5 h-5" />
            <Icon v-else name="Sun" class="w-5 h-5" />
          </IconButton>

          <!-- Language Selector -->
          <div class="relative" data-dropdown-container>
            <IconButton
              variant="ghost"
              size="sm"
              shape="rounded"
              :aria-label="currentLocaleName"
              :title="currentLocaleName"
              @click="languageMenuDropdown.toggle()"
            >
              <Icon name="Language" class="w-5 h-5" />
            </IconButton>

            <!-- Language Dropdown (opens upward, or to the right when collapsed) -->
            <div
              v-if="languageMenuDropdown.isOpen.value"
              :class="[
                'absolute w-32 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 z-50',
                isCollapsed
                  ? 'left-full bottom-0 ml-1'
                  : 'bottom-full left-1/2 -translate-x-1/2 mb-1'
              ]"
            >
              <button
                v-for="loc in availableLocales"
                :key="loc.code"
                @click="setLocale(loc.code)"
                class="w-full flex items-center px-3 py-2 hover:bg-[var(--color-surface-hover)] transition-colors text-sm"
                :class="{ 'text-[var(--color-primary)]': loc.code === locale }"
              >
                <Icon
                  v-if="loc.code === locale"
                  name="Check"
                  class="w-4 h-4 mr-2"
                />
                <span :class="{ 'ml-6': loc.code !== locale }">{{ loc.name }}</span>
              </button>
            </div>
          </div>

          <!-- Collapse Toggle Button (only show on larger screens) -->
          <IconButton
            v-if="canToggle"
            variant="ghost"
            size="sm"
            shape="rounded"
            :aria-label="isCollapsed ? $t('sidebar.expand') : $t('sidebar.collapse')"
            :title="isCollapsed ? $t('sidebar.expand') : $t('sidebar.collapse')"
            @click="toggleSidebar"
          >
            <Icon :name="isCollapsed ? 'ChevronRight' : 'ChevronLeft'" class="w-5 h-5" />
          </IconButton>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <div :class="['transition-all duration-300', isCollapsed ? 'ml-16' : 'ml-60']">
      <!-- Header -->
      <header
        class="sticky top-0 h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 flex items-center justify-between z-40"
      >
        <!-- Search Bar -->
        <div class="flex-1 max-w-2xl">
          <SearchAutocomplete />
        </div>

        <!-- User Menu -->
        <div class="flex items-center gap-4 ml-6">
          <template v-if="isAuthenticated">
            <NotificationDropdown />

            <MessageDropdown />

            <IconButton
              variant="primary"
              size="sm"
              shape="circle"
              :aria-label="$t('nav.post')"
              :title="$t('nav.post')"
              @click="navigateTo('/upload')"
            >
              <Icon name="DocumentArrowUp" class="w-6 h-6" />
            </IconButton>

            <!-- User Avatar with Dropdown -->
            <div class="relative" data-dropdown-container>
              <button
                @click="userMenuDropdown.toggle()"
                class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center hover:ring-2 ring-[var(--color-primary)] transition-all overflow-hidden"
                :title="user ? `${user.username}` : ''"
              >
                <img
                  v-if="user?.avatarUrl"
                  :src="user.avatarUrl"
                  :alt="user.username"
                  class="w-full h-full object-cover"
                />
                <Icon v-else name="UserCircle" class="w-6 h-6" />
              </button>

              <!-- Dropdown Menu -->
              <div
                v-if="userMenuDropdown.isOpen.value"
                class="absolute right-0 top-12 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl py-2 z-[60]"
              >
                <NuxtLink
                  :to="profileLink"
                  @click="userMenuDropdown.close()"
                  class="flex items-center px-4 py-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <Icon name="UserCircle" class="w-5 h-5 mr-3" />
                  <span>{{ $t('nav.profile') }}</span>
                </NuxtLink>
                <NuxtLink
                  to="/settings"
                  @click="userMenuDropdown.close()"
                  class="flex items-center px-4 py-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <Icon name="Cog6Tooth" class="w-5 h-5 mr-3" />
                  <span>{{ $t('nav.settings') }}</span>
                </NuxtLink>
                <div class="border-t border-[var(--color-border)] my-1"></div>
                <button
                  @click="handleLogoutFromMenu"
                  class="w-full flex items-center px-4 py-2 hover:bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] transition-colors"
                >
                  <Icon name="ArrowRightOnRectangle" class="w-5 h-5 mr-3" />
                  <span>{{ $t('nav.logout') }}</span>
                </button>
              </div>
            </div>
          </template>
          <template v-else>
            <!-- Unauthenticated: User Icon with Dropdown -->
            <div class="relative" data-dropdown-container>
              <button
                @click="userMenuDropdown.toggle()"
                class="w-10 h-10 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center hover:ring-2 ring-[var(--color-primary)] transition-all"
                :title="$t('nav.login')"
              >
                <Icon name="UserCircle" class="w-6 h-6" />
              </button>

              <!-- Dropdown Menu -->
              <div
                v-if="userMenuDropdown.isOpen.value"
                class="absolute right-0 top-12 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl py-2 z-[60]"
              >
                <NuxtLink
                  to="/login"
                  @click="userMenuDropdown.close()"
                  class="flex items-center px-4 py-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <Icon name="Key" class="w-5 h-5 mr-3" />
                  <span>{{ $t('nav.login') }}</span>
                </NuxtLink>
                <NuxtLink
                  v-if="allowRegistration"
                  to="/register"
                  @click="userMenuDropdown.close()"
                  class="flex items-center px-4 py-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <Icon name="Sparkles" class="w-5 h-5 mr-3" />
                  <span>{{ $t('nav.register') }}</span>
                </NuxtLink>
              </div>
            </div>
          </template>
        </div>
      </header>

      <!-- Page Content -->
      <main class="p-6">
        <slot />
      </main>
    </div>

    <!-- Cookie Consent Banner (for non-authenticated users) -->
    <CookieConsentBanner />
  </div>
</template>

<script setup lang="ts">
const { user, isAuthenticated, logout, fetchCurrentUser } = useAuth()
const colorMode = useColorMode()
const { t, locale, locales, setLocale: i18nSetLocale } = useI18n()
const api = useApi()
const runtimeConfig = useRuntimeConfig()

// Instance branding from runtime config
const instanceName = computed(() => runtimeConfig.public.instanceName || 'illo')

// Dropdown management using global composable
const userMenuDropdown = useDropdown('user-menu')
const languageMenuDropdown = useDropdown('language-menu')

// Sidebar collapse management
const { isCollapsed, canToggle, showText, toggle: toggleSidebar } = useSidebarCollapse()

// Setup global click handler to close dropdowns when clicking outside
useGlobalDropdownClickHandler()

// Setup sidebar collapse responsive listener
useSidebarCollapseListener()

// Instance info for registration settings
const allowRegistration = ref(true) // Default to true

// Fetch instance info to check if registration is allowed
const fetchInstanceInfo = async () => {
  try {
    const response = await api.get<{ instanceInfo: { allowRegistration: boolean } }>('/api/setup/status')
    allowRegistration.value = response.instanceInfo?.allowRegistration ?? true
  } catch (error) {
    // If fetch fails, default to allowing registration
    console.error('Failed to fetch instance info:', error)
    allowRegistration.value = true
  }
}

// Available locales with names
const availableLocales = computed(() => {
  return (locales.value as Array<{ code: string; name: string }>).map((l) => ({
    code: l.code,
    name: l.name,
  }))
})

// Current locale name
const currentLocaleName = computed(() => {
  const current = availableLocales.value.find((l) => l.code === locale.value)
  return current?.name || locale.value
})

// Set locale
const setLocale = (code: string) => {
  i18nSetLocale(code as 'ja' | 'en')
  languageMenuDropdown.close()
}

// Theme toggle
const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Generate profile link dynamically
const profileLink = computed(() => {
  return user.value ? `/users/${user.value.username}` : '/login'
})

// Logout from dropdown menu
const handleLogoutFromMenu = () => {
  userMenuDropdown.close()
  if (confirm(t('auth.logoutConfirm'))) {
    logout()
  }
}

// Fetch user on mount if token exists
onMounted(() => {
  fetchCurrentUser()
  fetchInstanceInfo()
})
</script>

<style scoped>
/* App title with MuseoModerno font */
.app-title {
  font-family: 'MuseoModerno', sans-serif;
  font-weight: 900;
  line-height: 1;
}

/* Custom scrollbar for sidebar navigation area */
aside > div:first-child::-webkit-scrollbar {
  width: 6px;
}

aside > div:first-child::-webkit-scrollbar-track {
  background: transparent;
}

aside > div:first-child::-webkit-scrollbar-thumb {
  background: var(--color-surface-tertiary);
  border-radius: 3px;
}

aside > div:first-child::-webkit-scrollbar-thumb:hover {
  background: var(--color-border);
}

/* Sidebar text transition */
.sidebar-text-enter-active {
  transition: opacity 0.15s ease-out;
}

.sidebar-text-leave-active {
  transition: opacity 0.05s ease-in;
}

.sidebar-text-enter-from,
.sidebar-text-leave-to {
  opacity: 0;
}

/* Navigation link smooth centering for collapsed state */
/*
 * Expanded: sidebar=240px, p-4 container padding (16px), nav-link px-4 (16px)
 * Collapsed: sidebar=64px, p-2 container padding (8px), need icon (20px) centered
 *   - Nav-link inner width = 64 - 8*2 = 48px
 *   - To center icon: (48 - 20) / 2 = 14px padding-left
 */
.nav-link {
  transition: padding 0.3s ease;
}

.sidebar-text {
  margin-left: 0.75rem; /* gap-3 equivalent */
}

/* Collapsed sidebar: adjust padding to center icons */
.sidebar.collapsed .nav-link {
  padding-left: 0.875rem; /* 14px to center 20px icon in 48px inner width */
  padding-right: 0.875rem;
}

/* Logo link - fixed height container for logo + text */
.logo-link {
  transition: padding 0.3s ease;
}

/* Collapsed sidebar: center logo */
/*
 * Logo size: 40px (w-10 h-10)
 * Sidebar: 64px, container p-2 (8px each side), inner width = 48px
 * Slightly less than (48 - 40) / 2 = 4px to prevent clipping
 */
.sidebar.collapsed .logo-link {
  padding-left: 0.225rem;
  padding-right: 0.225rem;
}
</style>
