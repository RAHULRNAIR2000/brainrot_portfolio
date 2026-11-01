import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { damp, Spring1 } from '../game/springs'
import { world, type Mood } from '../game/world'
import { brass } from './Stall'

export const VENDOR_ROOT = new THREE.Vector3(0, 0, -0.72)
const UPPER = 0.29
const FORE = 0.27
export const STICK = 0.85

// Pose targets in vendor-local space. Springs blend between them (≈0.25 s).
type Pose = {
  lean: number // + forward
  twist: number
  tilt: number
  bob: number
  headPitch: number
  headRoll: number
  brow: number // raise
  browAngle: number // + angry/smug
  mouth: number // open 0..1
  smile: number
  squint: number
  left: [number, number, number] // left hand target
  leftWave?: boolean
}

export const POSES: Record<Mood, Pose> = {
  idle: { lean: 0.03, twist: 0, tilt: 0, bob: 0, headPitch: 0, headRoll: 0, brow: 0, browAngle: 0, mouth: 0, smile: 0.4, squint: 0, left: [0.24, 1.12, 0.36] },
  greet: { lean: 0.06, twist: -0.1, tilt: 0.03, bob: 0.01, headPitch: 0.05, headRoll: 0.08, brow: 0.6, browAngle: -0.2, mouth: 0.2, smile: 1, squint: 0.1, left: [0.42, 1.92, 0.16], leftWave: true },
  offer: { lean: 0.14, twist: 0.05, tilt: 0, bob: 0, headPitch: 0.06, headRoll: -0.05, brow: 0.35, browAngle: -0.1, mouth: 0.05, smile: 0.9, squint: 0, left: [0.24, 1.12, 0.36] },
  tell: { lean: -0.04, twist: 0.12, tilt: -0.04, bob: 0.015, headPitch: -0.04, headRoll: 0.12, brow: 0.2, browAngle: 0.5, mouth: 0, smile: 0.7, squint: 0.6, left: [0.24, 1.14, 0.3] },
  dodge: { lean: -0.06, twist: 0.25, tilt: 0.05, bob: 0.02, headPitch: -0.02, headRoll: 0.05, brow: 0.5, browAngle: 0.3, mouth: 0.3, smile: 1, squint: 0.3, left: [0.32, 1.3, 0.2] },
  smug: { lean: -0.02, twist: -0.08, tilt: 0.06, bob: 0, headPitch: -0.08, headRoll: -0.14, brow: 0.3, browAngle: 0.6, mouth: 0, smile: 1, squint: 0.5, left: [0.27, 1.06, -0.04] },
  laugh: { lean: -0.12, twist: 0, tilt: 0, bob: 0.02, headPitch: -0.28, headRoll: 0, brow: 0.7, browAngle: -0.3, mouth: 0.9, smile: 1, squint: 1, left: [0.1, 1.18, 0.24] },
  shocked: { lean: -0.14, twist: 0, tilt: 0, bob: 0.03, headPitch: -0.06, headRoll: 0, brow: 1, browAngle: -0.5, mouth: 0.75, smile: 0, squint: -0.4, left: [0.13, 1.72, 0.14] },
  handover: { lean: 0.2, twist: -0.05, tilt: 0, bob: 0, headPitch: 0.1, headRoll: 0.1, brow: 0.4, browAngle: -0.2, mouth: 0.15, smile: 1, squint: 0.3, left: [0.2, 1.24, 0.5] },
  celebrate: { lean: 0.02, twist: 0, tilt: -0.04, bob: 0.03, headPitch: -0.1, headRoll: 0, brow: 0.8, browAngle: -0.3, mouth: 0.6, smile: 1, squint: 0.5, left: [0.36, 2.02, 0.1] },
}

const v = () => new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

function placeSegment(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = v().subVectors(b, a)
  const len = dir.length()
  mesh.position.copy(a).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
  mesh.scale.set(1, len, 1)
}

// Two-bone IK: returns elbow and hand positions.
function solveIK(S: THREE.Vector3, T: THREE.Vector3, pole: THREE.Vector3, elbow: THREE.Vector3, hand: THREE.Vector3) {
  const dir = v().subVectors(T, S)
  const d = THREE.MathUtils.clamp(dir.length(), 0.05, UPPER + FORE - 0.002)
  dir.normalize()
  const cosA = THREE.MathUtils.clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1)
  const sinA = Math.sqrt(1 - cosA * cosA)
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize()
  elbow.copy(S).addScaledVector(dir, UPPER * cosA).addScaledVector(perp, UPPER * sinA)
  hand.copy(S).addScaledVector(dir, d)
}

function useVendorMaterials() {
  return useMemo(
    () => ({
      skin: new THREE.MeshPhysicalMaterial({ color: '#c58763', roughness: 0.58, sheen: 0.35, sheenColor: new THREE.Color('#ff9a7a'), sheenRoughness: 0.6 }),
      shirt: new THREE.MeshStandardMaterial({ color: '#efe8dc', roughness: 0.82 }),
      vest: new THREE.MeshPhysicalMaterial({ color: '#5c0d1a', roughness: 0.7, sheen: 1, sheenColor: new THREE.Color('#d14a5a'), side: THREE.DoubleSide }),
      hair: new THREE.MeshStandardMaterial({ color: '#1c130f', roughness: 0.85 }),
      fez: new THREE.MeshPhysicalMaterial({ color: '#a3121f', roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#ff5a5a'), sheenRoughness: 0.5 }),
      eyeWhite: new THREE.MeshStandardMaterial({ color: '#f4efe8', roughness: 0.25 }),
      pupil: new THREE.MeshStandardMaterial({ color: '#120b08', roughness: 0.1 }),
      mouth: new THREE.MeshStandardMaterial({ color: '#3a0d10', roughness: 0.6 }),
      trousers: new THREE.MeshStandardMaterial({ color: '#1d1f2a', roughness: 0.9 }),
      apron: new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: '#d7dbe2', metalness: 1, roughness: 0.2 }),
    }),
    [],
  )
}

function Mustache({ mat }: { mat: THREE.Material }) {
  const geos = useMemo(() => {
    return [1, -1].map((s) => {
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.0, 0, 0),
        new THREE.Vector3(s * 0.035, -0.012, 0.004),
        new THREE.Vector3(s * 0.07, -0.01, -0.006),
        new THREE.Vector3(s * 0.092, 0.012, -0.016),
        new THREE.Vector3(s * 0.088, 0.03, -0.02),
        new THREE.Vector3(s * 0.076, 0.028, -0.018),
      ])
      const g = new THREE.TubeGeometry(c, 30, 1, 8, false)
      // taper toward the curl
      const p = g.attributes.position as THREE.BufferAttribute
      const center = new THREE.Vector3()
      for (let i = 0; i < p.count; i++) {
        const seg = Math.floor(i / 9)
        const t = seg / 30
        c.getPointAt(Math.min(1, t), center)
        const r = THREE.MathUtils.lerp(0.017, 0.004, Math.pow(t, 0.8))
        const vtx = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(center).normalize().multiplyScalar(r).add(center)
        p.setXYZ(i, vtx.x, vtx.y, vtx.z)
      }
      g.computeVertexNormals()
      return g
    })
  }, [])
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} castShadow />
      ))}
    </group>
  )
}

export function Vendor() {
  const m = useVendorMaterials()
  const root = useRef<THREE.Group>(null!)
  const spine = useRef<THREE.Group>(null!)
  const head = useRef<THREE.Group>(null!)
  const eyes = useRef<THREE.Group>(null!)
  const pupils = useRef<THREE.Group>(null!)
  const browL = useRef<THREE.Mesh>(null!)
  const browR = useRef<THREE.Mesh>(null!)
  const mouth = useRef<THREE.Mesh>(null!)
  const tassel = useRef<THREE.Group>(null!)
  const arm = {
    rUpper: useRef<THREE.Mesh>(null!),
    rFore: useRef<THREE.Mesh>(null!),
    rElbow: useRef<THREE.Mesh>(null!),
    rHand: useRef<THREE.Mesh>(null!),
    lUpper: useRef<THREE.Mesh>(null!),
    lFore: useRef<THREE.Mesh>(null!),
    lElbow: useRef<THREE.Mesh>(null!),
    lHand: useRef<THREE.Mesh>(null!),
    stick: useRef<THREE.Mesh>(null!),
  }

  const state = useMemo(
    () => ({
      p: { ...POSES.idle, left: new THREE.Vector3(...POSES.idle.left) },
      yaw: 0,
      pitch: 0,
      prevYaw: 0,
      tasselX: new Spring1(0, 60, 0.25),
      tasselZ: new Spring1(0, 60, 0.25),
      blinkAt: 2,
      blink: 0,
      tmp: {
        sL: v(), sR: v(), eL: v(), hL: v(), eR: v(), hR: v(), cone: v(), handT: v(), look: v(), headW: v(),
      },
    }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = world.time
    const pose = POSES[world.mood]
    const s = state.p
    const L = 12
    s.lean = damp(s.lean, pose.lean, L, dt)
    s.twist = damp(s.twist, pose.twist + (world.mood === 'dodge' ? THREE.MathUtils.clamp((world.cone.x - VENDOR_ROOT.x) * 0.3, -0.3, 0.3) : 0), L, dt)
    s.tilt = damp(s.tilt, pose.tilt, L, dt)
    s.bob = damp(s.bob, pose.bob, L, dt)
    s.headPitch = damp(s.headPitch, pose.headPitch, L, dt)
    s.headRoll = damp(s.headRoll, pose.headRoll, L, dt)
    s.brow = damp(s.brow, pose.brow, 16, dt)
    s.browAngle = damp(s.browAngle, pose.browAngle, 16, dt)
    s.squint = damp(s.squint, pose.squint, 16, dt)
    const talking = world.talkUntil > t
    const talkMouth = talking ? 0.25 + 0.55 * Math.abs(Math.sin(t * 17) * Math.sin(t * 6.3)) : 0
    s.mouth = damp(s.mouth, Math.max(pose.mouth, talkMouth), 22, dt)
    const lt = v().set(...pose.left)
    if (pose.leftWave) lt.x += Math.sin(t * 9) * 0.09
    s.left.x = damp(s.left.x, lt.x, 9, dt)
    s.left.y = damp(s.left.y, lt.y, 9, dt)
    s.left.z = damp(s.left.z, lt.z, 9, dt)

    // body
    const breathe = Math.sin(t * 1.6) * 0.006
    const laughShake = world.mood === 'laugh' ? Math.sin(t * 26) * 0.012 : 0
    spine.current.rotation.set(s.lean + Math.sin(t * 0.7) * 0.01, s.twist + Math.sin(t * 0.43) * 0.02, s.tilt)
    spine.current.position.y = 1.0 + s.bob + breathe + laughShake

    // head look at target (hand while playing, otherwise the camera)
    const tm = state.tmp
    head.current.getWorldPosition(tm.headW)
    tm.look.copy(world.lookTarget).sub(tm.headW)
    const yawT = THREE.MathUtils.clamp(Math.atan2(tm.look.x, tm.look.z), -0.65, 0.65)
    const pitchT = THREE.MathUtils.clamp(-Math.atan2(tm.look.y, Math.hypot(tm.look.x, tm.look.z)), -0.4, 0.35)
    state.prevYaw = state.yaw
    state.yaw = damp(state.yaw, yawT - s.twist, 7, dt)
    state.pitch = damp(state.pitch, pitchT - s.lean, 7, dt)
    head.current.rotation.set(state.pitch * 0.8 + s.headPitch, state.yaw * 0.85, s.headRoll + laughShake * 4)
    pupils.current.position.set(THREE.MathUtils.clamp(state.yaw * 0.012, -0.007, 0.007), THREE.MathUtils.clamp(-state.pitch * 0.012, -0.006, 0.006), 0)

    // blink + squint
    if (t > state.blinkAt) {
      state.blink = 1
      state.blinkAt = t + 2 + Math.random() * 3.5
    }
    state.blink = Math.max(0, state.blink - dt * 9)
    const open = THREE.MathUtils.clamp(1 - s.squint * 0.7 - (state.blink > 0.5 ? 1 : state.blink * 2) * 0.95, 0.06, 1.35)
    eyes.current.scale.y = open

    browL.current.position.y = 0.062 + s.brow * 0.018
    browR.current.position.y = 0.062 + s.brow * 0.018
    browL.current.rotation.z = -0.12 - s.browAngle * 0.35
    browR.current.rotation.z = 0.12 + s.browAngle * 0.35
    mouth.current.scale.set(1 - s.mouth * 0.25 + s.smile * 0.15, 0.25 + s.mouth * 1.4, 1)

    // fez tassel swings with head motion
    const yawVel = (state.yaw - state.prevYaw) / Math.max(dt, 1e-3)
    state.tasselX.step(-state.pitch * 0.4 + (world.mood === 'laugh' ? Math.sin(t * 26) * 0.4 : 0), dt)
    state.tasselZ.step(THREE.MathUtils.clamp(-yawVel * 0.12, -0.9, 0.9), dt)
    tassel.current.rotation.set(0.25 + state.tasselX.x, 0, state.tasselZ.x)

    // arms: shoulders from the chest transform
    spine.current.updateWorldMatrix(true, false)
    tm.sR.set(-0.215, 0.5, 0.0).applyMatrix4(spine.current.matrixWorld).sub(VENDOR_ROOT)
    tm.sL.set(0.215, 0.5, 0.0).applyMatrix4(spine.current.matrixWorld).sub(VENDOR_ROOT)

    // right hand holds the stick; the cone sits on its far end
    tm.cone.copy(world.cone).sub(VENDOR_ROOT)
    const toCone = v().subVectors(tm.cone, tm.sR)
    const dist = toCone.length()
    toCone.normalize()
    const reach = world.coneOwnedByPlayer ? 0.3 : THREE.MathUtils.clamp(dist - STICK, 0.14, UPPER + FORE - 0.02)
    tm.handT.copy(tm.sR).addScaledVector(toCone, reach)
    tm.handT.y -= 0.04
    solveIK(tm.sR, tm.handT, v().set(-0.6, -1, -0.5), tm.eR, tm.hR)
    placeSegment(arm.rUpper.current, tm.sR, tm.eR)
    placeSegment(arm.rFore.current, tm.eR, tm.hR)
    arm.rElbow.current.position.copy(tm.eR)
    arm.rHand.current.position.copy(tm.hR)
    if (world.coneOwnedByPlayer) {
      placeSegment(arm.stick.current, tm.hR, v().copy(tm.hR).add(v().set(-0.1, 0.8, 0.15)))
    } else {
      placeSegment(arm.stick.current, tm.hR, tm.cone)
    }

    solveIK(tm.sL, s.left, v().set(0.8, -1, -0.6), tm.eL, tm.hL)
    placeSegment(arm.lUpper.current, tm.sL, tm.eL)
    placeSegment(arm.lFore.current, tm.eL, tm.hL)
    arm.lElbow.current.position.copy(tm.eL)
    arm.lHand.current.position.copy(tm.hL)
  })

  const torsoProfile = useMemo(
    () =>
      [
        [0.0, -0.05], [0.17, -0.05], [0.185, 0.05], [0.2, 0.2], [0.215, 0.33], [0.22, 0.42], [0.2, 0.5], [0.13, 0.56], [0.06, 0.58], [0.0, 0.58],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    [],
  )
  const vestProfile = useMemo(() => torsoProfile.slice(1, 8).map((p) => new THREE.Vector2(p.x + 0.012, p.y)), [torsoProfile])

  return (
    <group ref={root} position={VENDOR_ROOT.toArray()}>
      {/* legs + apron (mostly hidden by the cart, still cast shadows) */}
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} material={m.trousers} castShadow>
          <cylinderGeometry args={[0.07, 0.06, 1.0, 10]} />
        </mesh>
      ))}
      <group ref={spine} position={[0, 1, 0]}>
        <mesh material={m.shirt} castShadow>
          <latheGeometry args={[torsoProfile, 28]} />
        </mesh>
        <mesh material={m.vest} castShadow>
          <latheGeometry args={[vestProfile, 28, 0.42, Math.PI * 2 - 0.84]} />
        </mesh>
        {/* gold trim down the vest opening */}
        {[-1, 1].map((sgn) => (
          <mesh key={sgn} position={[sgn * 0.085, 0.22, 0.19]} rotation-z={sgn * -0.05} material={brass}>
            <boxGeometry args={[0.012, 0.42, 0.012]} />
          </mesh>
        ))}
        {[0.12, 0.22, 0.32].map((y) => (
          <mesh key={y} position={[0, y, 0.205]} material={m.shirt}>
            <sphereGeometry args={[0.008, 6, 6]} />
          </mesh>
        ))}
        {/* apron bib */}
        <mesh position={[0, -0.02, 0.17]} rotation-x={-0.08} material={m.apron}>
          <boxGeometry args={[0.32, 0.16, 0.02]} />
        </mesh>
        {/* neck */}
        <mesh position={[0, 0.62, 0]} material={m.skin}>
          <cylinderGeometry args={[0.05, 0.058, 0.1, 12]} />
        </mesh>
        <group ref={head} position={[0, 0.74, 0.0]}>
          <mesh scale={[1, 1.12, 1.02]} material={m.skin} castShadow>
            <sphereGeometry args={[0.11, 32, 24]} />
          </mesh>
          {/* jaw / chin */}
          <mesh position={[0, -0.065, 0.03]} scale={[1, 0.7, 0.9]} material={m.skin}>
            <sphereGeometry args={[0.08, 20, 14]} />
          </mesh>
          {/* ears */}
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[sgn * 0.108, 0.0, -0.005]} scale={[0.4, 1, 0.75]} material={m.skin}>
              <sphereGeometry args={[0.03, 12, 10]} />
            </mesh>
          ))}
          {/* sideburns + back hair */}
          {[-1, 1].map((sgn) => (
            <mesh key={sgn} position={[sgn * 0.1, 0.035, 0.015]} scale={[0.35, 1, 0.7]} material={m.hair}>
              <sphereGeometry args={[0.045, 10, 8]} />
            </mesh>
          ))}
          <mesh position={[0, 0.03, -0.035]} scale={[1.02, 0.9, 0.95]} material={m.hair}>
            <sphereGeometry args={[0.11, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          </mesh>
          {/* nose */}
          <mesh position={[0, -0.005, 0.112]} scale={[0.75, 1, 0.95]} material={m.skin}>
            <sphereGeometry args={[0.03, 16, 12]} />
          </mesh>
          {/* eyes */}
          <group ref={eyes} position={[0, 0.03, 0.093]}>
            {[-1, 1].map((sgn) => (
              <mesh key={sgn} position={[sgn * 0.04, 0, 0]} scale={[1, 0.85, 0.6]} material={m.eyeWhite}>
                <sphereGeometry args={[0.019, 16, 12]} />
              </mesh>
            ))}
            <group ref={pupils}>
              {[-1, 1].map((sgn) => (
                <mesh key={sgn} position={[sgn * 0.04, 0, 0.011]} material={m.pupil}>
                  <sphereGeometry args={[0.0105, 12, 10]} />
                </mesh>
              ))}
            </group>
          </group>
          <mesh ref={browL} position={[0.042, 0.062, 0.1]} material={m.hair}>
            <boxGeometry args={[0.048, 0.013, 0.014]} />
          </mesh>
          <mesh ref={browR} position={[-0.042, 0.062, 0.1]} material={m.hair}>
            <boxGeometry args={[0.048, 0.013, 0.014]} />
          </mesh>
          {/* mouth sits under the mustache */}
          <mesh ref={mouth} position={[0, -0.058, 0.098]} material={m.mouth}>
            <sphereGeometry args={[0.022, 16, 10]} />
          </mesh>
          <group position={[0, -0.035, 0.113]}>
            <Mustache mat={m.hair} />
          </group>
          {/* fez */}
          <group position={[0, 0.095, -0.004]} rotation-x={-0.08}>
            <mesh position={[0, 0.06, 0]} material={m.fez} castShadow>
              <cylinderGeometry args={[0.078, 0.104, 0.13, 28]} />
            </mesh>
            <mesh position={[0, 0.126, 0]} material={m.fez}>
              <cylinderGeometry args={[0.078, 0.078, 0.004, 28]} />
            </mesh>
            <group ref={tassel} position={[0, 0.128, 0]}>
              <mesh position={[0, 0.0, -0.035]} rotation-x={Math.PI / 2} material={m.hair}>
                <cylinderGeometry args={[0.004, 0.004, 0.07, 5]} />
              </mesh>
              <mesh position={[0, -0.05, -0.075]} material={m.hair}>
                <coneGeometry args={[0.018, 0.09, 10]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
      {/* arms are posed in vendor space by IK every frame */}
      <mesh ref={arm.rUpper} material={m.shirt} castShadow>
        <cylinderGeometry args={[0.044, 0.05, 1, 12]} />
      </mesh>
      <mesh ref={arm.rElbow} material={m.shirt}>
        <sphereGeometry args={[0.045, 12, 10]} />
      </mesh>
      <mesh ref={arm.rFore} material={m.skin} castShadow>
        <cylinderGeometry args={[0.03, 0.038, 1, 12]} />
      </mesh>
      <mesh ref={arm.rHand} material={m.skin} scale={[1, 1.15, 1]} castShadow>
        <sphereGeometry args={[0.04, 14, 12]} />
      </mesh>
      <mesh ref={arm.lUpper} material={m.shirt} castShadow>
        <cylinderGeometry args={[0.044, 0.05, 1, 12]} />
      </mesh>
      <mesh ref={arm.lElbow} material={m.shirt}>
        <sphereGeometry args={[0.045, 12, 10]} />
      </mesh>
      <mesh ref={arm.lFore} material={m.skin} castShadow>
        <cylinderGeometry args={[0.03, 0.038, 1, 12]} />
      </mesh>
      <mesh ref={arm.lHand} material={m.skin} scale={[1, 1.15, 1]} castShadow>
        <sphereGeometry args={[0.04, 14, 12]} />
      </mesh>
      <mesh ref={arm.stick} material={m.steel} castShadow>
        <cylinderGeometry args={[0.008, 0.01, 1, 8]} />
      </mesh>
    </group>
  )
}
