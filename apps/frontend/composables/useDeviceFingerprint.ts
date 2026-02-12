const STORAGE_KEY = 'device_fingerprint'

interface DeviceFingerprint {
  canvas: string
  webglRenderer: string
  webglVendor: string
  webdriver: boolean
  pluginsCount: number
  languages: string[]
  platform: string
  hardwareConcurrency: number
  maxTouchPoints: number
}

let cachedFingerprint: string | null = null
let fingerprintPromise: Promise<string> | null = null

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('fingerprint', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('fingerprint', 4, 17)

    return canvas.toDataURL()
  } catch {
    return ''
  }
}

function getWebGLInfo(): { renderer: string; vendor: string } {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl || !(gl instanceof WebGLRenderingContext)) return { renderer: '', vendor: '' }

    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (!ext) return { renderer: '', vendor: '' }

    return {
      renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '',
      vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || '',
    }
  } catch {
    return { renderer: '', vendor: '' }
  }
}

async function collectFingerprint(): Promise<string> {
  const canvasData = getCanvasFingerprint()
  const canvasHash = canvasData ? await sha256(canvasData) : ''
  const webgl = getWebGLInfo()

  const fp: DeviceFingerprint = {
    canvas: canvasHash,
    webglRenderer: webgl.renderer,
    webglVendor: webgl.vendor,
    webdriver: !!(navigator as any).webdriver,
    pluginsCount: navigator.plugins?.length ?? 0,
    languages: Array.from(navigator.languages || []),
    platform: navigator.platform || '',
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
  }

  return btoa(JSON.stringify(fp))
}

async function getOrCreateFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint

  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (stored) {
    cachedFingerprint = stored
    return stored
  }

  if (!fingerprintPromise) {
    fingerprintPromise = collectFingerprint().then(fp => {
      cachedFingerprint = fp
      sessionStorage.setItem(STORAGE_KEY, fp)
      fingerprintPromise = null
      return fp
    })
  }

  return fingerprintPromise
}

if (import.meta.client) {
  getOrCreateFingerprint()
}

export function useDeviceFingerprint() {
  function getFingerprint(): string | null {
    if (!import.meta.client) return null
    return cachedFingerprint || sessionStorage.getItem(STORAGE_KEY)
  }

  return { getFingerprint }
}
