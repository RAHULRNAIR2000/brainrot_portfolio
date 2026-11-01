// Picks the clips the vendor needs from Quaternius' Universal Animation Library (CC0), renames them to the
// vendor's mood keys, and writes a compressed public/models/vendor.glb.
// Run: node scripts/build-mannequin.mjs
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { MeshoptEncoder } from 'meshoptimizer'

const SRC = 'assets-src/downloads/ual1/x/Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb'
const OUT = 'public/models/vendor.glb'

// source clip -> mood key used by VendorModel (see CLIP_SYNONYMS / MOOD_CLIPS)
const KEEP = {
  Idle_Loop: 'idle',
  Idle_Talking_Loop: 'talk',
  Interact: 'offer',
  Spell_Simple_Enter: 'taunt',
  Punch_Jab: 'dodge',
  Hit_Chest: 'laugh',
  Hit_Head: 'surprised',
  Dance_Loop: 'celebrate',
  PickUp_Table: 'shrug',
}

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(SRC)
const root = doc.getRoot()

for (const anim of root.listAnimations()) {
  const key = KEEP[anim.getName()]
  if (key) anim.setName(key)
  else {
    // samplers keep their accessors alive unless disposed explicitly
    for (const ch of anim.listChannels()) ch.dispose()
    for (const smp of anim.listSamplers()) smp.dispose()
    anim.dispose()
  }
}
console.log('clips:', root.listAnimations().map((a) => a.getName()).join(', '))

// legs are hidden by the cart: drop their tracks. Then drop keys that a straight interpolation reproduces.
const HIDDEN = /thigh|shin|foot|toe/i
const TOL = 2e-4
let before = 0, after = 0
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode()
    if (node && HIDDEN.test(node.getName())) {
      const smp = ch.getSampler()
      ch.dispose()
      smp?.dispose()
      continue
    }
    const smp = ch.getSampler()
    if (!smp || smp.getInterpolation() !== 'LINEAR') continue
    const input = smp.getInput(), output = smp.getOutput()
    const t = input.getArray(), v = output.getArray()
    const n = t.length, k = v.length / n
    before += n
    const keep = [0]
    for (let i = 1; i < n - 1; i++) {
      const a = keep[keep.length - 1], b = i + 1
      const f = (t[i] - t[a]) / (t[b] - t[a])
      let ok = true
      for (let c = 0; c < k && ok; c++) ok = Math.abs(v[a * k + c] + (v[b * k + c] - v[a * k + c]) * f - v[i * k + c]) < TOL
      if (!ok) keep.push(i)
    }
    if (n > 1) keep.push(n - 1)
    after += keep.length
    const nt = new Float32Array(keep.map((i) => t[i]))
    const nv = new Float32Array(keep.length * k)
    keep.forEach((i, j) => nv.set(v.subarray(i * k, i * k + k), j * k))
    smp.setInput(doc.createAccessor().setType('SCALAR').setArray(nt).setBuffer(input.getBuffer()))
    smp.setOutput(doc.createAccessor().setType(output.getType()).setArray(nv).setBuffer(output.getBuffer()))
  }
}
console.log(`keyframes ${before} -> ${after}`)

// drop data that only the removed clips used (functions/prune pulls in sharp, which breaks on Node 18)
let dropped = 0
for (const acc of root.listAccessors()) {
  const users = acc.listParents().filter((p) => p !== root && p.propertyType !== 'Root')
  if (users.length === 0) (acc.dispose(), dropped++)
}
console.log('dropped accessors', dropped, 'kept', root.listAccessors().length)
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })
await io.write(OUT, doc)

const mesh = root.listMeshes()[0]
const pos = mesh.listPrimitives()[0].getAttribute('POSITION')
console.log('materials:', root.listMaterials().map((m) => m.getName()).join(', '))
console.log('verts:', pos.getCount(), 'bounds:', JSON.stringify(pos.getMin([])), JSON.stringify(pos.getMax([])))
