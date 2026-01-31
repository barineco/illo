// Type declarations for Markdown imports via vite-plugin-md-to-html
// Usage: import html, { attributes } from './file.md'

declare module '*.md' {
  const html: string
  export const attributes: Record<string, unknown>
  export default html
}
