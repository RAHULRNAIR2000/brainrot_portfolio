import { RoundedBox, Text, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { world } from '../game/world'
import { NeonText, neonFont } from './Neon'
import { LightCone } from './Street'
import { awningTexture, phUrls, tiled, woodTexture, type PBRSet } from './textures'

export const brass = new THREE.MeshStandardMaterial({ color: '#d4a24c', metalness: 1, roughness: 0.26, envMapIntensity: 1.4 })
const darkBrass = new THREE.MeshStandardMaterial({ color: '#8d6526', metalness: 1, roughness: 0.4 })
const steel = new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 1, roughness: 0.18 })
const goldLeaf = new THREE.MeshStandardMaterial({ color: '#f0c56a', metalness: 0.5, roughness: 0.35, emissive: '#b5791f', emissiveIntensity: 0.55 })

let mats: ReturnType<typeof makeMats> | null = null
function useMaterials() {
  if (!mats) mats = makeMats()
  return mats
}
function makeMats() {
  return (() => {
    const wood = new THREE.MeshPhysicalMaterial({
      map: woodTexture(),
      color: '#c27a4a',
      roughness: 0.55,
      clearcoat: 0.5,
      clearcoatRoughness: 0.35,
    })
    const lacquer = new THREE.MeshPhysicalMaterial({ color: '#0e4a4b', roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06 })
    const tex = awningTexture().clone()
    tex.needsUpdate = true
    tex.repeat.set(3, 1)
    const awning = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })
    const iceCream = new THREE.MeshPhysicalMaterial({ color: '#f7f1e3', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.4 })
    const wafer = new THREE.MeshStandardMaterial({ color: '#c98a3b', roughness: 0.75 })
    return { wood, lacquer, awning, iceCream, wafer }
  })()
}

function Wheel({ x }: { x: number }) {
  const { wood } = useMaterials()
  return (
    <group position={[x, 0.4, 0]} rotation-y={Math.PI / 2}>
      <mesh material={brass} castShadow>
        <torusGeometry args={[0.37, 0.03, 10, 40]} />
      </mesh>
      <mesh material={wood}>
        <torusGeometry args={[0.34, 0.025, 8, 36]} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} rotation-z={(i / 10) * Math.PI} material={wood}>
          <boxGeometry args={[0.68, 0.025, 0.025]} />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2} material={brass}>
        <cylinderGeometry args={[0.07, 0.07, 0.12, 16]} />
      </mesh>
    </group>
  )
}

// Ornate brass lid, the signature of a Maraş dondurma cart.
function BrassDome({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const profile = useMemo(() => {
    const p: [number, number][] = [
      [0.0, 0.0], [0.2, 0.0], [0.21, 0.03], [0.19, 0.05], [0.19, 0.12], [0.17, 0.2], [0.13, 0.27],
      [0.08, 0.31], [0.05, 0.33], [0.04, 0.36], [0.06, 0.38], [0.04, 0.41], [0.02, 0.46], [0.0, 0.48],
    ]
    return p.map(([x, y]) => new THREE.Vector2(x, y))
  }, [])
  return (
    <group position={position} scale={scale}>
      <mesh material={brass} castShadow>
        <latheGeometry args={[profile, 32]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={brass}>
        <sphereGeometry args={[0.03, 12, 10]} />
      </mesh>
    </group>
  )
}

function Valance({ width, position, rotationY = 0 }: { width: number; position: [number, number, number]; rotationY?: number }) {
  const { awning } = useMaterials()
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    const h = 0.16
    const n = Math.round(width / 0.19)
    const r = width / n / 2
    s.moveTo(-width / 2, 0)
    s.lineTo(width / 2, 0)
    s.lineTo(width / 2, -h)
    for (let i = n - 1; i >= 0; i--) {
      const cx = -width / 2 + (i + 0.5) * r * 2
      s.absarc(cx, -h, r, 0, -Math.PI, true)
    }
    s.lineTo(-width / 2, 0)
    const g = new THREE.ShapeGeometry(s, 6)
    const uv = g.attributes.uv as THREE.BufferAttribute
    const pos = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, ((pos.getX(i) + width / 2) / width) * (width / 0.6), (pos.getY(i) + 0.26) / 0.26)
    return g
  }, [width])
  return <mesh geometry={geo} material={awning} position={position} rotation-y={rotationY} castShadow />
}

function Bell() {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    // swings when the cone is flying around
    const target = world.dodging ? Math.sin(clock.elapsedTime * 14) * 0.35 : Math.sin(clock.elapsedTime * 1.3) * 0.04
    ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, target, 0.12)
  })
  return (
    <group position={[0.86, 2.08, 0.44]}>
      <group ref={ref}>
        <mesh position={[0, -0.06, 0]} material={darkBrass}>
          <cylinderGeometry args={[0.004, 0.004, 0.12, 4]} />
        </mesh>
        <mesh position={[0, -0.16, 0]} material={brass} castShadow>
          <latheGeometry
            args={[[new THREE.Vector2(0, 0.08), new THREE.Vector2(0.03, 0.075), new THREE.Vector2(0.045, 0.03), new THREE.Vector2(0.07, -0.02), new THREE.Vector2(0.075, -0.03)], 20]}
          />
        </mesh>
      </group>
    </group>
  )
}

function ConeStack() {
  const { wafer } = useMaterials()
  return (
    <group position={[0.72, 1.1, 0.24]}>
      <mesh material={steel}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 16, 1, true]} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, 0.12 + i * 0.03, 0]} rotation-x={Math.PI} material={wafer}>
          <coneGeometry args={[0.055, 0.2, 14, 1, true]} />
        </mesh>
      ))}
    </group>
  )
}

function MenuSign() {
  // A-frame chalkboard on the street, decorative twin of the HTML menu.
  return (
    <group position={[-1.55, 0, 1.0]} rotation-y={0.35}>
      <group rotation-x={-0.16}>
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[0.72, 1.0, 0.04]} />
          <meshStandardMaterial color="#3a2414" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.62, 0.021]}>
          <planeGeometry args={[0.62, 0.9]} />
          <meshStandardMaterial color="#141a1c" roughness={0.95} />
        </mesh>
        <NeonText text="Menu" color="#ffb347" size={0.13} intensity={2.4} position={[0, 0.95, 0.03]} />
        {['Pistachio', 'Saffron', 'Caramel', 'Ripple', 'Coconut'].map((t, i) => (
          <Text key={t} font={neonFont} fontSize={0.055} color="#e9e2d4" position={[0, 0.8 - i * 0.1, 0.025]} anchorX="center">
            {t}
          </Text>
        ))}
      </group>
      <mesh position={[0, 0.5, -0.18]} rotation-x={0.25}>
        <boxGeometry args={[0.66, 1.0, 0.03]} />
        <meshStandardMaterial color="#3a2414" roughness={0.7} />
      </mesh>
    </group>
  )
}

export function Stall({ signPower }: { signPower: { current: number } }) {
  const { wood, lacquer, iceCream } = useMaterials()
  const woodSet = useTexture(phUrls('fine_grained_wood')) as PBRSet
  useMemo(() => {
    const t = tiled(woodSet, 1.4, 1)
    Object.assign(wood, t)
    wood.color.set('#b77a52')
    wood.roughness = 1
    wood.needsUpdate = true
  }, [woodSet, wood])
  const mound = useMemo(() => {
    const g = new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const n = Math.sin(x * 40) * Math.cos(z * 37) * 0.012 + Math.sin(x * 13 + z * 9) * 0.02
      p.setY(i, p.getY(i) * 0.7 + n * (p.getY(i) > 0.01 ? 1 : 0))
    }
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <group>
      <Wheel x={-0.96} />
      <Wheel x={0.96} />
      {/* body */}
      <RoundedBox args={[1.72, 0.78, 0.84]} radius={0.04} smoothness={3} position={[0, 0.66, 0]} material={wood} castShadow receiveShadow />
      {/* red lacquer front panel with gold lettering */}
      <mesh position={[0, 0.66, 0.425]} material={lacquer}>
        <planeGeometry args={[1.5, 0.56]} />
      </mesh>
      {[0.95, 0.37].map((y) => (
        <mesh key={y} position={[0, y, 0.43]} material={brass}>
          <boxGeometry args={[1.56, 0.025, 0.02]} />
        </mesh>
      ))}
      {[-0.77, 0.77].map((x) => (
        <mesh key={x} position={[x, 0.66, 0.43]} material={brass}>
          <boxGeometry args={[0.025, 0.6, 0.02]} />
        </mesh>
      ))}
      <Text font={neonFont} fontSize={0.17} position={[0, 0.69, 0.44]} anchorX="center" anchorY="middle" material={goldLeaf}>
        Maraş Dondurması
      </Text>
      <Text fontSize={0.045} letterSpacing={0.3} position={[0, 0.48, 0.44]} anchorX="center" material={goldLeaf}>
        SİNCE 1923 · İSTANBUL
      </Text>
      {/* counter top */}
      <mesh position={[0, 1.07, 0]} material={steel} receiveShadow castShadow>
        <boxGeometry args={[1.8, 0.04, 0.9]} />
      </mesh>
      <mesh position={[0, 1.07, 0.452]} material={brass}>
        <boxGeometry args={[1.82, 0.05, 0.02]} />
      </mesh>
      {/* lids and the open tub */}
      <BrassDome position={[-0.6, 1.09, -0.05]} />
      <BrassDome position={[0.58, 1.09, -0.12]} scale={0.85} />
      <group position={[-0.05, 1.09, -0.1]}>
        <mesh material={steel}>
          <cylinderGeometry args={[0.24, 0.22, 0.06, 32, 1, true]} />
        </mesh>
        <mesh material={brass} position={[0, 0.03, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.24, 0.014, 8, 40]} />
        </mesh>
        <mesh geometry={mound} material={iceCream} position={[0, 0.0, 0]} castShadow />
      </group>
      <ConeStack />
      {/* posts */}
      {[
        [-0.88, 0.44],
        [0.88, 0.44],
        [-0.88, -1.0],
        [0.88, -1.0],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, z > 0 ? 1.65 : 1.24, 0]} material={brass} castShadow>
            <cylinderGeometry args={[0.022, 0.022, z > 0 ? 1.15 : 2.48, 10]} />
          </mesh>
          <mesh position={[0, z > 0 ? 2.24 : 2.49, 0]} material={brass}>
            <sphereGeometry args={[0.04, 12, 10]} />
          </mesh>
        </group>
      ))}
      {/* awning roof: slopes down toward the street */}
      <group position={[0, 2.36, -0.28]} rotation-x={0.12}>
        <mesh material={useMaterials().awning} castShadow>
          <boxGeometry args={[2.0, 0.025, 1.65]} />
        </mesh>
      </group>
      <Valance width={2.0} position={[0, 2.27, 0.545]} />
      <Valance width={1.65} position={[-1.0, 2.33, -0.28]} rotationY={-Math.PI / 2} />
      <Valance width={1.65} position={[1.0, 2.33, -0.28]} rotationY={Math.PI / 2} />
      {/* neon sign above the awning */}
      <group position={[0, 2.78, 0.2]}>
        <mesh position={[0, 0, -0.04]}>
          <boxGeometry args={[1.7, 0.42, 0.04]} />
          <meshStandardMaterial color="#090b14" roughness={0.4} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.23, -0.04]} material={brass}>
          <boxGeometry args={[1.74, 0.02, 0.05]} />
        </mesh>
        {[-0.6, 0.6].map((x) => (
          <mesh key={x} position={[x, -0.32, -0.04]} material={brass}>
            <cylinderGeometry args={[0.012, 0.012, 0.2, 6]} />
          </mesh>
        ))}
        <NeonText text="Dondurma" color="#ff3dac" size={0.27} intensity={5} power={signPower} />
      </group>
      <LightCone position={[0, 2.06, 0.3]} height={1.05} radius={0.75} />
      {/* hanging bulb under the awning: motivates the key light */}
      <group position={[0.0, 2.08, 0.3]}>
        <mesh position={[0, 0.1, 0]} material={darkBrass}>
          <cylinderGeometry args={[0.004, 0.004, 0.2, 4]} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.04, 12, 10]} />
          <meshBasicMaterial color={[4, 2.4, 1.1]} toneMapped={false} />
        </mesh>
      </group>
      <Bell />
      <MenuSign />
    </group>
  )
}
