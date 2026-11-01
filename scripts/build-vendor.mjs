// Turns the raw vendor STL + the ChatGPT reference images into web assets:
//   public/models/vendor/mesh.bin  simplified mesh, normalised (height 1, feet at 0, facing +z)
//   public/models/vendor/rig.json  joint positions + how each image maps onto the mesh
//   assets-src/_tmp/*.png          bled reference images (converted to jpg by build-vendor.ps1)
// Run: node scripts/build-vendor.mjs
import fs from 'node:fs'
import { MeshoptSimplifier } from 'meshoptimizer'
import { PNG } from 'pngjs'

const SRC = process.argv[2] ?? 'assets-src/vendor.stl'
const IMAGES = { front: 'assets-src/vendor-front.png', side: 'assets-src/vendor-side.png' }
const OUT = 'public/models/vendor'
const TARGET_TRIS = 60000

// ---------- mesh ----------
const stl = fs.readFileSync(SRC)
const triCount = stl.readUInt32LE(80)
const raw = new Float32Array(triCount * 9)
for (let i = 0; i < triCount; i++) for (let k = 0; k < 9; k++) raw[i * 9 + k] = stl.readFloatLE(84 + i * 50 + 12 + k * 4)

// weld identical corners
const map = new Map()
const pos = []
const idx = new Uint32Array(triCount * 3)
for (let v = 0; v < triCount * 3; v++) {
  const x = raw[v * 3], y = raw[v * 3 + 1], z = raw[v * 3 + 2]
  const key = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`
  let i = map.get(key)
  if (i === undefined) {
    i = pos.length / 3
    map.set(key, i)
    pos.push(x, y, z)
  }
  idx[v] = i
}
let P = new Float32Array(pos)
console.log(`welded ${triCount} tris, ${P.length / 3} verts`)

await MeshoptSimplifier.ready
const [simple, err] = MeshoptSimplifier.simplify(idx, P, 3, TARGET_TRIS * 3, 0.002, [])
console.log(`simplified to ${simple.length / 3} tris (error ${err.toFixed(4)})`)

// drop unused verts
const remap = new Int32Array(P.length / 3).fill(-1)
const keep = []
const I = new Uint32Array(simple.length)
for (let k = 0; k < simple.length; k++) {
  const o = simple[k]
  if (remap[o] < 0) {
    remap[o] = keep.length / 3
    keep.push(P[o * 3], P[o * 3 + 1], P[o * 3 + 2])
  }
  I[k] = remap[o]
}
P = new Float32Array(keep)
const N = P.length / 3

// normalise: feet at 0, height 1
let y0 = Infinity, y1 = -Infinity
for (let i = 0; i < N; i++) (y0 = Math.min(y0, P[i * 3 + 1])), (y1 = Math.max(y1, P[i * 3 + 1]))
const H = y1 - y0
for (let i = 0; i < N; i++) for (let a = 0; a < 3; a++) P[i * 3 + a] = a === 1 ? (P[i * 3 + 1] - y0) / H : P[i * 3 + a] / H

const band = (a, b, f = () => true) => {
  const out = []
  for (let i = 0; i < N; i++) {
    const y = P[i * 3 + 1]
    if (y >= a && y < b && f(P[i * 3], y, P[i * 3 + 2])) out.push([P[i * 3], y, P[i * 3 + 2]])
  }
  return out
}
const mean = (pts, a) => pts.reduce((s, p) => s + p[a], 0) / Math.max(pts.length, 1)

// centre the torso on x = 0, z = 0
const torso = band(0.55, 0.75, (x) => Math.abs(x) < 0.12)
const cx = mean(torso, 0)
const cz = mean(torso, 2)
for (let i = 0; i < N; i++) (P[i * 3] -= cx), (P[i * 3 + 2] -= cz)

const bounds = { min: [Infinity, 0, Infinity], max: [-Infinity, 1, -Infinity] }
for (let i = 0; i < N; i++)
  for (const a of [0, 2]) (bounds.min[a] = Math.min(bounds.min[a], P[i * 3 + a])), (bounds.max[a] = Math.max(bounds.max[a], P[i * 3 + a]))

// ---------- joints (A-pose, facing +z) ----------
const spineAt = (y) => [0, y, mean(band(y - 0.015, y + 0.015, (x) => Math.abs(x) < 0.08), 2)]
const joints = {
  hips: spineAt(0.5),
  spine: spineAt(0.6),
  chest: spineAt(0.68),
  neck: spineAt(0.775),
  head: spineAt(0.84),
  headTop: [0, 1, 0],
}

function armChain(side) {
  // hand tip = extreme vertex on this side
  let tip = null
  for (let i = 0; i < N; i++) {
    const x = P[i * 3] * side
    if (!tip || x > tip[0] * side) tip = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]
  }
  // shoulder: just inside the outer edge of the torso at shoulder height
  const sh = band(0.72, 0.75, (x) => x * side > 0 && Math.abs(x) < 0.2)
  const edge = Math.max(...sh.map((p) => Math.abs(p[0])))
  const shoulder = [side * edge * 0.72, 0.735, mean(sh, 2)]
  // refine points along the arm to the centroid of nearby vertices
  const at = (t) => {
    const p = shoulder.map((s, a) => s + (tip[a] - s) * t)
    const d = tip.map((v, a) => v - shoulder[a])
    const len = Math.hypot(...d)
    const dir = d.map((v) => v / len)
    const near = []
    for (let i = 0; i < N; i++) {
      const v = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]
      const r = v.map((c, a) => c - p[a])
      const along = r[0] * dir[0] + r[1] * dir[1] + r[2] * dir[2]
      if (Math.abs(along) > 0.008) continue
      const perp = Math.hypot(r[0] - along * dir[0], r[1] - along * dir[1], r[2] - along * dir[2])
      if (perp < 0.05) near.push(v)
    }
    return near.length > 6 ? [mean(near, 0), mean(near, 1), mean(near, 2)] : p
  }
  return { shoulder, elbow: at(0.43), wrist: at(0.8), tip }
}
joints.L = armChain(1)
joints.R = armChain(-1)
// the generated mesh is a little lopsided; keep the shoulders symmetric
const shX = (joints.L.shoulder[0] - joints.R.shoulder[0]) / 2
joints.L.shoulder[0] = shX
joints.R.shoulder[0] = -shX

// ---------- reference images ----------
function loadPng(file) {
  const png = PNG.sync.read(fs.readFileSync(file))
  return png
}
function silhouette(png) {
  const { width: w, height: h, data } = png
  const px = (x, y) => (y * w + x) * 4
  // background = average of the four corners
  const corners = [px(2, 2), px(w - 3, 2), px(2, h - 3), px(w - 3, h - 3)]
  const bg = [0, 1, 2].map((c) => corners.reduce((s, o) => s + data[o + c], 0) / 4)
  // background = everything connected to the image border that stays close to the corner colour
  const isBg = new Uint8Array(w * h)
  const near = (o) => Math.abs(data[o] - bg[0]) + Math.abs(data[o + 1] - bg[1]) + Math.abs(data[o + 2] - bg[2]) < 22
  const stack = []
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
  while (stack.length) {
    const s = stack.pop()
    if (isBg[s] || !near(s * 4)) continue
    isBg[s] = 1
    const x = s % w, y = (s / w) | 0
    if (x > 0) stack.push(s - 1)
    if (x < w - 1) stack.push(s + 1)
    if (y > 0) stack.push(s - w)
    if (y < h - 1) stack.push(s + w)
  }
  const fg = new Uint8Array(w * h)
  for (let s = 0; s < w * h; s++) fg[s] = isBg[s] ? 0 : 1
  // keep the biggest blob only (drops floor shadow specks)
  const label = new Int32Array(w * h).fill(-1)
  let best = -1, bestSize = 0
  for (let s = 0, id = 0; s < w * h; s++) {
    if (!fg[s] || label[s] >= 0) continue
    const stack = [s]
    label[s] = id
    let size = 0
    while (stack.length) {
      const q = stack.pop()
      size++
      const x = q % w, y = (q / w) | 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const n = ny * w + nx
        if (fg[n] && label[n] < 0) (label[n] = id), stack.push(n)
      }
    }
    if (size > bestSize) (bestSize = size), (best = id)
    id++
  }
  for (let s = 0; s < w * h; s++) fg[s] = label[s] === best ? 1 : 0
  // per-row extents
  const rows = []
  let top = h, bottom = 0
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1
    for (let x = 0; x < w; x++) if (fg[y * w + x]) (l < 0 && (l = x)), (r = x)
    rows.push(l < 0 ? null : [l, r])
    if (l >= 0) (top = Math.min(top, y)), (bottom = Math.max(bottom, y))
  }
  return { fg, rows, top, bottom, w, h }
}

// Grow colours outward from the silhouette so edge samples never pick up grey background.
function bleed(png, fg, passes = 24) {
  const { width: w, height: h, data } = png
  let mask = fg.slice()
  for (let p = 0; p < passes; p++) {
    const next = mask.slice()
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const s = y * w + x
        if (mask[s]) continue
        let r = 0, g = 0, b = 0, n = 0
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (!mask[q]) continue
          r += data[q * 4]
          g += data[q * 4 + 1]
          b += data[q * 4 + 2]
          n++
        }
        if (n) {
          data[s * 4] = r / n
          data[s * 4 + 1] = g / n
          data[s * 4 + 2] = b / n
          next[s] = 1
        }
      }
    mask = next
  }
}

// Fit image column = a * meshCoord + b from matching silhouette extents in many height bands.
function fitColumns(sil, axis, flip) {
  const xs = [], us = []
  for (let k = 0; k < 40; k++) {
    const a = 0.04 + k * 0.023, b = a + 0.023
    const pts = band(a, b)
    if (pts.length < 10) continue
    const lo = Math.min(...pts.map((p) => p[axis]))
    const hi = Math.max(...pts.map((p) => p[axis]))
    // matching image rows (y=1 is the top row of the silhouette)
    const r0 = Math.round(sil.bottom - b * (sil.bottom - sil.top))
    const r1 = Math.round(sil.bottom - a * (sil.bottom - sil.top))
    let l = Infinity, r = -Infinity
    for (let y = r0; y <= r1; y++) if (sil.rows[y]) (l = Math.min(l, sil.rows[y][0])), (r = Math.max(r, sil.rows[y][1]))
    if (!isFinite(l)) continue
    xs.push(lo, hi)
    us.push(flip ? r : l, flip ? l : r)
  }
  const n = xs.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const mu = us.reduce((s, v) => s + v, 0) / n
  let sxx = 0, sxu = 0
  for (let i = 0; i < n; i++) (sxx += (xs[i] - mx) ** 2), (sxu += (xs[i] - mx) * (us[i] - mu))
  const a = sxu / sxx
  return { a, b: mu - a * mx }
}

const proj = {}
fs.mkdirSync('assets-src/_tmp', { recursive: true })
for (const [name, file] of Object.entries(IMAGES)) {
  const png = loadPng(file)
  const sil = silhouette(png)
  // front: image x follows mesh x. side (viewed from his left, face on the image's left): image x follows -z.
  const axis = name === 'front' ? 0 : 2
  const fit = fitColumns(sil, axis, name === 'side')
  bleed(png, sil.fg)
  fs.writeFileSync(`assets-src/_tmp/${name}.png`, PNG.sync.write(png))
  proj[name] = {
    // u = (a * coord + b) / width ; v = 1 - (bottom - y * (bottom - top)) / height  (GL: v up)
    a: fit.a / sil.w,
    b: fit.b / sil.w,
    top: sil.top / sil.h,
    bottom: sil.bottom / sil.h,
  }
  console.log(name, 'silhouette rows', sil.top, sil.bottom, 'fit', fit.a.toFixed(1), fit.b.toFixed(1))
}

// ---------- write ----------
fs.mkdirSync(OUT, { recursive: true })
const big = N > 65535
const head = Buffer.alloc(16)
head.write('VND1', 0)
head.writeUInt32LE(N, 4)
head.writeUInt32LE(I.length, 8)
head.writeUInt32LE(big ? 4 : 2, 12)
const posBuf = Buffer.from(P.buffer)
const idxBuf = Buffer.from((big ? I : Uint16Array.from(I)).buffer)
fs.writeFileSync(`${OUT}/mesh.bin`, Buffer.concat([head, posBuf, idxBuf]))
const round = (v) => (Array.isArray(v) ? v.map(round) : typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : Math.round(v * 1e5) / 1e5)
fs.writeFileSync(`${OUT}/rig.json`, JSON.stringify(round({ joints, bounds, proj }), null, 1))
console.log(`wrote mesh.bin (${N} verts, ${I.length / 3} tris, ${((16 + posBuf.length + idxBuf.length) / 1024).toFixed(0)} KB) and rig.json`)
console.log(JSON.stringify(round(joints)))
