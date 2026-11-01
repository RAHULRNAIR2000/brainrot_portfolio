import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { world, type Mood } from '../game/world'
import { CLIP_SYNONYMS, useExisting, VENDOR_CLIPS, type ClipKey } from './assets'
import { dressMannequin } from './Outfit'
import { Vendor, VENDOR_ROOT } from './Vendor'
import { VendorSculpt } from './VendorSculpt'

// Rigged GLB vendor (Meshy / Tripo / Mixamo). Falls back to the built-in vendor until public/models/vendor.glb exists.

const MODEL_URL = '/models/vendor.glb'
const HEIGHT = 1.8 // metres, feet to top of the head (the fez sits above)
const FADE = 0.28

const MOOD_CLIPS: Record<Mood, ClipKey[]> = {
  idle: ['idle'],
  greet: ['wave', 'talk', 'idle'],
  offer: ['offer', 'talk', 'idle'],
  tell: ['taunt', 'talk', 'idle'],
  dodge: ['dodge', 'taunt', 'idle'],
  smug: ['shrug', 'talk', 'idle'],
  laugh: ['laugh', 'talk', 'idle'],
  shocked: ['surprised', 'idle'],
  handover: ['offer', 'talk', 'idle'],
  celebrate: ['celebrate', 'idle'],
}
// one-shot reactions: they play once, then the next clip in the mood's list takes over
const ONCE: ClipKey[] = ['surprised', 'laugh', 'dodge', 'taunt', 'shrug', 'offer']
// how strongly the right hand holds the stick out toward the cone (1 = full IK, 0 = pure animation)
const AIM: Record<Mood, number> = { idle: 0.8, greet: 0.8, offer: 1, tell: 1, dodge: 1, smug: 1, laugh: 0.9, shocked: 0.9, handover: 1, celebrate: 0.5 }

const norm = (n: string) => n.toLowerCase().replace(/mixamorig:?|[^a-z0-9]/g, '')
function findBone(root: THREE.Object3D, names: string[]) {
  let hit: THREE.Bone | null = null
  root.traverse((o) => {
    if (hit || !(o as THREE.Bone).isBone) return
    const n = norm(o.name)
    if (names.some((x) => n === x || n.endsWith(x))) hit = o as THREE.Bone
  })
  return hit as THREE.Bone | null
}

const q1 = new THREE.Quaternion()
const q2 = new THREE.Quaternion()
const qd = new THREE.Quaternion()
const qi = new THREE.Quaternion()
const va = new THREE.Vector3()
const vb = new THREE.Vector3()
const vc = new THREE.Vector3()

// Rotate a bone in world space so `from` turns toward `to` by `weight`.
export function aimBone(bone: THREE.Bone, from: THREE.Vector3, to: THREE.Vector3, weight: number, maxAngle = Math.PI) {
  const angle = from.angleTo(to)
  if (angle < 1e-4) return
  qd.setFromUnitVectors(from, to)
  const t = Math.min(weight, maxAngle / angle)
  // partial turn: identity -> qd by t (slerpQuaternions would alias qd with itself)
  qd.copy(qi.identity().slerp(qd, t))
  bone.getWorldQuaternion(q1)
  q1.premultiply(qd)
  bone.parent!.getWorldQuaternion(q2)
  bone.quaternion.copy(q2.invert().multiply(q1))
  bone.updateMatrixWorld(true)
}

const _S = new THREE.Vector3()
const _E = new THREE.Vector3()
const _W = new THREE.Vector3()
const _d = new THREE.Vector3()
const _p = new THREE.Vector3()
const _e = new THREE.Vector3()

// Two-bone IK by aiming: upper bone points the elbow at the solved elbow, fore bone points the wrist at the target.
export function armIK(upper: THREE.Bone, fore: THREE.Bone, hand: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3) {
  upper.getWorldPosition(_S)
  fore.getWorldPosition(_E)
  hand.getWorldPosition(_W)
  const a = _S.distanceTo(_E)
  const b = _E.distanceTo(_W)
  _d.subVectors(target, _S)
  const d = THREE.MathUtils.clamp(_d.length(), Math.abs(a - b) + 0.01, a + b - 0.002)
  _d.normalize()
  const cosA = THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)).normalize()
  _e.copy(_S).addScaledVector(_d, a * cosA).addScaledVector(_p, a * Math.sqrt(1 - cosA * cosA))
  aimBone(upper, _E.clone().sub(_S).normalize(), _e.clone().sub(_S).normalize(), 1)
  fore.getWorldPosition(_E)
  hand.getWorldPosition(_W)
  aimBone(fore, _W.clone().sub(_E).normalize(), _S.clone().addScaledVector(_d, d).sub(_E).normalize(), 1)
}

// Blend bones back toward their animated pose by (1 - w) after an IK pass.
function keep(bones: THREE.Bone[]) {
  return bones.map((b) => b.quaternion.clone())
}
function blendBack(bones: THREE.Bone[], saved: THREE.Quaternion[], w: number) {
  bones.forEach((b, i) => b.quaternion.slerp(saved[i], 1 - w))
}

function Model({ clipUrls }: { clipUrls: string[] }) {
  const gltf = useGLTF(MODEL_URL, false, true)
  const extras = useGLTF(clipUrls.length ? clipUrls : [MODEL_URL], false, true) as unknown as { animations: THREE.AnimationClip[] }[]
  const group = useRef<THREE.Group>(null!)
  const stick = useRef<THREE.Mesh>(null!)

  const rig = useMemo(() => {
    const scene = gltf.scene
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        m.frustumCulled = false
      }
    })
    const clips: Partial<Record<ClipKey, THREE.AnimationClip>> = {}
    clipUrls.forEach((u, i) => {
      const key = u.split('/').pop()!.replace('.glb', '') as ClipKey
      const clip = extras[i]?.animations[0]
      if (clip) clips[key] = clip
    })
    for (const key of VENDOR_CLIPS) {
      if (clips[key]) continue
      const c = gltf.animations.find((a) => CLIP_SYNONYMS[key].test(a.name))
      if (c) clips[key] = c
    }
    if (!clips.idle && gltf.animations[0]) clips.idle = gltf.animations[0]
    const mixer = new THREE.AnimationMixer(scene)
    const actions: Partial<Record<ClipKey, THREE.AnimationAction>> = {}
    for (const [k, clip] of Object.entries(clips) as [ClipKey, THREE.AnimationClip][]) {
      // strip root motion so he stays behind the cart
      const c = clip.clone()
      c.tracks = c.tracks.filter((t) => !/(hips|root|pelvis)[^.]*\.position$/i.test(t.name))
      const a = mixer.clipAction(c)
      if (ONCE.includes(k)) {
        a.setLoop(THREE.LoopOnce, 1)
        a.clampWhenFinished = true
      }
      actions[k] = a
    }
    const find = (names: string[]) => findBone(scene, names)
    const r = {
      scene,
      mixer,
      actions,
      head: find(['head']),
      spine: find(['spine003', 'spine03', 'spine02', 'chest']),
      upper: find(['upperarmr', 'rightarm', 'rupperarm', 'rightupperarm']),
      fore: find(['forearmr', 'lowerarmr', 'rightforearm']),
      hand: find(['handr', 'righthand', 'rhand', 'palmr', 'wristr']),
      upperL: find(['upperarml', 'leftarm', 'lupperarm', 'leftupperarm']),
      foreL: find(['forearml', 'lowerarml', 'leftforearm']),
      handL: find(['handl', 'lefthand', 'lhand']),
      headFwd: new THREE.Vector3(0, 0, 1),
      current: null as ClipKey | null,
      done: new Set<ClipKey>(), // one-shots already played for the current mood
      mood: world.mood,
      wave: 0,
      twist: 0,
      outfit: dressMannequin(scene, find),
    }
    mixer.addEventListener('finished', (e) => {
      const key = (Object.entries(actions) as [ClipKey, THREE.AnimationAction][]).find(([, a]) => a === e.action)?.[0]
      if (key) r.done.add(key)
    })
    return r
  }, [gltf, extras, clipUrls])

  // fit to height, feet on the ground, facing the street (+z)
  useLayoutEffect(() => {
    const s = rig.scene
    s.position.set(0, 0, 0)
    s.scale.setScalar(1)
    s.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(s, true)
    const size = box.getSize(new THREE.Vector3())
    const k = HEIGHT / Math.max(size.y, 1e-3)
    s.scale.setScalar(k)
    s.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k)
    s.updateMatrixWorld(true)
    if (rig.head) {
      // which local axis of the head bone points where the face points (+z in world at rest)
      rig.head.getWorldQuaternion(q1)
      rig.headFwd.set(0, 0, 1).applyQuaternion(q1.invert())
    }
    rig.actions.idle?.play()
    rig.current = 'idle'
    return () => {
      rig.mixer.stopAllAction()
      world.vendorHandValid = false
    }
  }, [rig])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    // pick the clip for the mood (talking while idle uses the talk clip when there is one)
    if (rig.mood !== world.mood) {
      rig.mood = world.mood
      rig.done.clear()
    }
    let want = MOOD_CLIPS[world.mood].find((k) => rig.actions[k] && !rig.done.has(k)) ?? null
    if (want === 'idle' && world.talkUntil > world.time && rig.actions.talk) want = 'talk'
    if (want && want !== rig.current) {
      const next = rig.actions[want]!
      const prev = rig.current ? rig.actions[rig.current] : null
      next.reset().setEffectiveWeight(1).fadeIn(FADE).play()
      prev?.fadeOut(FADE)
      rig.current = want
    }
    rig.mixer.update(dt)
    rig.scene.updateMatrixWorld(true)

    // a little twist toward the cone while dodging
    rig.twist = THREE.MathUtils.damp(rig.twist, world.mood === 'dodge' ? THREE.MathUtils.clamp((world.cone.x - VENDOR_ROOT.x) * 0.35, -0.35, 0.35) : 0, 10, dt)
    if (rig.spine && Math.abs(rig.twist) > 1e-3) {
      rig.spine.rotateOnWorldAxis(UP, rig.twist)
      rig.spine.updateMatrixWorld(true)
    }

    // right hand holds the stick out toward the cone
    const w = world.coneOwnedByPlayer ? 0 : AIM[world.mood]
    if (rig.upper && rig.fore && rig.hand && w > 0) {
      const bones = [rig.upper, rig.fore]
      const saved = keep(bones)
      rig.upper.getWorldPosition(va)
      const toCone = vc.copy(world.cone).sub(va)
      const reach = THREE.MathUtils.clamp(toCone.length() - 0.85, 0.34, 0.6)
      const target = vb.copy(va).addScaledVector(toCone.normalize(), reach)
      target.y -= 0.1
      armIK(rig.upper, rig.fore, rig.hand, target, new THREE.Vector3(-0.5, -1, -0.6))
      blendBack(bones, saved, w)
      rig.scene.updateMatrixWorld(true)
    }

    // left hand waves hello (the library has no wave clip)
    rig.wave = THREE.MathUtils.damp(rig.wave, world.mood === 'greet' ? 1 : 0, 6, dt)
    if (rig.upperL && rig.foreL && rig.handL && rig.wave > 0.01) {
      const bones = [rig.upperL, rig.foreL]
      const saved = keep(bones)
      rig.upperL.getWorldPosition(va)
      const target = vb.copy(va).add(vc.set(0.2 + Math.sin(world.time * 9) * 0.1, 0.42, 0.12))
      armIK(rig.upperL, rig.foreL, rig.handL, target, new THREE.Vector3(1, -0.4, -0.6))
      blendBack(bones, saved, rig.wave)
      rig.scene.updateMatrixWorld(true)
    }

    // hands never sink into the counter: if an animation would push one through, rest it on top instead
    for (const [up, fo, ha, pole] of [
      [rig.upper, rig.fore, rig.hand, POLE_R],
      [rig.upperL, rig.foreL, rig.handL, POLE_L],
    ] as const) {
      if (!up || !fo || !ha) continue
      for (const b of [ha, fo]) {
        b.getWorldPosition(va)
        if (va.z > COUNTER_BACK_Z && va.y < COUNTER_TOP + 0.03) {
          ha.getWorldPosition(vb)
          vb.y = Math.max(vb.y, COUNTER_TOP + 0.05)
          vb.z = Math.max(vb.z, COUNTER_BACK_Z + 0.05)
          armIK(up, fo, ha, vb, pole)
          rig.scene.updateMatrixWorld(true)
          break
        }
      }
    }

    // head and eyes follow the visitor
    if (rig.head) {
      rig.head.getWorldPosition(va)
      rig.head.getWorldQuaternion(q1)
      const from = vb.copy(rig.headFwd).applyQuaternion(q1).normalize()
      const to = vc.copy(world.lookTarget).sub(va).normalize()
      aimBone(rig.head, from, to, 0.6, 0.55)
    }
    rig.outfit?.update(dt)

    if (rig.hand) {
      rig.hand.getWorldPosition(world.vendorHand)
      const tip = world.coneOwnedByPlayer ? va.copy(world.vendorHand).add(vb.set(-0.08, 0.8, 0.12)) : world.cone
      const dir = vc.subVectors(tip, world.vendorHand)
      const len = dir.length()
      stick.current.visible = true
      stick.current.position.copy(world.vendorHand).addScaledVector(dir, 0.5)
      stick.current.quaternion.setFromUnitVectors(UP, dir.normalize())
      stick.current.scale.set(1, len, 1)
    } else {
      stick.current.visible = false
    }
  })

  return (
    <>
      <group ref={group} position={VENDOR_ROOT.toArray()}>
        <primitive object={rig.scene} />
      </group>
      <mesh ref={stick} castShadow>
        <cylinderGeometry args={[0.008, 0.01, 1, 8]} />
        <meshStandardMaterial color="#d7dbe2" metalness={1} roughness={0.2} />
      </mesh>
    </>
  )
}

const UP = new THREE.Vector3(0, 1, 0)
// the cart's counter (world space): top surface height and its back edge
const COUNTER_TOP = 1.09
const COUNTER_BACK_Z = -0.45
const POLE_R = new THREE.Vector3(-0.5, -1, -0.6)
const POLE_L = new THREE.Vector3(0.5, -1, -0.6)

const SCULPT_URL = '/models/vendor/mesh.bin'

// Rigged GLB if there is one, else the sculpt built from the STL, else the built-in vendor.
export function VendorSlot() {
  const clipUrls = useMemo(() => VENDOR_CLIPS.map((k) => `/models/vendor/${k}.glb`), [])
  const found = useExisting([MODEL_URL, SCULPT_URL, ...clipUrls])
  if (!found) return null
  if (!found.includes(MODEL_URL))
    return found.includes(SCULPT_URL) ? (
      <Suspense fallback={<Vendor />}>
        <VendorSculpt />
      </Suspense>
    ) : (
      <Vendor />
    )
  return (
    <Suspense fallback={<Vendor />}>
      <Model clipUrls={found.filter((u) => u !== MODEL_URL && u !== SCULPT_URL)} />
    </Suspense>
  )
}
