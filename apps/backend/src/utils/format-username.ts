/**
 * Formats a username with ActivityPub domain for display
 * @param username - The username
 * @param domain - The domain (null for local users)
 * @returns Formatted username (@username for local, @username@domain for remote)
 */
export function formatUsername(username: string, domain: string | null): string {
  if (domain === null || domain === undefined) {
    return `@${username}`
  }
  return `@${username}@${domain}`
}

/**
 * Formats a user object with username and domain
 * @param user - User object with username and domain fields
 * @returns Formatted username string
 */
export function formatUserHandle(user: { username: string; domain?: string | null }): string {
  return formatUsername(user.username, user.domain ?? null)
}
