export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig()
  const isProduction = process.env.NODE_ENV === 'production'

  if (to.path === '/backend-error') {
    return
  }

  try {
    // SSR時はサーバー用APIベースURL（Docker内部URL）を使用
    // クライアント時はpublic.apiBase（nginxプロキシ経由）を使用
    // Note: Server-side環境変数はprocess.envから直接読む（Nuxtのビルド時に固定されないように）
    let apiBase = ''
    if (import.meta.server) {
      apiBase = process.env.API_BASE_SERVER || config.apiBaseServer || config.public.apiBase || ''
    } else {
      apiBase = config.public.apiBase || ''
    }
    const response = await $fetch<{
      isSetupComplete: boolean
      instanceInfo: any
    }>(`${apiBase}/api/setup/status`, {
      retry: isProduction ? 0 : 2, // 本番環境ではリトライなし（遅延を避ける）
      retryDelay: 1000,
    })

    if (to.path === '/setup') {
      if (response.isSetupComplete) {
        return navigateTo('/')
      }
      return
    }

    if (!response.isSetupComplete) {
      return navigateTo('/setup')
    }
  } catch (error: any) {
    if (to.path === '/setup') {
      return
    }

    // 本番環境ではエラーをスルー（ページは通常通り表示、APIコール失敗時に個別エラー）
    if (isProduction) {
      console.warn('Setup status check failed, continuing anyway:', error.message)
      return
    }

    console.error('Failed to check setup status:', error)

    if (
      error.name === 'FetchError' ||
      error.message?.includes('fetch failed') ||
      error.cause?.code === 'ECONNREFUSED'
    ) {
      return navigateTo('/backend-error')
    }

    if (error.statusCode) {
      console.error(`Setup status check returned HTTP ${error.statusCode}`)
      return navigateTo('/backend-error')
    }

    console.error('Unknown error during setup check, details:', {
      name: error.name,
      message: error.message,
      cause: error.cause,
    })
    return navigateTo('/backend-error')
  }
})
