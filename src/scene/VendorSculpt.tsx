import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { suspend } from 'suspend-react'
import * as THREE from 'three'
import { damp } from '../game/springs'
import { world } from '../game/world'
import { POSES, STICK, VENDOR_ROOT } from './Vendor'
import { aimBone } from './VendorModel'

// The sculpted vendor: the STL turned into mesh.bin by scripts/build-vendor.mjs, coloured by projecting the
// ChatGPT reference images onto it, rigged in code and driven by the same mood poses as the built-in vendor.

const BASE = '/models/vendor/'
const HEIGHT = 2.0 // metres including the fez

type V3 = [number, number, number]
type Arm = { shoulder: V3; elbow: V3; wrist: V3; tip: V3 }
type RigData = {
  joints: { hips: V3; spine: V3; chest: V3; neck: V3; head: V3; headTop: V3; L: Arm; R: Arm }
  proj: Record<'front' | 'side', { a: number; b: number; top: number; bottom: number }>
}

async function loadMesh() {
  const [bin, rig] = await Promise.all([
    fetch(BASE + 'mesh.bin').then((r) => r.arrayBuffer()),
    fetch(BASE + 'rig.json').then((r) => r.json() as Promise<RigData>),
  ])
  const head = new DataView(bin, 0, 16)
  const n = head.getUint32(4, true)
  const count = head.getUint32(8, true)
  const idxSize = head.getUint32(12, true)
  const pos = new Float32Array(bin, 16, n * 3)
  const idx = idxSize === 4 ? new Uint32Array(bin, 16 + n * 12, count) : new Uint16Array(bin, 16 + n * 12, count)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3))
  g.setIndex(new THREE.BufferAttribute(idx.slice(), 1))
  g.computeVertexNormals()
  g.setAttribute('aBind', new THREE.BufferAttribute(pos.slice(), 3))
  g.setAttribute('aBindN', new THREE.BufferAttribute((g.attributes.normal.array as Float32Array).slice(), 3))
  return { geo: g, rig }
}

function buildRig(geo: THREE.BufferGeometry, rig: RigData) {
  const J = rig.joints
  const v = (p: V3) => new THREE.Vector3(...p)
  const bones: THREE.Bone[] = []
  const abs: THREE.Vector3[] = []
  const add = (name: string, p: V3, parent: number | null) => {
    const b = new THREE.Bone()
    b.name = name
    const at = v(p)
    b.position.copy(parent === null ? at : at.clone().sub(abs[parent]))
    if (parent !== null) bones[parent].add(b)
    bones.push(b)
    abs.push(at)
    return bones.length - 1
  }
  const hips = add('hips', J.hips, null)
  const spine = add('spine', J.spine, hips)
  const chest = add('chest', J.chest, spine)
  const neck = add('neck', J.neck, chest)
  const headB = add('head', J.head, neck)
  const arm = (side: 'L' | 'R') => {
    const A = J[side]
    const up = add(side + 'upper', A.shoulder, chest)
    const fore = add(side + 'fore', A.elbow, up)
    const hand = add(side + 'hand', A.wrist, fore)
    return { up, fore, hand }
  }
  const L = arm('L')
  const R = arm('R')

  const pos = geo.attributes.position as THREE.BufferAttribute
  const n = pos.count
  const skinIndex = new Uint16Array(n * 4)
  const skinWeight = new Float32Array(n * 4)
  const set = (i: number, parts: [number, number][]) => {
    const sum = parts.reduce((s2, [, w]) => s2 + w, 0)
    parts.slice(0, 4).forEach(([b, w], k) => {
      skinIndex[i * 4 + k] = b
      skinWeight[i * 4 + k] = w / sum
    })
  }
  const smooth = (e0: number, e1: number, x: number) => THREE.MathUtils.smoothstep(x, e0, e1)

  // arms: a vertex belongs to an arm when it sits inside a tube around the arm's bones
  type ArmSeg = { a: THREE.Vector3; b: THREE.Vector3; bone: number; prev: number; next: number; r0: number; r1: number }
  const arms: ArmSeg[][] = (['L', 'R'] as const).map((side) => {
    const A = J[side]
    const ids = side === 'L' ? L : R
    return [
      { a: v(A.shoulder), b: v(A.elbow), bone: ids.up, prev: chest, next: ids.fore, r0: 0.075, r1: 0.05 },
      { a: v(A.elbow), b: v(A.wrist), bone: ids.fore, prev: ids.up, next: ids.hand, r0: 0.05, r1: 0.045 },
      { a: v(A.wrist), b: v(A.tip).addScaledVector(v(A.tip).sub(v(A.wrist)), 0.15), bone: ids.hand, prev: ids.fore, next: ids.hand, r0: 0.055, r1: 0.05 },
    ]
  })

  const p = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ap = new THREE.Vector3()
  const isArm = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i)
    let best: { seg: ArmSeg; t: number; d: number } | null = null
    for (const chain of arms)
      for (const seg of chain) {
        ab.subVectors(seg.b, seg.a)
        const t = THREE.MathUtils.clamp(ap.subVectors(p, seg.a).dot(ab) / ab.lengthSq(), 0, 1)
        const d = ap.copy(seg.a).addScaledVector(ab, t).distanceTo(p)
        const r = THREE.MathUtils.lerp(seg.r0, seg.r1, t)
        if (d < r && (!best || d / r < best.d)) best = { seg, t, d: d / r }
      }
    if (best && p.y < J.neck[1]) {
      isArm[i] = 1
      const { seg, t } = best
      // soft joints: blend into the previous bone at the start, into the next one at the end
      if (t < 0.18) set(i, [[seg.bone, 0.5 + t / 0.36], [seg.prev, 0.5 - t / 0.36]])
      else if (t > 0.85 && seg.next !== seg.bone) set(i, [[seg.bone, 1 - (t - 0.85) / 0.3], [seg.next, (t - 0.85) / 0.3]])
      else set(i, [[seg.bone, 1]])
      continue
    }
    // body: bends smoothly along its height
    const y = p.y
    if (y < J.hips[1] - 0.03) set(i, [[hips, 1]])
    else if (y < J.spine[1]) {
      const k = smooth(J.hips[1] - 0.03, J.spine[1], y)
      set(i, [[hips, 1 - k], [spine, k]])
    } else if (y < J.chest[1]) {
      const k = smooth(J.spine[1], J.chest[1], y)
      set(i, [[spine, 1 - k], [chest, k]])
    } else if (y < J.neck[1]) set(i, [[chest, 1]])
    else if (y < J.neck[1] + 0.035) {
      const k = smooth(J.neck[1], J.neck[1] + 0.035, y)
      set(i, [[chest, (1 - k) * 0.5], [neck, 0.5], [headB, k * 0.5]])
    } else set(i, [[headB, 1]])
  }
  // The generated mesh fuses the hands/forearms to the apron in places. Triangles bridging an arm and the
  // body below the armpit would stretch into sheets when the arm moves, so drop them.
  const index = geo.index!
  const kept: number[] = []
  const armpitY = Math.min(J.L.shoulder[1], J.R.shoulder[1]) - 0.07
  for (let f = 0; f < index.count; f += 3) {
    const a0 = index.getX(f), a1 = index.getX(f + 1), a2 = index.getX(f + 2)
    const arm = isArm[a0] + isArm[a1] + isArm[a2]
    const lowY = Math.max(pos.getY(a0), pos.getY(a1), pos.getY(a2)) < armpitY
    if (arm > 0 && arm < 3 && lowY) continue
    kept.push(a0, a1, a2)
  }
  geo.setIndex(kept)
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4))
  return { bones, ids: { hips, spine, chest, neck, head: headB, L, R } }
}

function projectedMaterial(front: THREE.Texture, side: THREE.Texture, rig: RigData) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, envMapIntensity: 0.9 })
  const { front: F, side: S } = rig.proj
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFront = { value: front }
    sh.uniforms.uSide = { value: side }
    sh.uniforms.uF = { value: new THREE.Vector4(F.a, F.b, F.top, F.bottom) }
    sh.uniforms.uS = { value: new THREE.Vector4(S.a, S.b, S.top, S.bottom) }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aBind;\nattribute vec3 aBindN;\nvarying vec3 vBind;\nvarying vec3 vBindN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = aBind;\nvBindN = aBindN;')
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uFront;\nuniform sampler2D uSide;\nuniform vec4 uF;\nuniform vec4 uS;\nvarying vec3 vBind;\nvarying vec3 vBindN;',
      )
      .replace(
        '#include <map_fragment>',
        `
        // front image along z, side image along x (and for the back), blended by the rest-pose normal
        vec2 uvF = vec2(uF.x * vBind.x + uF.y, 1.0 - (uF.w - vBind.y * (uF.w - uF.z)));
        vec2 uvS = vec2(uS.x * vBind.z + uS.y, 1.0 - (uS.w - vBind.y * (uS.w - uS.z)));
        vec3 bn = normalize(vBindN);
        float wf = max(bn.z, 0.0) + 0.03;
        float ws = pow(abs(bn.x), 4.0) + pow(max(-bn.z, 0.0), 2.0) * 0.9;
        vec3 cf = texture2D(uFront, uvF).rgb;
        vec3 cs = texture2D(uSide, uvS).rgb;
        diffuseColor.rgb *= (cf * wf + cs * ws) / (wf + ws);
        `,
      )
  }
  return m
}

const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion() }

// Two-bone IK by aiming: upper bone points the elbow at the solved elbow, fore bone points the wrist at the target.
function armIK(upper: THREE.Bone, fore: THREE.Bone, hand: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3) {
  const S = upper.getWorldPosition(new THREE.Vector3())
  const E = fore.getWorldPosition(new THREE.Vector3())
  const W = hand.getWorldPosition(new THREE.Vector3())
  const a = S.distanceTo(E)
  const b = E.distanceTo(W)
  const dir = tmp.a.subVectors(target, S)
  const d = THREE.MathUtils.clamp(dir.length(), 0.05, a + b - 0.002)
  dir.normalize()
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)
  const perp = tmp.b.copy(pole).addScaledVector(dir, -pole.dot(dir)).normalize()
  const elbowT = tmp.c.copy(S).addScaledVector(dir, a * cosA).addScaledVector(perp, a * Math.sqrt(1 - cosA * cosA))
  aimBone(upper, E.clone().sub(S).normalize(), elbowT.clone().sub(S).normalize(), 1)
  const E2 = fore.getWorldPosition(new THREE.Vector3())
  const W2 = hand.getWorldPosition(new THREE.Vector3())
  const handT = tmp.d.copy(S).addScaledVector(dir, d)
  aimBone(fore, W2.sub(E2).normalize(), handT.sub(E2).normalize(), 1)
}

export function VendorSculpt() {
  const { geo, rig } = suspend(loadMesh, ['vendor-sculpt'])
  const [front, side] = useTexture([BASE + 'front.jpg', BASE + 'side.jpg'])
  const stick = useRef<THREE.Mesh>(null!)

  const built = useMemo(() => {
    for (const t of [front, side]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
    }
    const { bones, ids } = buildRig(geo, rig)
    const mesh = new THREE.SkinnedMesh(geo, projectedMaterial(front, side, rig))
    mesh.add(bones[0])
    mesh.bind(new THREE.Skeleton(bones))
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const b = (i: number) => bones[i]
    return {
      mesh,
      hips: b(ids.hips),
      spine: b(ids.spine),
      chest: b(ids.chest),
      neck: b(ids.neck),
      head: b(ids.head),
      L: { up: b(ids.L.up), fore: b(ids.L.fore), hand: b(ids.L.hand) },
      R: { up: b(ids.R.up), fore: b(ids.R.fore), hand: b(ids.R.hand) },
      hipsY: b(ids.hips).position.y,
      rest: new Map(bones.map((x) => [x, x.quaternion.clone()])),
      s: { lean: 0, twist: 0, tilt: 0, bob: 0, headPitch: 0, headRoll: 0, left: new THREE.Vector3(0.24, 1.12, 0.36) },
    }
  }, [geo, rig, front, side])

  useLayoutEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __sculpt: built })
    return () => built.mesh.geometry.dispose()
  }, [built])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = world.time
    const pose = POSES[world.mood]
    const s = built.s
    const L = 10
    s.lean = damp(s.lean, pose.lean, L, dt)
    s.twist = damp(s.twist, pose.twist + (world.mood === 'dodge' ? THREE.MathUtils.clamp((world.cone.x - VENDOR_ROOT.x) * 0.3, -0.3, 0.3) : 0), L, dt)
    s.tilt = damp(s.tilt, pose.tilt, L, dt)
    s.bob = damp(s.bob, pose.bob, L, dt)
    s.headPitch = damp(s.headPitch, pose.headPitch, L, dt)
    s.headRoll = damp(s.headRoll, pose.headRoll, L, dt)
    const lt = tmp.a.set(...pose.left)
    if (pose.leftWave) lt.x += Math.sin(t * 9) * 0.09
    s.left.x = damp(s.left.x, lt.x, 9, dt)
    s.left.y = damp(s.left.y, lt.y, 9, dt)
    s.left.z = damp(s.left.z, lt.z, 9, dt)

    // reset to rest, then layer: body sway, breathing, laugh shake
    for (const [bone, q] of built.rest) bone.quaternion.copy(q)
    const breathe = Math.sin(t * 1.6) * 0.004
    const shake = world.mood === 'laugh' ? Math.sin(t * 26) * 0.012 : 0
    built.hips.position.y = built.hipsY + (s.bob + breathe + shake) / HEIGHT
    built.spine.rotation.set(s.lean * 0.4 + Math.sin(t * 0.7) * 0.006, s.twist * 0.4 + Math.sin(t * 0.43) * 0.012, s.tilt * 0.4)
    built.chest.rotation.set(s.lean * 0.6, s.twist * 0.6, s.tilt * 0.6)
    const talking = world.talkUntil > t
    const nod = talking ? Math.sin(t * 9) * 0.05 + Math.sin(t * 5.3) * 0.03 : 0
    built.neck.rotation.set(s.headPitch * 0.5 + nod * 0.4, 0, s.headRoll * 0.5 + shake * 2)
    built.mesh.updateMatrixWorld(true)

    // head turns toward the visitor (or the hand while playing)
    const hp = built.head.getWorldPosition(tmp.b)
    const fwd = tmp.c.set(0, 0, 1).applyQuaternion(built.head.getWorldQuaternion(tmp.q))
    aimBone(built.head, fwd, tmp.d.copy(world.lookTarget).sub(hp).normalize(), 0.75, 0.6)
    built.head.rotateX(s.headPitch * 0.5 + nod)

    // right hand holds the stick; the cone sits on its far end
    const sR = built.R.up.getWorldPosition(new THREE.Vector3())
    const toCone = new THREE.Vector3().subVectors(world.cone, sR)
    const dist = toCone.length()
    toCone.normalize()
    const reach = world.coneOwnedByPlayer ? 0.32 : THREE.MathUtils.clamp(dist - STICK, 0.18, 0.62)
    const handT = sR.clone().addScaledVector(toCone, reach)
    handT.y -= 0.05
    armIK(built.R.up, built.R.fore, built.R.hand, handT, new THREE.Vector3(-0.6, -1, -0.5))
    // left hand follows the mood (rests on the counter, waves, cheers...)
    armIK(built.L.up, built.L.fore, built.L.hand, s.left.clone().add(VENDOR_ROOT), new THREE.Vector3(0.6, -1, -0.5))

    const hand = built.R.hand.getWorldPosition(new THREE.Vector3())
    const tip = world.coneOwnedByPlayer ? hand.clone().add(new THREE.Vector3(-0.08, 0.8, 0.12)) : world.cone
    const dir = new THREE.Vector3().subVectors(tip, hand)
    const len = dir.length()
    stick.current.position.copy(hand).addScaledVector(dir, 0.5)
    stick.current.quaternion.setFromUnitVectors(UP, dir.normalize())
    stick.current.scale.set(1, len, 1)
  })

  return (
    <>
      <group position={VENDOR_ROOT.toArray()} scale={HEIGHT}>
        <primitive object={built.mesh} />
      </group>
      <mesh ref={stick} castShadow>
        <cylinderGeometry args={[0.008, 0.01, 1, 8]} />
        <meshStandardMaterial color="#d7dbe2" metalness={1} roughness={0.2} />
      </mesh>
    </>
  )
}

const UP = new THREE.Vector3(0, 1, 0)
