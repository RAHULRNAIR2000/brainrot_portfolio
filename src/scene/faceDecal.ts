import * as THREE from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'

// Cartoon faces painted on a canvas and projected onto a head as a decal. Expressions are just redraws.

export type Expression = {
  eyes: 'open' | 'happy' | 'wide' | 'sly' | 'closed'
  mouth: 'smile' | 'grin' | 'laugh' | 'o' | 'smirk' | 'talk'
  brows: number // raise, -1..1
  browTilt: number // + angry/sly, - worried/happy
  look: THREE.Vector2 // pupil offset, -1..1
  talkOpen: number // 0..1 while talking
}

const SIZE = 512

export function makeFaceCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { canvas, ctx: canvas.getContext('2d')!, tex }
}

// Project `canvas` onto `mesh` (any Mesh whose matrixWorld places it where you want the decal computed).
export function buildDecal(mesh: THREE.Mesh, center: THREE.Vector3, orient: number | THREE.Euler, size: THREE.Vector3, tex: THREE.Texture) {
  const geo = new DecalGeometry(mesh, center, typeof orient === 'number' ? new THREE.Euler(0, orient, 0) : orient, size)
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  })
  const decal = new THREE.Mesh(geo, mat)
  decal.renderOrder = 2
  return decal
}

// ---------- Mehmet Usta ----------
// Layout in canvas units (0..1). Eyes sit high, the mouth sits under the 3D mustache.
export type ManLayout = { eyeY: number; eyeX: number; eyeR: number; mouthY: number; cheekY: number }

export function drawMan(ctx: CanvasRenderingContext2D, e: Expression, L: ManLayout, blink: number) {
  const W = SIZE
  ctx.clearRect(0, 0, W, W)
  const ink = '#2a1712'
  const ex = L.eyeX * W, ey = L.eyeY * W, er = L.eyeR * W

  // rosy cheeks
  for (const sx of [-1, 1]) {
    const g = ctx.createRadialGradient(W / 2 + sx * ex * 1.15, L.cheekY * W, 0, W / 2 + sx * ex * 1.15, L.cheekY * W, er * 1.3)
    g.addColorStop(0, 'rgba(225,95,90,0.45)')
    g.addColorStop(1, 'rgba(225,95,90,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, W)
  }

  const closed = e.eyes === 'closed' || blink > 0.5
  for (const sx of [-1, 1]) {
    const cx = W / 2 + sx * ex
    if (e.eyes === 'happy' || closed) {
      // ^ ^ happy arcs (or a closed blink line)
      ctx.strokeStyle = ink
      ctx.lineWidth = er * 0.32
      ctx.lineCap = 'round'
      ctx.beginPath()
      if (closed && e.eyes !== 'happy') ctx.arc(cx, ey - er * 0.2, er * 0.85, 0.15 * Math.PI, 0.85 * Math.PI)
      else ctx.arc(cx, ey + er * 0.35, er * 0.85, 1.15 * Math.PI, 1.85 * Math.PI)
      ctx.stroke()
      continue
    }
    const scale = e.eyes === 'wide' ? 1.15 : 1
    // white
    ctx.fillStyle = '#fbf7f0'
    ctx.beginPath()
    ctx.ellipse(cx, ey, er * 0.82 * scale, er * scale, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(42,23,18,0.55)'
    ctx.lineWidth = er * 0.08
    ctx.stroke()
    // iris + pupil, looking around
    const ir = er * (e.eyes === 'wide' ? 0.42 : 0.52)
    const px = cx + e.look.x * er * 0.3
    const py = ey - e.look.y * er * 0.3 + er * 0.08
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx, ey, er * 0.82 * scale, er * scale, 0, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = '#6b3b1d'
    ctx.beginPath()
    ctx.arc(px, py, ir, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#140904'
    ctx.beginPath()
    ctx.arc(px, py, ir * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(px + ir * 0.35, py - ir * 0.38, ir * 0.28, 0, Math.PI * 2)
    ctx.fill()
    // sly half-lidded look
    if (e.eyes === 'sly') {
      ctx.fillStyle = '#c98d68'
      ctx.fillRect(cx - er * 1.2, ey - er * 1.3, er * 2.4, er * 1.05)
      ctx.strokeStyle = ink
      ctx.lineWidth = er * 0.16
      ctx.beginPath()
      ctx.moveTo(cx - er * 0.85, ey - er * 0.25)
      ctx.lineTo(cx + er * 0.85, ey - er * 0.25)
      ctx.stroke()
    }
    ctx.restore()
  }

  // brows
  ctx.fillStyle = '#231a16'
  for (const sx of [-1, 1]) {
    const cx = W / 2 + sx * ex
    const by = ey - er * (1.45 + e.brows * 0.45)
    ctx.save()
    ctx.translate(cx, by)
    ctx.rotate(sx * e.browTilt * 0.35)
    ctx.beginPath()
    ctx.ellipse(0, 0, er * 1.05, er * 0.26, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // mouth (under the mustache)
  const mx = W / 2, my = L.mouthY * W, mw = er * 1.6
  ctx.lineCap = 'round'
  const open = e.mouth === 'talk' ? e.talkOpen : 0
  if (e.mouth === 'laugh' || e.mouth === 'grin' || open > 0.15) {
    const h = e.mouth === 'laugh' ? er * 1.3 : e.mouth === 'grin' ? er * 0.8 : er * (0.3 + open * 0.8)
    ctx.fillStyle = '#4a1414'
    ctx.beginPath()
    ctx.moveTo(mx - mw, my)
    ctx.quadraticCurveTo(mx, my + h * 1.6, mx + mw, my)
    ctx.quadraticCurveTo(mx, my + h * 0.2, mx - mw, my)
    ctx.fill()
    if (e.mouth !== 'talk') {
      ctx.fillStyle = '#f6f0e6' // teeth
      ctx.beginPath()
      ctx.moveTo(mx - mw * 0.8, my + h * 0.1)
      ctx.quadraticCurveTo(mx, my + h * 0.45, mx + mw * 0.8, my + h * 0.1)
      ctx.quadraticCurveTo(mx, my + h * 0.2, mx - mw * 0.8, my + h * 0.1)
      ctx.fill()
      ctx.fillStyle = '#d0605e' // tongue
      ctx.beginPath()
      ctx.ellipse(mx, my + h * 0.95, mw * 0.4, h * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (e.mouth === 'o') {
    ctx.fillStyle = '#4a1414'
    ctx.beginPath()
    ctx.ellipse(mx, my + er * 0.4, er * 0.45, er * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.strokeStyle = '#5a2018'
    ctx.lineWidth = er * 0.22
    ctx.beginPath()
    if (e.mouth === 'smirk') {
      ctx.moveTo(mx - mw * 0.8, my + er * 0.15)
      ctx.quadraticCurveTo(mx + mw * 0.1, my + er * 0.35, mx + mw * 0.85, my - er * 0.25)
    } else {
      ctx.moveTo(mx - mw, my)
      ctx.quadraticCurveTo(mx, my + er * 0.75, mx + mw, my)
    }
    ctx.stroke()
  }
}

// ---------- Pamuk the cat ----------
export function drawCat(ctx: CanvasRenderingContext2D, blink: number, look: THREE.Vector2) {
  const W = SIZE
  ctx.clearRect(0, 0, W, W)
  const ex = W * 0.2, ey = W * 0.4, er = W * 0.11
  for (const sx of [-1, 1]) {
    const cx = W / 2 + sx * ex
    if (blink > 0.5) {
      ctx.strokeStyle = '#1b120c'
      ctx.lineWidth = er * 0.25
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(cx, ey - er * 0.3, er * 0.9, 0.2 * Math.PI, 0.8 * Math.PI)
      ctx.stroke()
      continue
    }
    // almond eye, tilted up at the outer corner
    ctx.save()
    ctx.translate(cx, ey)
    ctx.rotate(sx * -0.18)
    ctx.beginPath()
    ctx.ellipse(0, 0, er * 1.05, er * 0.85, 0, 0, Math.PI * 2)
    const g = ctx.createRadialGradient(0, er * 0.2, 0, 0, 0, er)
    g.addColorStop(0, '#f6d35a')
    g.addColorStop(1, '#c8861c')
    ctx.fillStyle = g
    ctx.fill()
    ctx.lineWidth = er * 0.14
    ctx.strokeStyle = '#1b120c'
    ctx.stroke()
    ctx.clip()
    ctx.fillStyle = '#0d0805'
    ctx.beginPath()
    ctx.ellipse(look.x * er * 0.3, -look.y * er * 0.2, er * 0.22, er * 0.75, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.beginPath()
    ctx.arc(er * 0.32, -er * 0.35, er * 0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  // nose + mouth "ω"
  const nx = W / 2, ny = W * 0.6
  ctx.fillStyle = '#e48f9b'
  ctx.beginPath()
  ctx.moveTo(nx - W * 0.045, ny - W * 0.025)
  ctx.lineTo(nx + W * 0.045, ny - W * 0.025)
  ctx.lineTo(nx, ny + W * 0.03)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#2a1a14'
  ctx.lineWidth = W * 0.012
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(nx, ny + W * 0.03)
  ctx.lineTo(nx, ny + W * 0.06)
  ctx.arc(nx - W * 0.04, ny + W * 0.06, W * 0.04, 0, Math.PI * 0.85)
  ctx.moveTo(nx, ny + W * 0.06)
  ctx.arc(nx + W * 0.04, ny + W * 0.06, W * 0.04, Math.PI, Math.PI * 0.15, true)
  ctx.stroke()
  // whiskers
  ctx.strokeStyle = 'rgba(245,240,230,0.85)'
  ctx.lineWidth = W * 0.006
  for (const sx of [-1, 1])
    for (const k of [-1, 0, 1]) {
      ctx.beginPath()
      ctx.moveTo(nx + sx * W * 0.09, ny + W * 0.04 + k * W * 0.02)
      ctx.lineTo(nx + sx * W * 0.42, ny + W * 0.02 + k * W * 0.06)
      ctx.stroke()
    }
}
