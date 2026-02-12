/**
 * Image Metadata Utility
 *
 * Generates EXIF, IPTC, and XMP metadata for artwork images
 * to embed copyright information and author attribution.
 */

export interface ImageMetadata {
  exif?: {
    IFD0?: {
      Artist?: string
      Copyright?: string
      ImageDescription?: string
    }
  }
  iptc?: {
    '2#80'?: string   // By-line (Creator)
    '2#116'?: string  // Copyright Notice
    '2#110'?: string  // Credit
    '2#105'?: string  // Headline (Title)
  }
  xmp?: string  // Dublin Core RDF XML
}

export interface MetadataInput {
  username: string
  displayName?: string
  artworkTitle: string
  artworkUrl: string
  license?: string
  // Extended creation metadata
  creationDate?: Date | string
  toolsUsed?: string[]
  medium?: 'DIGITAL' | 'TRADITIONAL' | 'THREE_D' | 'MIXED'
  projectName?: string
  isCommission?: boolean
  clientName?: string
}

/**
 * Generate comprehensive metadata for Sharp processing
 * Includes EXIF, IPTC, and XMP for maximum compatibility
 *
 * Standard field mappings:
 * - creationDate → EXIF DateTimeOriginal, XMP xmp:CreateDate
 * - toolsUsed → IPTC 2#65 Software, XMP xmp:CreatorTool
 * - medium → XMP custom field
 * - projectName → IPTC 2#103 Subject, XMP dc:subject
 * - isCommission/clientName → XMP custom fields
 */
export function generateImageMetadata(input: MetadataInput): ImageMetadata {
  const authorName = input.displayName || input.username
  const license = input.license || 'All Rights Reserved'
  const copyrightNotice = `© ${authorName}. ${license}`

  // Format tools as comma-separated string for IPTC
  const toolsString = input.toolsUsed?.join(', ')

  const metadata: ImageMetadata = {
    // EXIF metadata (most widely supported)
    exif: {
      IFD0: {
        Artist: authorName,
        Copyright: copyrightNotice,
        ImageDescription: input.artworkTitle,
        // Software field for tools (EXIF standard)
        ...(toolsString && { Software: toolsString }),
      },
    },

    // IPTC metadata (standard for journalism/photography)
    iptc: {
      '2#80': authorName,           // Creator/By-line
      '2#116': license,              // Copyright Notice
      '2#110': input.artworkUrl,     // Credit/Source URL
      '2#105': input.artworkTitle,   // Headline
      // Add software/tools (IPTC 2#65)
      ...(toolsString && { '2#65': toolsString }),
      // Add subject/project (IPTC 2#25 Keywords)
      ...(input.projectName && { '2#25': input.projectName }),
    },
  }

  // XMP metadata (Dublin Core RDF - most comprehensive)
  metadata.xmp = generateDublinCoreXMP(input, copyrightNotice)

  return metadata
}

/**
 * Generate Dublin Core XMP metadata in RDF format
 * This format is recognized by Adobe products and many other tools
 *
 * Extended fields:
 * - xmp:CreateDate: Creation date (ISO 8601)
 * - xmp:CreatorTool: Software/tools used
 * - dc:subject: Project name / keywords
 * - illustboard:medium: Artwork medium (custom namespace)
 * - illustboard:isCommission: Commission flag
 * - illustboard:client: Client name
 */
function generateDublinCoreXMP(
  input: MetadataInput,
  copyrightNotice: string,
): string {
  const authorName = input.displayName || input.username
  const license = input.license || 'All Rights Reserved'

  // Format creation date as ISO 8601
  const creationDateStr = input.creationDate
    ? formatXmpDate(input.creationDate)
    : null

  // Format tools as XMP list
  const toolsList = input.toolsUsed?.length
    ? input.toolsUsed.map(t => `          <rdf:li>${escapeXml(t)}</rdf:li>`).join('\n')
    : null

  // Map medium enum to readable string
  const mediumLabel = input.medium ? getMediumLabel(input.medium) : null

  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
        xmlns:cc="http://creativecommons.org/ns#"
        xmlns:illustboard="https://github.com/barineco/illo/ns/1.0/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(input.artworkTitle)}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${escapeXml(authorName)}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:rights>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(copyrightNotice)}</rdf:li>
        </rdf:Alt>
      </dc:rights>
      <dc:source>${escapeXml(input.artworkUrl)}</dc:source>${input.projectName ? `
      <dc:subject>
        <rdf:Bag>
          <rdf:li>${escapeXml(input.projectName)}</rdf:li>
        </rdf:Bag>
      </dc:subject>` : ''}
      <xmpRights:UsageTerms>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${escapeXml(license)}</rdf:li>
        </rdf:Alt>
      </xmpRights:UsageTerms>
      <xmpRights:WebStatement>${escapeXml(input.artworkUrl)}</xmpRights:WebStatement>${creationDateStr ? `
      <xmp:CreateDate>${creationDateStr}</xmp:CreateDate>` : ''}${toolsList ? `
      <xmp:CreatorTool>
        <rdf:Bag>
${toolsList}
        </rdf:Bag>
      </xmp:CreatorTool>` : ''}${mediumLabel ? `
      <illustboard:medium>${escapeXml(mediumLabel)}</illustboard:medium>` : ''}${input.isCommission ? `
      <illustboard:isCommission>true</illustboard:isCommission>` : ''}${input.clientName ? `
      <illustboard:client>${escapeXml(input.clientName)}</illustboard:client>` : ''}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

/**
 * Format date for XMP (ISO 8601 format)
 */
function formatXmpDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString()
}

/**
 * Get human-readable medium label
 */
function getMediumLabel(medium: string): string {
  const labels: Record<string, string> = {
    'DIGITAL': 'Digital',
    'TRADITIONAL': 'Traditional',
    'THREE_D': '3D',
    'MIXED': 'Mixed Media',
  }
  return labels[medium] || medium
}

/**
 * Generate SVG metadata element
 * Used for embedding metadata in SVG files
 */
export function generateSVGMetadata(input: MetadataInput): string {
  const authorName = input.displayName || input.username
  const license = input.license || 'All Rights Reserved'
  const copyrightNotice = `© ${authorName}. ${license}`

  // Format creation date as ISO 8601
  const creationDateStr = input.creationDate
    ? formatXmpDate(input.creationDate)
    : null

  // Format tools as comma-separated
  const toolsString = input.toolsUsed?.join(', ')

  // Medium label
  const mediumLabel = input.medium ? getMediumLabel(input.medium) : null

  return `<metadata>
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
           xmlns:dc="http://purl.org/dc/elements/1.1/"
           xmlns:cc="http://creativecommons.org/ns#"
           xmlns:xmp="http://ns.adobe.com/xap/1.0/"
           xmlns:illustboard="https://github.com/barineco/illo/ns/1.0/">
    <rdf:Description>
      <dc:title>${escapeXml(input.artworkTitle)}</dc:title>
      <dc:creator>${escapeXml(authorName)}</dc:creator>
      <dc:rights>${escapeXml(copyrightNotice)}</dc:rights>
      <dc:source>${escapeXml(input.artworkUrl)}</dc:source>${input.projectName ? `
      <dc:subject>${escapeXml(input.projectName)}</dc:subject>` : ''}
      <cc:license>${escapeXml(license)}</cc:license>
      <cc:attributionURL>${escapeXml(input.artworkUrl)}</cc:attributionURL>${creationDateStr ? `
      <xmp:CreateDate>${creationDateStr}</xmp:CreateDate>` : ''}${toolsString ? `
      <xmp:CreatorTool>${escapeXml(toolsString)}</xmp:CreatorTool>` : ''}${mediumLabel ? `
      <illustboard:medium>${escapeXml(mediumLabel)}</illustboard:medium>` : ''}${input.isCommission ? `
      <illustboard:isCommission>true</illustboard:isCommission>` : ''}${input.clientName ? `
      <illustboard:client>${escapeXml(input.clientName)}</illustboard:client>` : ''}
    </rdf:Description>
  </rdf:RDF>
</metadata>`
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Detect image format from MIME type or buffer
 */
export function detectImageFormat(mimeType: string): string | null {
  const formats: Record<string, string> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }

  return formats[mimeType.toLowerCase()] || null
}

/**
 * Get file extension from format
 */
export function getExtensionFromFormat(format: string): string {
  const extensions: Record<string, string> = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    gif: 'gif',
    webp: 'webp',
    svg: 'svg',
  }

  return extensions[format.toLowerCase()] || 'jpg'
}

/**
 * Check if format supports metadata embedding via Sharp
 */
export function supportsSharpMetadata(format: string): boolean {
  return ['jpeg', 'png', 'webp'].includes(format.toLowerCase())
}
