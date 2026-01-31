/**
 * Search composable for managing search state and functionality
 */
export const useSearch = () => {
  const router = useRouter()
  const route = useRoute()

  /**
   * Navigate to search page with query parameters
   */
  const search = (query: string, filters?: {
    type?: 'ILLUSTRATION' | 'MANGA'
    tags?: string[]
    sort?: 'latest' | 'popular' | 'views'
  }) => {
    const searchParams: any = { q: query }

    if (filters?.type) {
      searchParams.type = filters.type
    }

    if (filters?.tags && filters.tags.length > 0) {
      searchParams.tags = filters.tags.join(',')
    }

    if (filters?.sort) {
      searchParams.sort = filters.sort
    }

    router.push({
      path: '/search',
      query: searchParams,
    })
  }

  /**
   * Get current search query from route
   */
  const getCurrentQuery = () => {
    return route.query.q as string || ''
  }

  /**
   * Get current filters from route
   */
  const getCurrentFilters = () => {
    const filters: any = {}

    if (route.query.type) {
      filters.type = route.query.type
    }

    if (route.query.tags) {
      const tagsParam = route.query.tags as string
      filters.tags = tagsParam.split(',')
    }

    if (route.query.sort) {
      filters.sort = route.query.sort
    }

    return filters
  }

  return {
    search,
    getCurrentQuery,
    getCurrentFilters,
  }
}
