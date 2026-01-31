/**
 * Composable for formatting usernames with ActivityPub domain
 */
export const useUsername = () => {
  /**
   * Formats a username with ActivityPub domain for display
   * @param username - The username
   * @param domain - The domain (null/undefined for local users)
   * @returns Formatted username (@username for local, @username@domain for remote)
   */
  const formatUsername = (username: string, domain?: string | null): string => {
    if (!domain) {
      return `@${username}`
    }
    return `@${username}@${domain}`
  }

  /**
   * Formats a user object with username and domain
   * @param user - User object with username and domain fields
   * @returns Formatted username string
   */
  const formatUserHandle = (user: { username: string; domain?: string | null }): string => {
    return formatUsername(user.username, user.domain)
  }

  /**
   * Gets the URL path for a user's profile page
   * @param username - The username
   * @param domain - The domain (null/undefined/empty string for local users)
   * @returns URL path (/users/username for local, /users/username@domain for remote)
   */
  const getUserPath = (username: string, domain?: string | null): string => {
    if (!domain) {
      return `/users/${username}`
    }
    return `/users/${username}@${domain}`
  }

  /**
   * Gets the URL path for a user's profile page from a user object
   * @param user - User object with username and domain fields
   * @returns URL path
   */
  const getUserPathFromUser = (user: { username: string; domain?: string | null }): string => {
    return getUserPath(user.username, user.domain)
  }

  return {
    formatUsername,
    formatUserHandle,
    getUserPath,
    getUserPathFromUser,
  }
}
