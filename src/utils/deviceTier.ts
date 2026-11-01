export type Tier = 'high' | 'mid' | 'low'

export type TierSettings = {
  tier: Tier
  dpr: [number, number]
  shadows: boolean
  shadowMap: number
  reflector: boolean
  post: 'full' | 'bloom' | 'none'
  maxParticles: number
}

function gpuName(): string {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    return String(name || '').toLowerCase()
  } catch {
    return ''
  }
}

export function detectTier(): Tier {
  const forced = new URLSearchParams(location.search).get('tier')
  if (forced === 'high' || forced === 'mid' || forced === 'low') return forced

  const cores = navigator.hardwareConcurrency || 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const touch = matchMedia('(pointer: coarse)').matches
  const small = Math.min(innerWidth, innerHeight) < 600
  const gpu = gpuName()
  const weakGpu = /(mali-[gt]?[1-7]\d\b|adreno \(tm\) [1-5]\d\d|powervr|swiftshader|llvmpipe|intel\(r\) hd graphics [2-5]\d{2,3})/.test(gpu)

  if (!gpu || weakGpu || cores <= 2 || mem <= 2) return 'low'
  if (touch || small || cores <= 4) return 'mid'
  return 'high'
}

export function settingsFor(tier: Tier): TierSettings {
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
  switch (tier) {
    case 'high':
      return { tier, dpr: [1, Math.min(dpr, 2)], shadows: true, shadowMap: 1024, reflector: true, post: 'full', maxParticles: 260 }
    case 'mid':
      return { tier, dpr: [1, Math.min(dpr, 1.5)], shadows: true, shadowMap: 512, reflector: false, post: 'bloom', maxParticles: 140 }
    default:
      return { tier, dpr: [0.75, 1], shadows: false, shadowMap: 256, reflector: false, post: 'none', maxParticles: 60 }
  }
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
export const isTouch = () => matchMedia('(pointer: coarse)').matches
