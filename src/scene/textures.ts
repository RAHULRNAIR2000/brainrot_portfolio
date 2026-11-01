import * as THREE from 'three'

// Every texture in the scene is painted at runtime on a canvas. Nothing to download.

function canvas(size: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return [c, c.getContext('2d')!] as const
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function heightToNormal(src: ImageData, strength: number) {
  const { width: w, height: h, data } = src
  const out = new ImageData(w, h)
  const H = (x: number, y: number) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      out.data[i + 3] = 255
    }
  }
  return out
}

function toTexture(c: HTMLCanvasElement, srgb: boolean, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.repeat.set(...repeat)
  return t
}

let cobbleCache: { map: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } | null = null

export function cobbleTextures(size = 1024) {
  if (cobbleCache) return cobbleCache
  const rnd = seeded(7)
  const [, hx] = canvas(size)
  const [cc, cx] = canvas(size)
  const [rc, rx] = canvas(size)

  hx.fillStyle = '#000'
  hx.fillRect(0, 0, size, size)
  cx.fillStyle = '#0d0f14'
  cx.fillRect(0, 0, size, size)
  rx.fillStyle = '#e6e6e6'
  rx.fillRect(0, 0, size, size)

  const rows = 12
  const rowH = size / rows
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 0.5
    const cols = 7
    const colW = size / cols
    for (let c = 0; c < cols; c++) {
      const w = colW * (0.84 + rnd() * 0.1)
      const hgt = rowH * (0.8 + rnd() * 0.12)
      const x = (c + off) * colW + (colW - w) / 2 + (rnd() - 0.5) * 6
      const y = r * rowH + (rowH - hgt) / 2 + (rnd() - 0.5) * 4
      const shade = 0.45 + rnd() * 0.35
      const tint = rnd()
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = x + ox
          const py = y + oy
          const rad = Math.min(w, hgt) * 0.35
          // height: domed stone
          const g = hx.createRadialGradient(px + w / 2, py + hgt / 2, 2, px + w / 2, py + hgt / 2, Math.max(w, hgt) * 0.62)
          g.addColorStop(0, `rgb(${255 * shade},0,0)`)
          g.addColorStop(0.7, `rgb(${200 * shade},0,0)`)
          g.addColorStop(1, 'rgb(30,0,0)')
          hx.fillStyle = g
          hx.beginPath()
          hx.roundRect(px, py, w, hgt, rad)
          hx.fill()
          // colour: cool basalt with a few warm stones
          const base = 38 + shade * 40
          const col =
            tint > 0.82
              ? `rgb(${base + 22},${base + 10},${base - 2})`
              : `rgb(${base - 6},${base},${base + 10})`
          cx.fillStyle = col
          cx.beginPath()
          cx.roundRect(px, py, w, hgt, rad)
          cx.fill()
          // roughness: stones polished by feet
          rx.fillStyle = `rgb(${110 + rnd() * 60},0,0)`
          rx.beginPath()
          rx.roundRect(px + 2, py + 2, w - 4, hgt - 4, rad)
          rx.fill()
        }
      }
    }
  }
  // grit on colour
  const img = cx.getImageData(0, 0, size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 16
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  cx.putImageData(img, 0, 0)

  // puddles: smooth blobs in the roughness map
  for (let i = 0; i < 9; i++) {
    const px = rnd() * size
    const py = rnd() * size
    const r = 60 + rnd() * 150
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) {
        const g = rx.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r)
        g.addColorStop(0, 'rgba(10,0,0,0.95)')
        g.addColorStop(0.6, 'rgba(25,0,0,0.6)')
        g.addColorStop(1, 'rgba(25,0,0,0)')
        rx.fillStyle = g
        rx.fillRect(px + ox - r, py + oy - r, r * 2, r * 2)
      }
  }
  // copy red channel into green (three reads roughness from G)
  const rough = rx.getImageData(0, 0, size, size)
  for (let i = 0; i < rough.data.length; i += 4) {
    rough.data[i + 1] = rough.data[i]
    rough.data[i + 2] = rough.data[i]
  }
  rx.putImageData(rough, 0, 0)

  const [nc, nx] = canvas(size)
  nx.putImageData(heightToNormal(hx.getImageData(0, 0, size, size), 6), 0, 0)

  cobbleCache = { map: toTexture(cc, true), normal: toTexture(nc, false), rough: toTexture(rc, false) }
  return cobbleCache
}

const plasterCache = new Map<number, THREE.Texture>()
export function plasterTexture(seed = 1) {
  const hit = plasterCache.get(seed)
  if (hit) return hit
  const size = 512
  const rnd = seeded(seed * 97)
  const [c, x] = canvas(size)
  x.fillStyle = '#bdb6aa'
  x.fillRect(0, 0, size, size)
  for (let i = 0; i < 1400; i++) {
    const r = 2 + rnd() * 28
    x.fillStyle = `rgba(${rnd() > 0.5 ? '255,250,240' : '40,35,30'},${0.02 + rnd() * 0.04})`
    x.beginPath()
    x.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2)
    x.fill()
  }
  // damp streaks from the top
  for (let i = 0; i < 26; i++) {
    const sx = rnd() * size
    const g = x.createLinearGradient(sx, 0, sx, size * (0.3 + rnd() * 0.6))
    g.addColorStop(0, 'rgba(30,30,35,0.18)')
    g.addColorStop(1, 'rgba(30,30,35,0)')
    x.fillStyle = g
    x.fillRect(sx, 0, 4 + rnd() * 14, size)
  }
  const t = toTexture(c, true)
  plasterCache.set(seed, t)
  return t
}

let stripeCache: THREE.Texture | null = null
export function awningTexture() {
  if (stripeCache) return stripeCache
  const [c, x] = canvas(256)
  const n = 8
  for (let i = 0; i < n; i++) {
    x.fillStyle = i % 2 ? '#efe2c6' : '#9e1b2a'
    x.fillRect((i * 256) / n, 0, 256 / n, 256)
  }
  // fabric weave
  for (let y = 0; y < 256; y += 2) {
    x.fillStyle = 'rgba(0,0,0,0.05)'
    x.fillRect(0, y, 256, 1)
  }
  stripeCache = toTexture(c, true)
  return stripeCache
}

let woodCache: THREE.Texture | null = null
export function woodTexture() {
  if (woodCache) return woodCache
  const rnd = seeded(3)
  const [c, x] = canvas(512)
  x.fillStyle = '#5a3420'
  x.fillRect(0, 0, 512, 512)
  const planks = 6
  for (let p = 0; p < planks; p++) {
    const y0 = (p * 512) / planks
    x.fillStyle = `rgb(${80 + rnd() * 30},${46 + rnd() * 16},${26 + rnd() * 10})`
    x.fillRect(0, y0 + 2, 512, 512 / planks - 4)
    for (let i = 0; i < 40; i++) {
      x.strokeStyle = `rgba(${rnd() > 0.5 ? '30,15,8' : '150,95,55'},${0.15 + rnd() * 0.2})`
      x.lineWidth = 0.5 + rnd() * 1.5
      x.beginPath()
      const yy = y0 + rnd() * (512 / planks)
      x.moveTo(0, yy)
      for (let xx = 0; xx <= 512; xx += 32) x.lineTo(xx, yy + Math.sin(xx * 0.02 + i) * 3)
      x.stroke()
    }
    x.fillStyle = 'rgba(10,5,2,0.8)'
    x.fillRect(0, y0, 512, 2)
  }
  woodCache = toTexture(c, true)
  return woodCache
}

let shutterCache: THREE.Texture | null = null
export function shutterTexture() {
  if (shutterCache) return shutterCache
  const [c, x] = canvas(256)
  for (let y = 0; y < 256; y += 8) {
    const g = x.createLinearGradient(0, y, 0, y + 8)
    g.addColorStop(0, '#5a6470')
    g.addColorStop(0.5, '#8a96a3')
    g.addColorStop(1, '#3a424c')
    x.fillStyle = g
    x.fillRect(0, y, 256, 8)
  }
  // graffiti-ish tag
  x.strokeStyle = 'rgba(61,242,255,0.55)'
  x.lineWidth = 5
  x.beginPath()
  x.moveTo(40, 170)
  x.bezierCurveTo(70, 120, 110, 200, 140, 150)
  x.bezierCurveTo(160, 120, 190, 180, 215, 140)
  x.stroke()
  shutterCache = toTexture(c, true)
  return shutterCache
}

// Poly Haven (CC0) PBR sets, 1k. Shared images, per-use clones so each surface can set its own tiling.
const PH_IDS = ['cobblestone_floor_08', 'clay_plaster', 'blue_plaster_weathered', 'fine_grained_wood', 'painted_metal_shutter'] as const
export type PHId = (typeof PH_IDS)[number]
export const phUrls = (id: PHId) => ({
  map: `/textures/${id}/diff.jpg`,
  normalMap: `/textures/${id}/nor.jpg`,
  roughnessMap: `/textures/${id}/rough.jpg`,
})
export const ALL_PH_URLS = PH_IDS.flatMap((id) => Object.values(phUrls(id)))

export type PBRSet = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }

export function tiled(set: PBRSet, rx: number, ry: number): PBRSet {
  const one = (t: THREE.Texture, srgb: boolean) => {
    const c = t.clone()
    c.wrapS = c.wrapT = THREE.RepeatWrapping
    c.repeat.set(rx, ry)
    c.anisotropy = 8
    c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    c.needsUpdate = true
    return c
  }
  return { map: one(set.map, true), normalMap: one(set.normalMap, false), roughnessMap: one(set.roughnessMap, false) }
}
