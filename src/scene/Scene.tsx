import { AdaptiveDpr, Environment, Lightformer, PerformanceMonitor, useProgress } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useGame } from '../store/gameStore'
import { CameraRig } from './CameraRig'
import { Cat } from './Cat'
import { Cone } from './Cone'
import { Director } from './Director'
import { Effects } from './Effects'
import { Hand } from './Hand'
import { Stall } from './Stall'
import { Street } from './Street'
import { VendorSlot } from './VendorModel'

function Lights() {
  const shadows = useGame((s) => s.settings.shadows)
  const mapSize = useGame((s) => s.settings.shadowMap)
  const tier = useGame((s) => s.settings.tier)
  const key = useRef<THREE.SpotLight>(null!)
  const front = useRef<THREE.SpotLight>(null!)
  const { scene } = useThree()
  useLayoutEffect(() => {
    key.current.target.position.set(0, 1.55, -0.7)
    front.current.target.position.set(-0.1, 1.45, 0.2)
    scene.add(key.current.target, front.current.target)
    return () => void scene.remove(key.current.target, front.current.target)
  }, [scene])
  return (
    <>
      <hemisphereLight args={['#1f4a5c', '#0a0706', 0.18]} />
      {/* moonlight rim from behind */}
      <directionalLight position={[-4, 9, -10]} intensity={0.45} color="#8fc7d6" />
      {/* key: warm bulb under the awning onto the vendor's face */}
      <spotLight
        ref={key}
        position={[0.05, 2.06, 0.32]}
        angle={1.05}
        penumbra={0.75}
        intensity={6}
        distance={7}
        decay={2}
        color="#ffb070"
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* soft front light so the cone and the vendor's face read from the visitor's side */}
      <spotLight ref={front} position={[0.9, 2.6, 3.2]} angle={0.55} penumbra={1} intensity={14} distance={9} decay={2} color="#ffd6b0" />
      {/* fill from the street, cool teal */}
      <pointLight position={[-1.8, 2.2, 3.4]} intensity={2.6} distance={9} decay={2} color="#4fb8c4" />
      {/* neon spill */}
      <pointLight position={[0, 2.85, 0.6]} intensity={1.8} distance={4} decay={2} color="#ff4fb0" />
      {tier !== 'low' && (
        <>
          {/* string lights */}
          <pointLight position={[0, 3.7, 0.6]} intensity={4} distance={8} decay={2} color="#ffa54f" />
          <pointLight position={[0, 3.6, -5.6]} intensity={5} distance={9} decay={2} color="#ff9a45" />
          <pointLight position={[-2.6, 2.6, -0.2]} intensity={1.6} distance={4} decay={2} color="#3fd9e0" />
        </>
      )}
    </>
  )
}

function Reflections() {
  // Real night-street HDRI (Poly Haven, CC0) plus a few lightformers so brass and glass catch the neon.
  return (
    <Environment files="/hdri/cobblestone_street_night_1k.hdr" resolution={256} frames={1} environmentIntensity={0.16}>
      <Lightformer form="rect" intensity={2} color="#ff4fb0" position={[0, 3, 2]} scale={[3, 0.4, 1]} />
      <Lightformer form="rect" intensity={4} color="#ffae5a" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 1, 1]} />
      <Lightformer form="circle" intensity={2} color="#ffb27a" position={[3, 2, 3]} scale={1.5} />
    </Environment>
  )
}

// Fires once everything inside the Suspense boundary has loaded and no file is still downloading.
function Ready({ onReady }: { onReady: () => void }) {
  const active = useProgress((s) => s.active)
  useEffect(() => {
    if (active) return
    const id = requestAnimationFrame(() => requestAnimationFrame(onReady))
    return () => cancelAnimationFrame(id)
  }, [active, onReady])
  return null
}

// Real download progress for the loading screen (which lives outside this lazy chunk).
function useLoadReport() {
  const { loaded, total, item } = useProgress()
  useEffect(() => useGame.setState({ load: { loaded, total, item } }), [loaded, total, item])
}

function useTabVisible() {
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const on = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

export function Scene({ onReady }: { onReady: () => void }) {
  const settings = useGame((s) => s.settings)
  const downgrade = useGame((s) => s.downgrade)
  const visible = useTabVisible()
  const signPower = useRef({ current: 0 }).current
  useLoadReport()

  return (
    <Canvas
      className="!fixed inset-0"
      shadows={settings.shadows ? 'soft' : false}
      dpr={settings.dpr}
      frameloop={visible ? 'always' : 'never'}
      gl={{ antialias: settings.tier === 'low', powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 40, position: [0, 2.9, 14.5], near: 0.1, far: 160 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.AgXToneMapping
        gl.toneMappingExposure = 1.0
      }}
    >
      <color attach="background" args={['#05070f']} />
      <fogExp2 attach="fog" args={['#07121a', 0.045]} />
      <Director signPower={signPower} />
      <CameraRig />
      <Lights />
      <Suspense fallback={null}>
        <Reflections />
        <Street />
        <Stall signPower={signPower} />
        <VendorSlot />
        <Cone />
        <Cat />
        <Hand />
        <Effects />
        <Ready onReady={onReady} />
      </Suspense>
      <PerformanceMonitor onDecline={downgrade} flipflops={2} />
      <AdaptiveDpr pixelated={false} />
    </Canvas>
  )
}
