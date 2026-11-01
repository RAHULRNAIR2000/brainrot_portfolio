import { Text } from '@react-three/drei'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import pacifico from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url'

export const neonFont = pacifico

type Props = {
  text: string
  color: string
  size?: number
  intensity?: number
  flicker?: boolean
  // 0..1 power; lets the loader/intro switch the sign on
  power?: { current: number }
} & ThreeElements['group']

// Tube-like neon: bright core + soft halo, both unlit so bloom picks them up.
export function NeonText({ text, color, size = 0.4, intensity = 4, flicker, power, ...rest }: Props) {
  const core = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  const halo = useMemo(
    () => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.35, depthWrite: false }),
    [],
  )
  const base = useMemo(() => new THREE.Color(color), [color])
  const seed = useRef(Math.random() * 100)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed.current
    let k = power ? power.current : 1
    if (flicker) {
      // mostly steady with the odd stutter
      const s = Math.sin(t * 2.3) + Math.sin(t * 7.1) * 0.5 + Math.sin(t * 13.7) * 0.3
      if (s > 1.45) k *= 0.25
    }
    core.color.copy(base).multiplyScalar(intensity * k + 0.05)
    halo.color.copy(base).multiplyScalar(intensity * 0.6 * k)
    halo.opacity = 0.35 * k
  })

  return (
    <group {...rest}>
      <Text font={pacifico} fontSize={size} material={halo} outlineWidth={size * 0.12} outlineBlur={size * 0.25} outlineColor={color} outlineOpacity={0.6} anchorX="center" anchorY="middle">
        {text}
      </Text>
      <Text font={pacifico} fontSize={size} material={core} position={[0, 0, 0.005]} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  )
}
