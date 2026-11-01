import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Spring3 } from '../game/springs'
import { troll } from '../game/troll'
import { world } from '../game/world'
import { useGame } from '../store/gameStore'

const TOUCH_OFFSET_PX = 60

// Pointer → invisible plane in front of the cart. Click (desktop) or lift finger (touch) to grab.
export function Hand() {
  const { camera, gl } = useThree()
  const ring = useRef<THREE.Group>(null!)
  const core = useRef<THREE.MeshBasicMaterial>(null!)
  const halo = useRef<THREE.MeshBasicMaterial>(null!)
  const sim = useMemo(
    () => ({
      spring: new Spring3(new THREE.Vector3(0, 1.3, world.planeZ), 420, 1),
      ray: new THREE.Raycaster(),
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -world.planeZ),
      lookPlane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -(world.planeZ + 2.5)),
      ndc: new THREE.Vector2(),
      hit: new THREE.Vector3(),
      hot: new THREE.Color('#ff3dac'),
      cold: new THREE.Color('#3df2ff'),
    }),
    [],
  )

  useEffect(() => {
    const el = gl.domElement
    const move = (e: PointerEvent) => {
      world.pointer = { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', down: world.pointer?.down ?? false }
    }
    const down = (e: PointerEvent) => {
      move(e)
      world.pointer!.down = true
      if (useGame.getState().phase !== 'troll') return
      // snap the hand under the finger on touch so the first tap feels direct
      if (e.pointerType !== 'mouse') sim.spring.v.set(0, 0, 0)
      else troll.grab()
    }
    const up = (e: PointerEvent) => {
      move(e)
      world.pointer!.down = false
      if (useGame.getState().phase === 'troll' && e.pointerType !== 'mouse') {
        // let the spring catch up to the finger first
        updateHand(true)
        troll.grab()
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])

  function project(plane: THREE.Plane, offsetPx: number) {
    const p = world.pointer!
    const r = gl.domElement.getBoundingClientRect()
    sim.ndc.set(((p.x - r.left) / r.width) * 2 - 1, -(((p.y - offsetPx - r.top) / r.height) * 2 - 1))
    sim.ray.setFromCamera(sim.ndc, camera)
    return sim.ray.ray.intersectPlane(plane, sim.hit)
  }

  function updateHand(snap = false) {
    if (!world.pointer) return
    const off = world.pointer.touch ? TOUCH_OFFSET_PX : 0
    if (project(sim.plane, off)) {
      world.handRaw.copy(sim.hit)
      if (snap) sim.spring.x.copy(sim.hit)
      world.hand.copy(snap ? sim.hit : world.hand)
    }
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const phase = useGame.getState().phase
    const playing = phase === 'troll'
    world.handVisible = playing && !!world.pointer

    if (world.pointer && project(sim.plane, world.pointer.touch ? TOUCH_OFFSET_PX : 0)) {
      world.handRaw.copy(sim.hit)
      sim.spring.step(sim.hit, dt)
      world.hand.copy(sim.spring.x)
    }
    // vendor looks where you point; otherwise at you
    if (playing && world.handVisible) world.lookTarget.lerp(world.hand, 1 - Math.exp(-dt * 10))
    else if (world.pointer && project(sim.lookPlane, 0)) world.lookTarget.lerp(sim.hit, 1 - Math.exp(-dt * 6))
    else world.lookTarget.lerp(camera.position, 1 - Math.exp(-dt * 4))

    world.handPulse = Math.max(0, world.handPulse - dt * 4)
    const g = ring.current
    g.visible = world.handVisible
    if (!g.visible) return
    g.position.copy(world.hand)
    g.quaternion.copy(camera.quaternion)
    const inReach = troll.catchable && troll.handDist() < troll.catchRadius
    const scale = (troll.catchRadius / 0.17) * (1 + world.handPulse * 0.6) * (inReach ? 1.15 : 1)
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, scale, 18, dt))
    const target = inReach ? sim.hot : sim.cold
    core.current.color.lerp(target.clone().multiplyScalar(3.2), 0.25)
    halo.current.color.lerp(target.clone().multiplyScalar(1.2), 0.25)
    halo.current.opacity = 0.18 + world.handPulse * 0.4
  })

  return (
    <group ref={ring} visible={false} renderOrder={10}>
      <mesh>
        <ringGeometry args={[0.072, 0.085, 48]} />
        <meshBasicMaterial ref={core} toneMapped={false} transparent depthTest={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.072, 48]} />
        <meshBasicMaterial ref={halo} toneMapped={false} transparent opacity={0.18} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.008, 16]} />
        <meshBasicMaterial color={[3, 3, 3]} toneMapped={false} depthTest={false} />
      </mesh>
    </group>
  )
}
