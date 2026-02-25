import { describe, it, expect } from 'vitest'
import {
  generateImageMetadata,
  generateSVGMetadata,
  detectImageFormat,
  getExtensionFromFormat,
  supportsSharpMetadata,
} from './image-metadata.util'
import type { MetadataInput } from './image-metadata.util'

const baseInput: MetadataInput = {
  username: 'testuser',
  artworkTitle: 'Test Artwork',
  artworkUrl: 'https://example.com/artwork/1',
}

describe('detectImageFormat', () => {
  it('maps standard MIME types', () => {
    expect(detectImageFormat('image/jpeg')).toBe('jpeg')
    expect(detectImageFormat('image/png')).toBe('png')
    expect(detectImageFormat('image/gif')).toBe('gif')
    expect(detectImageFormat('image/webp')).toBe('webp')
    expect(detectImageFormat('image/svg+xml')).toBe('svg')
  })

  it('handles image/jpg alias', () => {
    expect(detectImageFormat('image/jpg')).toBe('jpeg')
  })

  it('is case-insensitive', () => {
    expect(detectImageFormat('IMAGE/JPEG')).toBe('jpeg')
  })

  it('returns null for unknown types', () => {
    expect(detectImageFormat('image/bmp')).toBeNull()
    expect(detectImageFormat('text/plain')).toBeNull()
  })
})

describe('getExtensionFromFormat', () => {
  it('maps formats to extensions', () => {
    expect(getExtensionFromFormat('jpeg')).toBe('jpg')
    expect(getExtensionFromFormat('png')).toBe('png')
    expect(getExtensionFromFormat('webp')).toBe('webp')
    expect(getExtensionFromFormat('svg')).toBe('svg')
  })

  it('falls back to jpg for unknown formats', () => {
    expect(getExtensionFromFormat('bmp')).toBe('jpg')
  })

  it('is case-insensitive', () => {
    expect(getExtensionFromFormat('PNG')).toBe('png')
  })
})

describe('supportsSharpMetadata', () => {
  it('returns true for supported formats', () => {
    expect(supportsSharpMetadata('jpeg')).toBe(true)
    expect(supportsSharpMetadata('png')).toBe(true)
    expect(supportsSharpMetadata('webp')).toBe(true)
  })

  it('returns false for unsupported formats', () => {
    expect(supportsSharpMetadata('gif')).toBe(false)
    expect(supportsSharpMetadata('svg')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(supportsSharpMetadata('JPEG')).toBe(true)
  })
})

describe('generateImageMetadata', () => {
  it('uses username as author when displayName is absent', () => {
    const meta = generateImageMetadata(baseInput)
    expect(meta.exif?.IFD0?.Artist).toBe('testuser')
  })

  it('uses displayName as author when provided', () => {
    const meta = generateImageMetadata({
      ...baseInput,
      displayName: 'Test User',
    })
    expect(meta.exif?.IFD0?.Artist).toBe('Test User')
  })

  it('defaults license to All Rights Reserved', () => {
    const meta = generateImageMetadata(baseInput)
    expect(meta.exif?.IFD0?.Copyright).toContain('All Rights Reserved')
  })

  it('uses custom license when provided', () => {
    const meta = generateImageMetadata({
      ...baseInput,
      license: 'CC BY 4.0',
    })
    expect(meta.exif?.IFD0?.Copyright).toContain('CC BY 4.0')
    expect(meta.iptc?.['2#116']).toBe('CC BY 4.0')
  })

  it('sets artwork title in EXIF and IPTC', () => {
    const meta = generateImageMetadata(baseInput)
    expect(meta.exif?.IFD0?.ImageDescription).toBe('Test Artwork')
    expect(meta.iptc?.['2#105']).toBe('Test Artwork')
  })

  it('includes tools when provided', () => {
    const meta = generateImageMetadata({
      ...baseInput,
      toolsUsed: ['Photoshop', 'Procreate'],
    })
    expect((meta.exif?.IFD0 as any)?.Software).toBe('Photoshop, Procreate')
    expect((meta.iptc as any)?.['2#65']).toBe('Photoshop, Procreate')
  })

  it('omits tools fields when not provided', () => {
    const meta = generateImageMetadata(baseInput)
    expect((meta.exif?.IFD0 as any)?.Software).toBeUndefined()
    expect((meta.iptc as any)?.['2#65']).toBeUndefined()
  })

  it('includes project name in IPTC when provided', () => {
    const meta = generateImageMetadata({
      ...baseInput,
      projectName: 'My Series',
    })
    expect((meta.iptc as any)?.['2#25']).toBe('My Series')
  })

  it('generates XMP metadata', () => {
    const meta = generateImageMetadata(baseInput)
    expect(meta.xmp).toContain('<?xpacket')
    expect(meta.xmp).toContain('dc:title')
    expect(meta.xmp).toContain('Test Artwork')
  })

  it('includes commission info in XMP when flagged', () => {
    const meta = generateImageMetadata({
      ...baseInput,
      isCommission: true,
      clientName: 'Client A',
    })
    expect(meta.xmp).toContain('illustboard:isCommission')
    expect(meta.xmp).toContain('Client A')
  })

  it('escapes XML special characters', () => {
    const meta = generateImageMetadata({
      ...baseInput,
      artworkTitle: 'Art & <Design>',
    })
    expect(meta.xmp).toContain('Art &amp; &lt;Design&gt;')
  })
})

describe('generateSVGMetadata', () => {
  it('wraps content in <metadata> element', () => {
    const svg = generateSVGMetadata(baseInput)
    expect(svg).toMatch(/^<metadata>/)
    expect(svg).toMatch(/<\/metadata>$/)
  })

  it('includes Dublin Core fields', () => {
    const svg = generateSVGMetadata(baseInput)
    expect(svg).toContain('dc:title')
    expect(svg).toContain('dc:creator')
    expect(svg).toContain('dc:rights')
  })

  it('includes creation date when provided', () => {
    const svg = generateSVGMetadata({
      ...baseInput,
      creationDate: new Date('2025-01-01T00:00:00Z'),
    })
    expect(svg).toContain('xmp:CreateDate')
    expect(svg).toContain('2025-01-01')
  })

  it('omits creation date when not provided', () => {
    const svg = generateSVGMetadata(baseInput)
    expect(svg).not.toContain('xmp:CreateDate')
  })

  it('includes medium label when provided', () => {
    const svg = generateSVGMetadata({ ...baseInput, medium: 'THREE_D' })
    expect(svg).toContain('3D')
  })
})
