import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Spring1 } from '../game/springs'
import { world } from '../game/world'
import { useGame } from '../store/gameStore'
import { prefersReducedMotion } from '../utils/deviceTier'

const CONE_H = 0.17
const SCOOP_R = 0.066

function waffleTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')!
  x.fillStyle = '#d29a4c'
  x.fillRect(0, 0, 128, 128)
  x.strokeStyle = '#9a6424'
  x.lineWidth = 4
  for (let i = -128; i < 256; i += 22) {
    x.beginPath()
    x.moveTo(i, 0)
    x.lineTo(i + 128, 128)
    x.stroke()
    x.beginPath()
    x.moveTo(i + 128, 0)
    x.lineTo(i, 128)
    x.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 1)
  return t
}

function lumpyScoop() {
  const g = new THREE.SphereGeometry(SCOOP_R, 32, 24)
  const p = g.attributes.position as THREE.BufferAttribute
  const vtx = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    vtx.fromBufferAttribute(p, i)
    const n = Math.sin(vtx.x * 90) * Math.sin(vtx.y * 80 + 1) * Math.sin(vtx.z * 85 + 2)
    const drip = vtx.y < -0.02 ? Math.max(0, Math.sin(Math.atan2(vtx.z, vtx.x) * 7)) * 0.012 : 0
    vtx.multiplyScalar(1 + n * 0.05)
    vtx.y -= drip
    p.setXYZ(i, vtx.x, vtx.y, vtx.z)
  }
  g.computeVertexNormals()
  return g
}

function Sparkles() {
  const max = useGame((s) => s.settings.maxParticles)
  const ref = useRef<THREE.Points>(null!)
  const sim = useMemo(() => {
    const pos = new Float32Array(max * 3)
    const col = new Float32Array(max * 3)
    const vel = new Float32Array(max * 3)
    const life = new Float32Array(max)
    return { pos, col, vel, life, lastBurst: 0 }
  }, [max])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(sim.pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(sim.col, 3))
    return g
  }, [sim])

  useFrame((_, dt) => {
    if (world.burst !== sim.lastBurst) {
      sim.lastBurst = world.burst
      const c = new THREE.Color(world.scoopColor)
      const w = new THREE.Color('#fff4d6')
      for (let i = 0; i < max; i++) {
        const k = i * 3
        sim.pos[k] = world.cone.x
        sim.pos[k + 1] = world.cone.y + 0.12
        sim.pos[k + 2] = world.cone.z
        const th = Math.random() * Math.PI * 2
        const ph = Math.acos(Math.random() * 2 - 1)
        const sp = 0.8 + Math.random() * 2.2
        sim.vel[k] = Math.sin(ph) * Math.cos(th) * sp
        sim.vel[k + 1] = Math.abs(Math.cos(ph)) * sp + 0.6
        sim.vel[k + 2] = Math.sin(ph) * Math.sin(th) * sp
        sim.life[i] = 0.7 + Math.random() * 0.7
        const cc = Math.random() < 0.5 ? c : w
        sim.col[k] = cc.r * 4
        sim.col[k + 1] = cc.g * 4
        sim.col[k + 2] = cc.b * 4
      }
    }
    let alive = false
    for (let i = 0; i < max; i++) {
      if (sim.life[i] <= 0) continue
      alive = true
      sim.life[i] -= dt
      const k = i * 3
      sim.vel[k + 1] -= 4.5 * dt
      sim.vel[k] *= 0.97
      sim.vel[k + 2] *= 0.97
      sim.pos[k] += sim.vel[k] * dt
      sim.pos[k + 1] += sim.vel[k + 1] * dt
      sim.pos[k + 2] += sim.vel[k + 2] * dt
      if (sim.life[i] <= 0) sim.pos[k + 1] = -100
    }
    ref.current.visible = alive
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial size={0.035} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} sizeAttenuation />
    </points>
  )
}

export function Cone() {
  const group = useRef<THREE.Group>(null!)
  const squash = useRef<THREE.Group>(null!)
  const scoop = useRef<THREE.Group>(null!)
  const ghosts = useRef<THREE.Group[]>([])
  const reduced = useMemo(prefersReducedMotion, [])

  const mats = useMemo(() => {
    const wafer = new THREE.MeshStandardMaterial({ map: waffleTexture(), roughness: 0.7, side: THREE.DoubleSide })
    const cream = new THREE.MeshPhysicalMaterial({ color: '#f6ead7', roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25, sheen: 0.5, sheenColor: new THREE.Color('#ffffff') })
    const ghost = [0.28, 0.16, 0.08].map((o) => new THREE.MeshBasicMaterial({ color: '#f6ead7', transparent: true, opacity: o, depthWrite: false }))
    return { wafer, cream, ghost }
  }, [])
  const scoopGeo = useMemo(lumpyScoop, [])
  const coneGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.056, CONE_H, 24, 1, true)
    g.rotateX(Math.PI)
    g.translate(0, CONE_H / 2, 0)
    return g
  }, [])

  const sim = useMemo(
    () => ({
      tiltX: new Spring1(0, 90, 0.35),
      tiltZ: new Spring1(0, 90, 0.35),
      history: Array.from({ length: 12 }, () => new THREE.Vector3()),
      head: 0,
      color: new THREE.Color(),
    }),
    [],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const g = group.current
    const base = 1.4
    g.position.copy(world.cone)
    g.visible = !world.coneHidden
    const v = world.coneVel
    // the cone leans into the swing
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, THREE.MathUtils.clamp(-v.x * 0.09, -0.6, 0.6), 14, dt)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, THREE.MathUtils.clamp(v.z * 0.09, -0.5, 0.5), 14, dt)

    // squash & stretch
    world.punchStretch = Math.max(0, world.punchStretch - dt / 0.08)
    const speed = v.length()
    const s = THREE.MathUtils.clamp(speed * 0.03, 0, 0.14) + world.punchStretch * 0.15
    squash.current.scale.set(base * (1 - s * 0.6), base * (1 + s), base * (1 - s * 0.6))

    // scoop lags on a secondary spring
    sim.tiltZ.step(THREE.MathUtils.clamp(-v.x * 0.12, -0.5, 0.5), dt)
    sim.tiltX.step(THREE.MathUtils.clamp(v.z * 0.12 + v.y * 0.05, -0.5, 0.5), dt)
    scoop.current.rotation.set(sim.tiltX.x, 0, sim.tiltZ.x)

    sim.color.set(world.scoopColor)
    mats.cream.color.lerp(sim.color, 1 - Math.exp(-dt * 8))

    // ghost trail
    sim.head = (sim.head + 1) % sim.history.length
    sim.history[sim.head].copy(world.cone)
    const showTrail = !reduced && world.dodging && speed > 1.2 && !world.coneHidden
    ghosts.current.forEach((gh, i) => {
      if (!gh) return
      gh.visible = showTrail
      if (!showTrail) return
      const idx = (sim.head - (i + 1) * 3 + sim.history.length * 2) % sim.history.length
      gh.position.copy(sim.history[idx])
      ;(mats.ghost[i] as THREE.MeshBasicMaterial).color.copy(mats.cream.color).multiplyScalar(1.4)
    })
  })

  return (
    <>
      <group ref={group}>
        <group ref={squash} scale={1.4}>
          <mesh geometry={coneGeo} material={mats.wafer} castShadow />
          <mesh position={[0, CONE_H, 0]} rotation-x={Math.PI / 2} material={mats.wafer}>
            <torusGeometry args={[0.056, 0.007, 8, 28]} />
          </mesh>
          <group ref={scoop} position={[0, CONE_H + 0.005, 0]}>
            <mesh geometry={scoopGeo} material={mats.cream} position={[0, SCOOP_R * 0.62, 0]} castShadow />
          </group>
        </group>
      </group>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => void (ghosts.current[i] = el!)} visible={false}>
          <mesh geometry={scoopGeo} material={mats.ghost[i]} position={[0, (CONE_H + SCOOP_R * 0.62) * 1.4, 0]} scale={1.4} />
        </group>
      ))}
      <Sparkles />
    </>
  )
}
