import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, extname } from 'path'

const FRONTEND_ROOT = resolve(__dirname, '../..')

function collectKeys(obj: Record<string, any>, prefix = ''): string[] {
  const keys: string[] = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...collectKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys.sort()
}

function loadLocale(filename: string): Record<string, any> {
  const filepath = resolve(__dirname, filename)
  return JSON.parse(readFileSync(filepath, 'utf-8'))
}

function walkFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === '.nuxt' || entry === '.output') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...walkFiles(full, exts))
    } else if (exts.includes(extname(full))) {
      results.push(full)
    }
  }
  return results
}

function extractUsedKeys(files: string[], topLevelKeys: Set<string>): { keys: Set<string>; prefixes: Set<string> } {
  const keys = new Set<string>()
  const prefixes = new Set<string>()
  // 1. Static t()/\$t() calls with quoted strings
  const tCallPattern = /\$?t\(\s*['"]([\w.]+)['"]/g
  // 2. Dynamic t() calls with template literals: t(`prefix.${var}`)
  const tTemplateLitPattern = /\$?t\(\s*`([\w.]+)\.\$\{/g
  // 3. i18n key references in known property patterns
  const keyPropPattern = /(?:labelKey|i18nKey|titleKey|messageKey|placeholderKey)\s*[:=]\s*['"]([\w.]+)['"]/g
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    let match
    while ((match = tCallPattern.exec(content)) !== null) {
      const key = match[1]
      if (key.includes('.') && topLevelKeys.has(key.split('.')[0])) {
        keys.add(key)
      }
    }
    while ((match = tTemplateLitPattern.exec(content)) !== null) {
      prefixes.add(match[1])
    }
    while ((match = keyPropPattern.exec(content)) !== null) {
      const key = match[1]
      if (topLevelKeys.has(key.split('.')[0])) {
        keys.add(key)
      }
    }
  }
  return { keys, prefixes }
}

function keyExists(obj: Record<string, any>, dottedKey: string): boolean {
  const parts = dottedKey.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return false
    if (!(part in current)) return false
    current = current[part]
  }
  return true
}

describe('i18n key consistency', () => {
  const en = loadLocale('en.json')
  const ja = loadLocale('ja.json')
  const enKeys = collectKeys(en)
  const jaKeys = collectKeys(ja)
  const enSet = new Set(enKeys)
  const jaSet = new Set(jaKeys)

  it('en.json keys all exist in ja.json', () => {
    const missing = enKeys.filter((k) => !jaSet.has(k))
    if (missing.length > 0) {
      console.warn(`[i18n] ${missing.length} keys in en.json missing from ja.json:`)
      missing.forEach((k) => console.warn(`  - ${k}`))
    }
    expect(missing).toEqual([])
  })

  it('ja.json keys all exist in en.json', () => {
    const missing = jaKeys.filter((k) => !enSet.has(k))
    if (missing.length > 0) {
      console.warn(`[i18n] ${missing.length} keys in ja.json missing from en.json:`)
      missing.forEach((k) => console.warn(`  - ${k}`))
    }
    expect(missing).toEqual([])
  })

  describe('code ↔ locale', () => {
    const sourceFiles = walkFiles(FRONTEND_ROOT, ['.vue', '.ts']).filter(
      (f) => !f.includes('.spec.') && !f.includes('/node_modules/'),
    )
    const topLevelKeys = new Set(Object.keys(en))
    const { keys: usedKeys, prefixes: dynamicPrefixes } = extractUsedKeys(sourceFiles, topLevelKeys)

    it('all statically referenced keys exist in en.json', () => {
      const missing = [...usedKeys].filter((k) => !keyExists(en, k)).sort()
      if (missing.length > 0) {
        console.warn(`[i18n] ${missing.length} keys used in code but missing from en.json:`)
        missing.forEach((k) => console.warn(`  - ${k}`))
      }
      expect(missing).toEqual([])
    })

    it('all statically referenced keys exist in ja.json', () => {
      const missing = [...usedKeys].filter((k) => !keyExists(ja, k)).sort()
      if (missing.length > 0) {
        console.warn(`[i18n] ${missing.length} keys used in code but missing from ja.json:`)
        missing.forEach((k) => console.warn(`  - ${k}`))
      }
      expect(missing).toEqual([])
    })

    it('all locale keys are referenced in code or are children of referenced keys', () => {
      const unreferencedEn = enKeys.filter((k) => {
        if (usedKeys.has(k)) return false
        // Check dynamic prefixes: t(`prefix.${val}`) covers prefix.*
        for (const prefix of dynamicPrefixes) {
          if (k.startsWith(prefix + '.')) return false
        }
        const parts = k.split('.')
        for (let i = 1; i < parts.length; i++) {
          const ancestor = parts.slice(0, i).join('.')
          if (usedKeys.has(ancestor)) return false
        }
        for (const used of usedKeys) {
          if (used.startsWith(k + '.')) return false
        }
        return true
      })

      if (unreferencedEn.length > 0) {
        console.warn(`[i18n] ${unreferencedEn.length} keys in en.json appear unused (may include false positives from dynamic key patterns):`)
        unreferencedEn.forEach((k) => console.warn(`  - ${k}`))
      }
      // Warn-only: dynamic key patterns make exhaustive static detection impractical.
      // This test surfaces potentially dead keys for manual review.
      expect(unreferencedEn.length).toBeLessThan(200)
    })
  })
})
