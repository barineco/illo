/**
 * Generate placeholder images for hotlink protection
 *
 * Run with: npx ts-node scripts/generate-placeholder-images.ts
 */
import * as sharp from 'sharp'
import * as path from 'path'
import * as fs from 'fs'

const ASSETS_DIR = path.join(__dirname, '../src/assets')

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true })
}

interface PlaceholderConfig {
  filename: string
  text: string
  subtext: string
}

const placeholders: PlaceholderConfig[] = [
  {
    filename: 'protected-image-ja.jpg',
    text: 'この画像は保護されています',
    subtext: 'illo でご覧ください',
  },
  {
    filename: 'protected-image-en.jpg',
    text: 'This image is protected',
    subtext: 'View on illo',
  },
]

async function generatePlaceholder(config: PlaceholderConfig): Promise<void> {
  const width = 800
  const height = 600

  // Create SVG with text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2a2a2a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <text x="50%" y="45%" text-anchor="middle" font-family="sans-serif" font-size="32" font-weight="bold" fill="#888888">${config.text}</text>
      <text x="50%" y="55%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#666666">${config.subtext}</text>
      <rect x="30%" y="70%" width="40%" height="2" fill="#0096fa" rx="1"/>
    </svg>
  `

  const outputPath = path.join(ASSETS_DIR, config.filename)

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 85 })
    .toFile(outputPath)

  console.log(`Generated: ${outputPath}`)
}

async function main() {
  console.log('Generating placeholder images...')

  for (const config of placeholders) {
    await generatePlaceholder(config)
  }

  console.log('Done!')
}

main().catch(console.error)
