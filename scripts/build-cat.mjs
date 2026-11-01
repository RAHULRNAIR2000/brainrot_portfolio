// Turns the cat statue GLB into a light web mesh for the street cat:
//   removes the round display base, welds UV seams (so it can shade smoothly), normalises to height 1,
//   and writes public/models/cat/mesh.bin + cat.json (neck height, nose position for the eyes).
// Run: node scripts/build-cat.mjs
import fs from 'node:fs'
import { MeshoptSimplifier } from 'meshoptimizer'

const SRC = process.argv[2] ?? 'assets-src/cat.glb'
const OUT = 'public/models/cat'
const BASE_TOP = 0.0126 // top of the display disc in the source file

const glb = fs.readFileSync(SRC)
const jsonLen = glb.readUInt32LE(12)
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString())
const bin = 20 + jsonLen + 8
const prim = gltf.meshes[0].primitives[0]
const view = (acc) => {
  const a = gltf.accessors[acc]
  const bv = gltf.bufferViews[a.bufferView]
  const start = glb.byteOffset + bin + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return { a, buf: glb.buffer.slice(start, start + a.count * (a.type === 'VEC3' ? 12 : a.componentType === 5125 ? 4 : 2)) }
}
const { a: pa, buf: pbuf } = view(prim.attributes.POSITION)
const srcPos = new Float32Array(pbuf)
const { a: ia, buf: ibuf } = view(prim.indices)
const srcIdx = ia.componentType === 5125 ? new Uint32Array(ibuf) : new Uint16Array(ibuf)

// weld by position
const map = new Map()
const pos = []
const remap = new Uint32Array(pa.count)
for (let i = 0; i < pa.count; i++) {
  const x = srcPos[i * 3], y = srcPos[i * 3 + 1], z = srcPos[i * 3 + 2]
  const key = `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`
  let k = map.get(key)
  if (k === undefined) {
    k = pos.length / 3
    map.set(key, k)
    pos.push(x, y, z)
  }
  remap[i] = k
}

// drop the display base (its sides, and any flat face lying on its top) and degenerate triangles
const faceNy = (t) => {
  const p = (k) => [pos[t[k] * 3], pos[t[k] * 3 + 1], pos[t[k] * 3 + 2]]
  const [a, b, c] = [p(0), p(1), p(2)]
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  return Math.abs(n[1]) / (Math.hypot(...n) || 1)
}
let tris = []
for (let f = 0; f < srcIdx.length; f += 3) {
  const t = [remap[srcIdx[f]], remap[srcIdx[f + 1]], remap[srcIdx[f + 2]]]
  if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue
  const ys = t.map((v) => pos[v * 3 + 1])
  if (ys.every((y) => y <= BASE_TOP + 1e-4)) continue
  if (ys.every((y) => y <= BASE_TOP + 0.004) && faceNy(t) > 0.9) continue
  // bevelled outer rim of the base, beyond the cat's footprint
  if (ys.every((y) => y <= BASE_TOP + 0.006) && t.every((v) => Math.hypot(pos[v * 3], pos[v * 3 + 2]) > 0.078)) continue
  if (ys.every((y) => y <= BASE_TOP + 0.002)) continue
  tris.push(...t)
}

// soften the low-poly facets: one midpoint subdivision, Taubin smoothing, then simplify back down
{
  const edge = new Map()
  const mid = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`
    let m = edge.get(k)
    if (m === undefined) {
      m = pos.length / 3
      pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2)
      edge.set(k, m)
    }
    return m
  }
  const out = []
  for (let f = 0; f < tris.length; f += 3) {
    const [a, b, c] = [tris[f], tris[f + 1], tris[f + 2]]
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a)
    out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca)
  }
  tris = out
  const nv = pos.length / 3
  const nbr = Array.from({ length: nv }, () => new Set())
  for (let f = 0; f < tris.length; f += 3)
    for (let k = 0; k < 3; k++) {
      const a = tris[f + k], b = tris[f + ((k + 1) % 3)]
      nbr[a].add(b)
      nbr[b].add(a)
    }
  const step = (lambda) => {
    const next = pos.slice()
    for (let i = 0; i < nv; i++) {
      if (pos[i * 3 + 1] < BASE_TOP + 0.003) continue // keep the feet planted
      let sx = 0, sy = 0, sz = 0
      for (const j of nbr[i]) (sx += pos[j * 3]), (sy += pos[j * 3 + 1]), (sz += pos[j * 3 + 2])
      const n = nbr[i].size || 1
      next[i * 3] += lambda * (sx / n - pos[i * 3])
      next[i * 3 + 1] += lambda * (sy / n - pos[i * 3 + 1])
      next[i * 3 + 2] += lambda * (sz / n - pos[i * 3 + 2])
    }
    pos.splice(0, pos.length, ...next)
  }
  for (let it = 0; it < 12; it++) (step(0.5), step(-0.53))
  await MeshoptSimplifier.ready
  const [simple] = MeshoptSimplifier.simplify(Uint32Array.from(tris), new Float32Array(pos), 3, 30000 * 3, 0.0005, [])
  tris = Array.from(simple)
}

// compact
const used = new Int32Array(pos.length / 3).fill(-1)
const P = []
const I = new Uint32Array(tris.length)
tris.forEach((v, k) => {
  if (used[v] < 0) {
    used[v] = P.length / 3
    P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
  }
  I[k] = used[v]
})
const N = P.length / 3

// normalise: sits at y = 0, height 1, body centred
let y0 = Infinity, y1 = -Infinity
for (let i = 0; i < N; i++) (y0 = Math.min(y0, P[i * 3 + 1])), (y1 = Math.max(y1, P[i * 3 + 1]))
const H = y1 - y0
let cx = 0, cz = 0, cn = 0
for (let i = 0; i < N; i++) {
  const y = (P[i * 3 + 1] - y0) / H
  if (y > 0.2 && y < 0.5) (cx += P[i * 3]), (cz += P[i * 3 + 2]), cn++
}
cx /= cn
cz /= cn
const F = new Float32Array(N * 3)
for (let i = 0; i < N; i++) {
  F[i * 3] = (P[i * 3] - cx) / H
  F[i * 3 + 1] = (P[i * 3 + 1] - y0) / H
  F[i * 3 + 2] = (P[i * 3 + 2] - cz) / H
}

// nose = front-most point of the head; eyes sit above and to either side of it
let nose = [0, 0, -1]
for (let i = 0; i < N; i++) if (F[i * 3 + 1] > 0.55 && F[i * 3 + 2] > nose[2]) nose = [F[i * 3], F[i * 3 + 1], F[i * 3 + 2]]
let top = 0
for (let i = 0; i < N; i++) top = Math.max(top, F[i * 3 + 1])

fs.mkdirSync(OUT, { recursive: true })
const big = N > 65535
const head = Buffer.alloc(16)
head.write('VND1', 0)
head.writeUInt32LE(N, 4)
head.writeUInt32LE(I.length, 8)
head.writeUInt32LE(big ? 4 : 2, 12)
const out = Buffer.concat([head, Buffer.from(F.buffer), Buffer.from((big ? I : Uint16Array.from(I)).buffer)])
fs.writeFileSync(`${OUT}/mesh.bin`, out)
const r = (v) => Math.round(v * 1e4) / 1e4
fs.writeFileSync(`${OUT}/cat.json`, JSON.stringify({ neckY: 0.6, nose: nose.map(r), top: r(top) }))
console.log(`cat: ${N} verts, ${I.length / 3} tris, ${(out.length / 1024).toFixed(0)} KB; nose ${nose.map(r)}`)
