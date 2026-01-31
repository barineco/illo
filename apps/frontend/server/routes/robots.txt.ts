/**
 * Dynamic robots.txt generation based on instance settings
 *
 * This replaces the static robots.txt file to allow runtime configuration.
 * The robots.txt content is cached for 30 minutes to balance performance
 * and configuration update responsiveness.
 */

// Cache configuration
const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// Cache store
let cachedRobotsTxt: string | null = null
let cacheTimestamp: number = 0

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  if (!cachedRobotsTxt) return false
  const now = Date.now()
  return (now - cacheTimestamp) < CACHE_DURATION_MS
}

/**
 * Generate robots.txt content based on settings
 */
function generateRobotsTxt(allowSearchEngineIndexing: boolean): string {
  // AI training bots - always blocked
  const aiBotsBlock = `# AI Training Bots (Always Blocked)
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: CCBot
User-agent: Google-Extended
User-agent: anthropic-ai
User-agent: Claude-Web
User-agent: Omgilibot
User-agent: Omgili
User-agent: FacebookBot
User-agent: Diffbot
User-agent: Bytespider
User-agent: PerplexityBot
Disallow: /
`

  if (!allowSearchEngineIndexing) {
    // Block all bots (default for privacy)
    return `# Open IllustBoard - Privacy-First Configuration
# All search engines and crawlers are blocked by default
# SNS/ActivityPub previews are handled separately and work regardless of this setting

User-agent: *
Disallow: /

${aiBotsBlock}`
  }

  // Allow search engines but protect sensitive areas
  return `# Open IllustBoard - Search Engine Indexing Enabled
# Search engines can index public content
# API endpoints, admin pages, and user-specific pages are protected
# SNS/ActivityPub previews work regardless of this setting

User-agent: *
Disallow: /api/
Disallow: /admin
Disallow: /dashboard
Disallow: /upload
Disallow: /settings
Disallow: /messages

${aiBotsBlock}`
}

/**
 * Fetch instance settings from backend API
 */
async function fetchInstanceSettings(): Promise<boolean> {
  try {
    const backendUrl = process.env.NUXT_PUBLIC_API_BASE_URL || 'http://backend:11104'
    const response = await $fetch<{
      instanceInfo: { allowSearchEngineIndexing: boolean }
    }>(`${backendUrl}/api/setup/status`)

    return response.instanceInfo?.allowSearchEngineIndexing ?? false
  } catch (error) {
    console.error('Failed to fetch instance settings for robots.txt:', error)
    // Default to blocking on error (fail-safe)
    return false
  }
}

/**
 * Nuxt server route handler for /robots.txt
 */
export default defineEventHandler(async (event) => {
  if (isCacheValid() && cachedRobotsTxt) {
    return cachedRobotsTxt
  }

  const allowSearchEngineIndexing = await fetchInstanceSettings()
  cachedRobotsTxt = generateRobotsTxt(allowSearchEngineIndexing)
  cacheTimestamp = Date.now()

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')

  return cachedRobotsTxt
})
