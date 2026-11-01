import { MeshReflectorMaterial, Text, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/gameStore'
import { NeonText, neonFont } from './Neon'
import { phUrls, tiled, type PBRSet, type PHId } from './textures'

const STREET_HALF = 3.2
const FLOOR_LEN = 44
const FLOOR_Z = -8

function Floor() {
  const reflector = useGame((s) => s.settings.reflector)
  const base = useTexture(phUrls('cobblestone_floor_08')) as PBRSet
  const t = useMemo(() => tiled(base, (STREET_HALF * 2) / 2.4, FLOOR_LEN / 2.4), [base])
  const normalScale = useMemo(() => new THREE.Vector2(1.1, 1.1), [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, FLOOR_Z]} receiveShadow>
      <planeGeometry args={[STREET_HALF * 2, FLOOR_LEN]} />
      {reflector ? (
        <MeshReflectorMaterial
          {...t}
          normalScale={normalScale}
          roughness={0.8}
          metalness={0.05}
          color="#6c747d"
          envMapIntensity={0.8}
          resolution={512}
          blur={[300, 90]}
          mixBlur={1.4}
          mixStrength={4}
          mixContrast={1}
          mirror={0.5}
          depthScale={0.7}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.3}
        />
      ) : (
        <meshStandardMaterial {...t} normalScale={normalScale} roughness={0.62} metalness={0.05} color="#6c747d" envMapIntensity={1.3} />
      )}
    </mesh>
  )
}

type Building = { z0: number; z1: number; h: number; color: string; inset: number; seed: number; tex: PHId }

// Istanbul houses: ochre, terracotta, rose and one washed-blue facade.
const LEFT: Building[] = [
  { z0: 9, z1: 3.2, h: 8.5, color: '#d9ad7f', inset: 0, seed: 1, tex: 'clay_plaster' },
  { z0: 3.2, z1: -2.6, h: 7.2, color: '#b9d2d4', inset: 0.15, seed: 2, tex: 'blue_plaster_weathered' },
  { z0: -2.6, z1: -8, h: 9.4, color: '#c98e70', inset: -0.05, seed: 3, tex: 'clay_plaster' },
  { z0: -8, z1: -15, h: 7.8, color: '#e4d2b4', inset: 0.1, seed: 4, tex: 'clay_plaster' },
]
const RIGHT: Building[] = [
  { z0: 9, z1: 4.4, h: 7.6, color: '#d7a59a', inset: 0.05, seed: 5, tex: 'clay_plaster' },
  { z0: 4.4, z1: -1.2, h: 9.0, color: '#ddb57c', inset: -0.05, seed: 6, tex: 'clay_plaster' },
  { z0: -1.2, z1: -7, h: 7.4, color: '#e6eef0', inset: 0.15, seed: 7, tex: 'blue_plaster_weathered' },
  { z0: -7, z1: -15, h: 8.8, color: '#cfb48e', inset: 0, seed: 8, tex: 'clay_plaster' },
]

// x of the wall surface on a side at depth z
export function faceX(side: 1 | -1, z: number) {
  const list = side < 0 ? LEFT : RIGHT
  const b = list.find((b) => z <= b.z0 && z > b.z1) ?? list[0]
  return side * (STREET_HALF - b.inset)
}

function Facades() {
  const clay = useTexture(phUrls('clay_plaster')) as PBRSet
  const blue = useTexture(phUrls('blue_plaster_weathered')) as PBRSet
  const mats = useMemo(
    () =>
      [...LEFT, ...RIGHT].map((b) => {
        const t = tiled(b.tex === 'clay_plaster' ? clay : blue, (b.z0 - b.z1) / 3, b.h / 3)
        const m = new THREE.MeshStandardMaterial({ ...t, color: b.color, roughness: 1, metalness: 0 })
        m.color.multiplyScalar(0.5) // night: walls sit in shadow, lamps make the pools
        return m
      }),
    [clay, blue],
  )
  const trim = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a4636', roughness: 0.85 }), [])
  const plinth = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b3533', roughness: 0.9 }), [])
  const blocks = [
    ...LEFT.map((b, i) => ({ b, side: -1, mat: mats[i] })),
    ...RIGHT.map((b, i) => ({ b, side: 1, mat: mats[LEFT.length + i] })),
  ]
  return (
    <group>
      {blocks.map(({ b, side, mat }, i) => {
        const len = b.z0 - b.z1
        const x = side * (STREET_HALF + 0.5 - b.inset)
        return (
          <group key={i}>
            <mesh position={[x, b.h / 2, (b.z0 + b.z1) / 2]} material={mat} receiveShadow>
              <boxGeometry args={[1, b.h, len]} />
            </mesh>
            {/* cornice */}
            <mesh position={[x - side * 0.56, b.h - 0.25, (b.z0 + b.z1) / 2]} material={trim}>
              <boxGeometry args={[0.2, 0.16, len]} />
            </mesh>
            {/* floor band */}
            <mesh position={[x - side * 0.52, 2.95, (b.z0 + b.z1) / 2]} material={trim}>
              <boxGeometry args={[0.08, 0.1, len]} />
            </mesh>
            {/* plinth */}
            <mesh position={[x - side * 0.52, 0.35, (b.z0 + b.z1) / 2]} material={plinth}>
              <boxGeometry args={[0.1, 0.7, len]} />
            </mesh>
          </group>
        )
      })}
      <Windows />
      <Balconies />
      <Cumbas />
    </group>
  )
}

// Warm window: curtains at the sides, mullion cross, a soft hot spot.
let winTex: THREE.Texture | null = null
function windowTexture() {
  if (winTex) return winTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 96
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(32, 56, 4, 32, 56, 60)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#6a6a6a')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 96)
  x.fillStyle = 'rgba(40,20,20,0.75)'
  x.beginPath()
  x.moveTo(0, 0)
  x.quadraticCurveTo(18, 40, 8, 96)
  x.lineTo(0, 96)
  x.fill()
  x.beginPath()
  x.moveTo(64, 0)
  x.quadraticCurveTo(46, 40, 56, 96)
  x.lineTo(64, 96)
  x.fill()
  x.fillStyle = '#111'
  x.fillRect(30, 0, 4, 96)
  x.fillRect(0, 34, 64, 4)
  winTex = new THREE.CanvasTexture(c)
  winTex.colorSpace = THREE.SRGBColorSpace
  return winTex
}

type Win = { pos: THREE.Vector3; rotY: number; w: number; h: number; kind: 0 | 1 | 2 }

function layoutWindows(): Win[] {
  const wins: Win[] = []
  let r = 11
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  const place = (list: Building[], side: number) => {
    for (const b of list) {
      const x = side * (STREET_HALF - b.inset) - side * 0.008
      const len = b.z0 - b.z1
      const cols = Math.max(2, Math.floor(len / 1.6))
      for (let f = 1; f * 2.6 + 1.6 < b.h; f++) {
        for (let c = 0; c < cols; c++) {
          const z = b.z0 - ((c + 0.5) * len) / cols
          const lit = rnd()
          wins.push({
            pos: new THREE.Vector3(x, f * 2.6 + 0.9, z),
            rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
            w: 0.8,
            h: 1.3,
            kind: lit > 0.74 ? 1 : lit > 0.71 ? 2 : 0,
          })
        }
      }
    }
  }
  place(LEFT, -1)
  place(RIGHT, 1)
  return wins
}

function Windows() {
  const wins = useMemo(layoutWindows, [])
  const litWindow = useMemo(windowTexture, [])
  const refs = [useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!)]
  const frameRef = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const counts = [0, 0, 0]
    wins.forEach((w, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), w.rotY)
      m.compose(w.pos, q, new THREE.Vector3(w.w, w.h, 1))
      refs[w.kind].current.setMatrixAt(counts[w.kind]++, m)
      const fp = w.pos.clone().add(new THREE.Vector3(Math.sign(w.pos.x) * 0.004, 0, 0))
      m.compose(fp, q, new THREE.Vector3(w.w + 0.16, w.h + 0.16, 1))
      frameRef.current.setMatrixAt(i, m)
    })
    refs.forEach((r, k) => {
      r.current.count = counts[k]
      r.current.instanceMatrix.needsUpdate = true
    })
    frameRef.current.instanceMatrix.needsUpdate = true
  }, [wins])
  return (
    <group>
      <instancedMesh ref={frameRef} args={[undefined, undefined, wins.length]}>
        <planeGeometry />
        <meshStandardMaterial color="#4a3426" roughness={0.7} />
      </instancedMesh>
      <instancedMesh ref={refs[0]} args={[undefined, undefined, wins.length]}>
        <planeGeometry />
        <meshStandardMaterial color="#0b1220" roughness={0.08} metalness={0.6} envMapIntensity={1.5} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
      <instancedMesh ref={refs[1]} args={[undefined, undefined, wins.length]}>
        <planeGeometry />
        <meshBasicMaterial map={litWindow} color={[1.35, 0.7, 0.28]} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
      <instancedMesh ref={refs[2]} args={[undefined, undefined, wins.length]}>
        <planeGeometry />
        <meshBasicMaterial map={litWindow} color={[0.12, 0.45, 0.48]} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
    </group>
  )
}

function Balconies() {
  const items = [
    { s: -1, y: 5.9, z: -5.2 },
    { s: 1, y: 3.3, z: -4.0 },
  ].map((b) => ({ x: faceX(b.s as 1 | -1, b.z), y: b.y, z: b.z }))
  return (
    <group>
      {items.map((b, i) => {
        const s = Math.sign(b.x)
        return (
          <group key={i} position={[b.x - s * 0.35, b.y, b.z]}>
            <mesh>
              <boxGeometry args={[0.7, 0.08, 1.8]} />
              <meshStandardMaterial color="#2a2830" roughness={0.6} />
            </mesh>
            <mesh position={[-s * 0.33, 0.45, 0]}>
              <boxGeometry args={[0.03, 0.04, 1.8]} />
              <meshStandardMaterial color="#1a1a1e" metalness={0.8} roughness={0.4} />
            </mesh>
            {Array.from({ length: 10 }).map((_, k) => (
              <mesh key={k} position={[-s * 0.33, 0.22, -0.85 + k * 0.19]}>
                <boxGeometry args={[0.02, 0.44, 0.02]} />
                <meshStandardMaterial color="#1a1a1e" metalness={0.8} roughness={0.4} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

// Ottoman "cumba": wooden bay windows hanging off the upper floors.
const CUMBAS = [
  { side: -1 as const, z: 6.0, y: 4.3, len: 2.6, color: '#7a4b2e' },
  { side: 1 as const, z: 1.6, y: 4.6, len: 2.4, color: '#3f6763' },
  { side: -1 as const, z: -5.0, y: 5.4, len: 2.2, color: '#83352b' },
]

function Cumbas() {
  const wood = useTexture(phUrls('fine_grained_wood')) as PBRSet
  const litWindow = useMemo(windowTexture, [])
  const mats = useMemo(
    () => CUMBAS.map((c) => new THREE.MeshStandardMaterial({ ...tiled(wood, c.len / 1.2, 1.5), color: c.color, roughness: 0.8 })),
    [wood],
  )
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0b1220', roughness: 0.08, metalness: 0.6, envMapIntensity: 1.5 }), [])
  const lit = useMemo(() => new THREE.MeshBasicMaterial({ map: litWindow, color: new THREE.Color(1.3, 0.68, 0.27), toneMapped: false }), [litWindow])
  const cap = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.7 }), [])
  return (
    <group>
      {CUMBAS.map((c, i) => {
        const face = faceX(c.side, c.z)
        const d = 0.62
        const front = face - c.side * (d + 0.002)
        const rotY = c.side > 0 ? -Math.PI / 2 : Math.PI / 2
        const n = Math.max(2, Math.round(c.len / 0.75))
        return (
          <group key={i}>
            <mesh position={[face - c.side * (d / 2), c.y, c.z]} material={mats[i]} castShadow receiveShadow>
              <boxGeometry args={[d, 1.9, c.len]} />
            </mesh>
            <mesh position={[face - c.side * (d / 2 + 0.02), c.y + 1.0, c.z]} material={cap}>
              <boxGeometry args={[d + 0.12, 0.1, c.len + 0.16]} />
            </mesh>
            <mesh position={[face - c.side * (d / 2 + 0.02), c.y - 0.98, c.z]} material={cap}>
              <boxGeometry args={[d + 0.08, 0.08, c.len + 0.1]} />
            </mesh>
            {/* corbels */}
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[face - c.side * 0.22, c.y - 1.2, c.z + (k * c.len) / 3]} rotation-z={c.side * 0.6} material={cap}>
                <boxGeometry args={[0.1, 0.5, 0.1]} />
              </mesh>
            ))}
            {Array.from({ length: n }).map((_, k) => (
              <mesh
                key={k}
                position={[front, c.y + 0.08, c.z - c.len / 2 + ((k + 0.5) * c.len) / n]}
                rotation-y={rotY}
                material={(i + k) % 3 === 0 ? lit : dark}
              >
                <planeGeometry args={[(c.len / n) * 0.72, 1.05]} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

function PaintedSign({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation-y={-Math.PI / 2}>
      <mesh position={[0, 0, -0.03]} castShadow>
        <boxGeometry args={[1.8, 0.5, 0.05]} />
        <meshStandardMaterial color="#1f3d3a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, -0.035]}>
        <boxGeometry args={[1.88, 0.58, 0.04]} />
        <meshStandardMaterial color="#b98a3e" metalness={0.8} roughness={0.35} />
      </mesh>
      <Text font={neonFont} fontSize={0.19} position={[0, 0.01, 0.0]} anchorX="center" anchorY="middle" color="#f1e2c0">
        Pamuk Pastanesi
      </Text>
    </group>
  )
}

// Soft visible beam under a lamp: additive cone, brightest at the bulb, fading at the edges.
const coneMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color('#ffb067') }, uStrength: { value: 0.16 } },
  vertexShader: `
    varying float vH; varying vec3 vN; varying vec3 vV;
    void main() {
      vH = 1.0 - uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying float vH; varying vec3 vN; varying vec3 vV;
    uniform vec3 uColor; uniform float uStrength;
    void main() {
      float edge = pow(abs(dot(vN, vV)), 2.0);
      float fall = pow(1.0 - vH, 2.2);
      gl_FragColor = vec4(uColor * edge * fall * uStrength, 1.0);
    }`,
})

export function LightCone({ height, radius, ...rest }: { height: number; radius: number; position?: [number, number, number] }) {
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(radius, height, 32, 1, true)
    g.translate(0, -height / 2, 0)
    return g
  }, [height, radius])
  return <mesh geometry={geo} material={coneMat} {...rest} renderOrder={5} />
}

function ClosedShop() {
  const base = useTexture(phUrls('painted_metal_shutter')) as PBRSet
  const t = useMemo(() => tiled(base, 1.6, 1.3), [base])
  return (
    <group position={[faceX(-1, -0.2) + 0.02, 0, -0.2]} rotation-y={Math.PI / 2}>
      <mesh position={[0, 1.3, 0]}>
        <planeGeometry args={[3.2, 2.6]} />
        <meshStandardMaterial {...t} color="#8fb3b0" roughness={1} metalness={0.4} envMapIntensity={1} />
      </mesh>
      <mesh position={[0, 2.75, 0.05]}>
        <boxGeometry args={[3.5, 0.32, 0.12]} />
        <meshStandardMaterial color="#1b2430" roughness={0.6} />
      </mesh>
      <NeonText text="Kapalı" color="#3df2ff" size={0.24} intensity={2.4} flicker position={[0, 2.75, 0.13]} />
    </group>
  )
}

function OpenShop() {
  // warm little lokanta on the right with a lit display window
  return (
    <group position={[faceX(1, 2.6) - 0.02, 0, 2.6]} rotation-y={-Math.PI / 2}>
      <mesh position={[0, 1.2, 0]}>
        <planeGeometry args={[2.2, 1.7]} />
        <meshBasicMaterial map={windowTexture()} color={[0.95, 0.52, 0.2]} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.2, 0.02]}>
        <planeGeometry args={[2.3, 1.8]} />
        <meshStandardMaterial color="#000" transparent opacity={0.25} roughness={0.05} metalness={1} />
      </mesh>
      {[-0.55, 0, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.2, 0.03]}>
          <boxGeometry args={[0.04, 1.8, 0.04]} />
          <meshStandardMaterial color="#2a1a10" />
        </mesh>
      ))}
      <mesh position={[0, 2.3, 0.15]} rotation-x={0.5}>
        <boxGeometry args={[2.6, 0.04, 0.6]} />
        <meshStandardMaterial color="#1e4a4a" roughness={0.6} />
      </mesh>
      <pointLight position={[0, 1.4, 0.8]} color="#ffae5a" intensity={3} distance={4} decay={2} />
    </group>
  )
}

// Catenary string lights across the street.
function StringLights() {
  const strands = useMemo(() => {
    const out: { curve: THREE.CatmullRomCurve3; bulbs: THREE.Vector3[] }[] = []
    const defs = [
      { z: 3.2, y0: 4.3, y1: 4.0 },
      { z: 0.4, y0: 4.6, y1: 4.4 },
      { z: -2.6, y0: 4.1, y1: 4.5 },
      { z: -5.8, y0: 4.6, y1: 4.2 },
      { z: -9.2, y0: 4.3, y1: 4.4 },
    ]
    for (const d of defs) {
      const pts: THREE.Vector3[] = []
      const n = 24
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const x = -STREET_HALF + t * STREET_HALF * 2
        const sag = Math.sin(t * Math.PI) * 0.65
        pts.push(new THREE.Vector3(x, THREE.MathUtils.lerp(d.y0, d.y1, t) - sag, d.z + Math.sin(t * Math.PI) * 0.2))
      }
      const curve = new THREE.CatmullRomCurve3(pts)
      const bulbs = Array.from({ length: 13 }, (_, i) => curve.getPointAt((i + 0.5) / 13).add(new THREE.Vector3(0, -0.06, 0)))
      out.push({ curve, bulbs })
    }
    return out
  }, [])
  const bulbRef = useRef<THREE.InstancedMesh>(null!)
  const total = strands.reduce((a, s) => a + s.bulbs.length, 0)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    let i = 0
    const c = new THREE.Color()
    for (const s of strands)
      for (const b of s.bulbs) {
        m.makeTranslation(b.x, b.y, b.z)
        bulbRef.current.setMatrixAt(i, m)
        const warm = 0.85 + Math.random() * 0.3
        c.setRGB(3.2 * warm, 1.7 * warm, 0.7 * warm)
        bulbRef.current.setColorAt(i++, c)
      }
    bulbRef.current.instanceMatrix.needsUpdate = true
    if (bulbRef.current.instanceColor) bulbRef.current.instanceColor.needsUpdate = true
  }, [strands])
  const wireMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.6 }), [])
  return (
    <group>
      {strands.map((s, i) => (
        <mesh key={i} material={wireMat}>
          <tubeGeometry args={[s.curve, 40, 0.008, 4, false]} />
        </mesh>
      ))}
      <instancedMesh ref={bulbRef} args={[undefined, undefined, total]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

function Skyline() {
  // Distant mosque silhouette on a hill, a moon, and a gradient sky. All unlit, no fog.
  const sky = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const x = c.getContext('2d')!
    const g = x.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#02060b')
    g.addColorStop(0.5, '#08192a')
    g.addColorStop(0.8, '#123447')
    g.addColorStop(1, '#2b4652')
    x.fillStyle = g
    x.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const dome = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * (Math.PI / 2)
      pts.push(new THREE.Vector2(Math.cos(a) * 6, Math.sin(a) * 5.2))
    }
    return pts
  }, [])
  const sil = '#06111a'
  const minaret = (x: number) => (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 9, 0]}>
        <cylinderGeometry args={[0.45, 0.55, 18, 10]} />
        <meshBasicMaterial color={sil} fog={false} />
      </mesh>
      <mesh position={[0, 14.5, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.3, 12]} />
        <meshBasicMaterial color={sil} fog={false} />
      </mesh>
      <mesh position={[0, 19.5, 0]}>
        <coneGeometry args={[0.5, 3, 10]} />
        <meshBasicMaterial color={sil} fog={false} />
      </mesh>
    </group>
  )
  return (
    <group>
      <mesh position={[0, 20, -80]}>
        <planeGeometry args={[220, 70]} />
        <meshBasicMaterial map={sky} fog={false} depthWrite={false} />
      </mesh>
      <mesh position={[14, 24, -78]}>
        <circleGeometry args={[2.6, 40]} />
        <meshBasicMaterial color={[1.7, 1.55, 1.2]} toneMapped={false} fog={false} />
      </mesh>
      <group position={[-3, 5, -60]}>
        <mesh position={[0, -3, 0]}>
          <boxGeometry args={[60, 8, 2]} />
          <meshBasicMaterial color="#050d15" fog={false} />
        </mesh>
        <mesh position={[0, 3.6, 0]}>
          <latheGeometry args={[dome, 24]} />
          <meshBasicMaterial color={sil} fog={false} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <cylinderGeometry args={[6.4, 6.6, 3.6, 16]} />
          <meshBasicMaterial color={sil} fog={false} />
        </mesh>
        {[-7.5, 7.5].map((x) => (
          <mesh key={x} position={[x, 1.6, 1]}>
            <sphereGeometry args={[2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={sil} fog={false} />
          </mesh>
        ))}
        {minaret(-11)}
        {minaret(11)}
        <mesh position={[0, 9.4, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.4, 4]} />
          <meshBasicMaterial color={sil} fog={false} />
        </mesh>
      </group>
    </group>
  )
}

function BackWall() {
  const base = useTexture(phUrls('clay_plaster')) as PBRSet
  const t = useMemo(() => tiled(base, 2.5, 1.3), [base])
  return (
    <group position={[0, 0, -15]}>
      <mesh position={[0, 1.9, 0]} receiveShadow>
        <boxGeometry args={[STREET_HALF * 2 + 2, 3.8, 1]} />
        <meshStandardMaterial {...t} color="#5e483a" roughness={1} />
      </mesh>
      <mesh position={[1.9, 1.5, 0.51]}>
        <planeGeometry args={[1.2, 1.0]} />
        <meshBasicMaterial map={windowTexture()} color={[1.0, 0.5, 0.2]} toneMapped={false} />
      </mesh>
    </group>
  )
}

// Lamp on the left wall: classic iron bracket, warm glow.
function WallLamp({ position, side }: { position: [number, number, number]; side: 1 | -1 }) {
  const glow = useRef<THREE.PointLight>(null!)
  useFrame(({ clock }) => {
    glow.current.intensity = 7 + Math.sin(clock.elapsedTime * 11) * 0.2
  })
  return (
    <group position={position}>
      <mesh position={[-side * 0.25, 0, 0]}>
        <boxGeometry args={[0.5, 0.03, 0.03]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[-side * 0.5, -0.15, 0]}>
        <cylinderGeometry args={[0.07, 0.12, 0.28, 6]} />
        <meshStandardMaterial color="#111" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[-side * 0.5, -0.2, 0]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshBasicMaterial color={[3, 1.6, 0.6]} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[-side * 0.5, -0.35, 0]} color="#ffa552" distance={7} decay={2} />
      <LightCone position={[-side * 0.5, -0.25, 0]} height={2.9} radius={1.1} />
    </group>
  )
}

export function Street() {
  return (
    <group>
      <Floor />
      <Facades />
      <ClosedShop />
      <OpenShop />
      <StringLights />
      <BackWall />
      <Skyline />
      <WallLamp position={[faceX(1, -3.6), 3.1, -3.6]} side={1} />
      <WallLamp position={[faceX(-1, 4.6), 3.1, 4.6]} side={-1} />
      <PaintedSign position={[faceX(1, -2.6) - 0.06, 3.7, -2.6]} />
    </group>
  )
}
