import { describe, it, expect, vi } from 'vitest'

vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html,
  },
}))

import { useLinkify } from './useLinkify'

describe('useLinkify', () => {
  const { linkify } = useLinkify()

  it('returns empty string for falsy input', () => {
    expect(linkify('')).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(linkify('hello world')).toBe('hello world')
  })

  it('escapes HTML entities', () => {
    expect(linkify('<script>')).toBe('&lt;script&gt;')
  })

  it('converts URL to link', () => {
    const result = linkify('visit https://example.com today')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noopener noreferrer"')
  })

  it('strips trailing punctuation from URL', () => {
    const result = linkify('see https://example.com.')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('>https://example.com</a>.')
  })

  it('converts local mention to link', () => {
    const result = linkify('hello @alice')
    expect(result).toContain('href="/users/alice"')
    expect(result).toContain('@alice</a>')
  })

  it('converts remote mention to link', () => {
    const result = linkify('hello @alice@example.com')
    expect(result).toContain('href="https://example.com/@alice"')
  })

  it('escapes quotes in text', () => {
    expect(linkify('say "hello"')).toBe('say &quot;hello&quot;')
  })
})
