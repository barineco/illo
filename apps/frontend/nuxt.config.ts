import { vitePluginMdToHTML } from 'vite-plugin-md-to-html'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxt/eslint', '@nuxtjs/color-mode', '@nuxtjs/i18n'],

  colorMode: {
    preference: 'system', // システム設定に従う
    fallback: 'dark', // フォールバック
    classSuffix: '', // .dark / .light クラス（suffixなし）
    storageKey: 'theme',
  },

  i18n: {
    locales: [
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'en', file: 'en.json', name: 'English' },
    ],
    defaultLocale: 'ja',
    strategy: 'no_prefix', // URLにロケールを含めない
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_locale',
      fallbackLocale: 'en',
      alwaysRedirect: false,
    },
    lazy: false, // 開発モードでは遅延読み込みを無効化してパフォーマンス向上
    langDir: 'locales',
    compilation: {
      strictMessage: false,
      escapeHtml: false,
    },
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: 'tailwind.config',
    exposeConfig: false,
    viewer: false,
  },

  css: ['~/assets/css/main.css'],

  // Component auto-import configuration
  components: [
    {
      path: '~/components',
      pathPrefix: false, // コンポーネント名にパスプレフィックスを付けない
    },
  ],

  app: {
    head: {
      // Default title - will be overridden by app.vue's useHead with dynamic instance name/tagline
      title: '',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'self-hosted illustration platform',
        },
        { name: 'theme-color', content: '#31BAE8' },
        // AI crawler protection - prevent image training
        { name: 'robots', content: 'max-image-preview:large, noimageai, noimageindex' },
        { name: 'googlebot', content: 'max-image-preview:large, noimageai, noimageindex' },
        { name: 'googlebot-image', content: 'noindex' },
        // Extended AI bot blocking
        { name: 'CCBot', content: 'nofollow, noindex' },
        { name: 'GPTBot', content: 'nofollow, noindex' },
        { name: 'ChatGPT-User', content: 'nofollow, noindex' },
        { name: 'anthropic-ai', content: 'nofollow, noindex' },
        { name: 'Google-Extended', content: 'noindex' },
        // Open Graph default meta tags
        { property: 'og:site_name', content: process.env.NUXT_PUBLIC_INSTANCE_NAME || 'illo' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: '/assets/logo/illo-card.png' },
        { property: 'og:image:width', content: '1600' },
        { property: 'og:image:height', content: '900' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:image', content: '/assets/logo/illo-card.png' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/assets/logo/illo-logo.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=MuseoModerno:wght@700;800;900&display=swap' },
      ],
    },
  },

  runtimeConfig: {
    // Private runtime config (server-only)
    apiBaseServer: process.env.API_BASE_SERVER || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:11104',
    // Public runtime config (client and server)
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:11104',
      // Instance ID for cookie namespacing (prevents session collision across multiple instances)
      instanceId: process.env.INSTANCE_ID || `port${process.env.FRONTEND_PORT || '11103'}`,
      // Instance branding
      instanceName: process.env.NUXT_PUBLIC_INSTANCE_NAME || 'illo',
      instanceTagline: process.env.NUXT_PUBLIC_INSTANCE_TAGLINE || '',
      // User interaction tracking secret (must match backend)
      interactionSecret: process.env.HEADLESS_DETECTION_INTERACTION_SECRET || 'default-secret-change-me',
    },
  },

  devServer: {
    port: parseInt(process.env.FRONTEND_PORT || '11103'),
    host: '0.0.0.0',
  },

  // Experimental features for performance
  experimental: {
    watcher: 'chokidar', // Fix slow file watching performance
  },

  // Vite optimization for faster dev server
  vite: {
    plugins: [
      // Transform Markdown to HTML at build time (SSR-safe)
      vitePluginMdToHTML(),
    ],
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        '@pinia/nuxt',
        '@nuxtjs/color-mode',
        'vue-i18n',
        '@intlify/shared',
        '@intlify/core-base',
        '@intlify/message-compiler',
        '@illo/shared',
      ],
    },
    server: {
      warmup: {
        clientFiles: [
          './pages/**/*.vue',
          './components/**/*.vue',
          './layouts/**/*.vue',
          './composables/**/*.ts',
        ],
      },
    },
  },

  // Development-only: Disable SSR completely for faster response times
  // Production builds will still use hybrid rendering via routeRules
  ssr: process.env.NODE_ENV === 'production',

  // Hybrid rendering: per-route SSR/SPA control to prevent memory leaks
  // Only applies when ssr: true (production mode)
  routeRules: {
    // Public routes - Use SSR for SEO
    '/': { ssr: true },
    '/artworks/**': { ssr: true },
    '/users/**': { ssr: true },

    // Authenticated routes - Use SPA to avoid memory leak
    '/settings/**': { ssr: false },
    '/upload': { ssr: false },
    '/notifications': { ssr: false },

    // Auth routes - SPA (no SEO needed, better UX)
    '/login': { ssr: false },
    '/register': { ssr: false },
    '/setup': { ssr: false },

    // Legal pages - SPA (markdown import issues with SSR)
    '/tos': { ssr: false },
    '/privacy': { ssr: false },

    // API routes should not be rendered
    '/api/**': { ssr: false },
  },

  // Development-specific configuration to reduce memory usage
  nitro: {
    minify: false,
    sourceMap: false,
    // Disable prerendering in dev mode
    prerender: {
      crawlLinks: false,
      routes: [],
    },
  },

  // Build optimizations
  build: {
    transpile: process.env.NODE_ENV === 'production' ? [] : [],
  },

  // Disable features not needed in development
  features: {
    devLogs: false,
  },
})
