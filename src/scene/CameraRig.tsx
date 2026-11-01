import { advance, useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { world } from '../game/world'
import { useGame, type Phase } from '../store/gameStore'
import { prefersReducedMotion } from '../utils/deviceTier'

type Shot = { pos: [number, number, number]; target: [number, number, number] }

export function shotFor(phase: Phase, portrait: boolean): Shot {
  switch (phase) {
    case 'loading':
    case 'gate':
      return { pos: [0, 2.9, 14.5], target: [0, 2.0, 0] }
    case 'intro':
      return portrait ? { pos: [0, 1.8, 6.2], target: [0, 1.5, 0] } : { pos: [0, 1.75, 4.8], target: [0, 1.55, 0] }
    case 'menu':
      return portrait ? { pos: [0, 2.0, 6.6], target: [0, 0.82, 0] } : { pos: [0.2, 1.9, 5.9], target: [0, 1.4, 0] }
    case 'troll':
      return portrait ? { pos: [0, 1.66, 4.9], target: [0, 1.5, 0] } : { pos: [0, 1.76, 5.0], target: [0, 1.58, 0] }
    case 'reward':
      return portrait ? { pos: [0, 1.5, 4.0], target: [0, 1.35, 0.6] } : { pos: [0, 1.5, 3.0], target: [0, 1.38, 0.6] }
    case 'story':
    case 'final':
      return portrait ? { pos: [0, 1.85, 5.2], target: [0, 1.25, 0] } : { pos: [-0.9, 1.7, 4.4], target: [-0.6, 1.45, 0] }
  }
}

export function CameraRig() {
  const { camera, size } = useThree()
  const phase = useGame((s) => s.phase)
  const portrait = size.width / size.height < 0.8
  const reduced = useMemo(prefersReducedMotion, [])
  const rig = useMemo(() => {
    const s = shotFor('loading', portrait)
    return { px: s.pos[0], py: s.pos[1], pz: s.pos[2], tx: s.target[0], ty: s.target[1], tz: s.target[2], shift: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), par: new THREE.Vector2(), dir: new THREE.Vector3() }), [])

  useEffect(() => {
    const s = shotFor(phase, portrait)
    const intro = phase === 'intro'
    const tween = gsap.to(rig, {
      px: s.pos[0],
      py: s.pos[1],
      pz: s.pos[2],
      tx: s.target[0],
      ty: s.target[1],
      tz: s.target[2],
      shift: phase === 'menu' && !portrait ? 1 : 0,
      duration: reduced ? 0.6 : intro ? 5.2 : phase === 'reward' ? 0.7 : 1.3,
      ease: intro ? 'power2.inOut' : 'power3.inOut',
      overwrite: true,
    })
    return () => void tween.kill()
  }, [phase, portrait, rig, reduced])

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __rig: { rig, camera, advance } })
  }, [rig, camera])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = clock.elapsedTime
    const cam = camera as THREE.PerspectiveCamera
    const fov = portrait ? 50 : 40
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    // slide the frame left while the desktop menu panel covers the right side
    const shiftPx = size.width >= 640 ? rig.shift * 215 : 0
    if (shiftPx > 0.5) cam.setViewOffset(size.width, size.height, shiftPx, 0, size.width, size.height)
    else if (cam.view?.enabled) cam.clearViewOffset()
    tmp.pos.set(rig.px, rig.py, rig.pz)
    tmp.target.set(rig.tx, rig.ty, rig.tz)

    // pointer parallax (desktop pointer, or finger drag on touch)
    const p = world.pointer
    const px = p && (!p.touch || p.down) ? (p.x / size.width - 0.5) * 2 : 0
    const py = p && (!p.touch || p.down) ? (p.y / size.height - 0.5) * 2 : 0
    const amt = useGame.getState().phase === 'troll' ? 0.05 : 0.14
    tmp.par.x = THREE.MathUtils.damp(tmp.par.x, px * amt, 3, dt)
    tmp.par.y = THREE.MathUtils.damp(tmp.par.y, -py * amt * 0.5, 3, dt)
    tmp.pos.x += tmp.par.x
    tmp.pos.y += tmp.par.y

    // idle sway (~0.5 degree)
    if (!reduced) {
      tmp.target.x += Math.sin(t * 0.31) * 0.03
      tmp.target.y += Math.sin(t * 0.47) * 0.02
    }
    // win punch-in
    world.punch = Math.max(0, world.punch - dt * 2.2)
    if (world.punch > 0) {
      tmp.dir.subVectors(tmp.target, tmp.pos).normalize()
      tmp.pos.addScaledVector(tmp.dir, Math.sin(world.punch * Math.PI) * 0.25)
    }
    cam.position.copy(tmp.pos)
    // shake on flicks (120 ms)
    if (world.shake > 0 && !reduced) {
      const k = world.shake * 0.012
      cam.position.x += (Math.random() - 0.5) * k
      cam.position.y += (Math.random() - 0.5) * k
      world.shake = Math.max(0, world.shake - dt / 0.12)
    }
    cam.lookAt(tmp.target)

    // play-area bounds on the offer plane
    const d = Math.max(0.5, cam.position.z - world.planeZ)
    const halfH = d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    world.bounds.halfH = halfH
    world.bounds.halfW = halfH * cam.aspect
    world.bounds.cx = rig.tx
    world.bounds.cy = rig.ty
    world.time = t
  })
  return null
}
