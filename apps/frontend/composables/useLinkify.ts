import DOMPurify from 'dompurify'

const URL_REGEX = /https?:\/\/[^\s<]+/g
const MENTION_REGEX = /@([a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9.-]+)?)/g

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function useLinkify() {
  const linkify = (text: string): string => {
    if (!text) return ''

    const escaped = escapeHtml(text)

    const linked = escaped
      .replace(URL_REGEX, (url) => {
        const clean = url.replace(/[.,;:!?)]+$/, '')
        const trailing = url.slice(clean.length)
        return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${trailing}`
      })
      .replace(MENTION_REGEX, (match, handle) => {
        if (match.startsWith('&')) return match
        if (handle.includes('@')) {
          const [user, domain] = handle.split('@')
          return `<a href="https://${domain}/@${user}" target="_blank" rel="noopener noreferrer">${match}</a>`
        }
        return `<a href="/users/${handle}">${match}</a>`
      })

    return DOMPurify.sanitize(linked, {
      ALLOWED_TAGS: ['a'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    })
  }

  return { linkify }
}
