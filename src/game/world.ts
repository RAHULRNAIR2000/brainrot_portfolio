import * as THREE from 'three'

// Per-frame shared state. Mutated in useFrame loops, never drives React renders.

export type Mood =
  | 'idle'
  | 'greet'
  | 'offer'
  | 'tell'
  | 'dodge'
  | 'smug'
  | 'laugh'
  | 'shocked'
  | 'handover'
  | 'celebrate'

export const world = {
  // pointer in client px; null until the visitor moves
  pointer: null as null | { x: number; y: number; touch: boolean; down: boolean },
  // hand on the offer plane (world space)
  hand: new THREE.Vector3(0, 1.3, 0.8),
  handRaw: new THREE.Vector3(0, 1.3, 0.8), // unsmoothed, used for fair catch checks
  handVisible: false,
  handPulse: 0, // 0..1 flash when grabbing
  // cone tip (world space)
  cone: new THREE.Vector3(0.1, 1.35, 0.6),
  coneVel: new THREE.Vector3(),
  coneHeld: true, // on the vendor's stick
  coneHidden: false,
  coneOwnedByPlayer: false,
  dodging: false,
  scoopColor: '#f6ead7',
  // vendor
  mood: 'idle' as Mood,
  moodSince: 0,
  talkUntil: 0,
  lookTarget: new THREE.Vector3(0, 1.5, 5),
  // right hand of a rigged GLB vendor, when one is loaded
  vendorHand: new THREE.Vector3(),
  vendorHandValid: false,
  // camera
  shake: 0,
  punch: 0,
  punchStretch: 0, // squash & stretch kick on dodge start
  burst: 0, // increments to fire the sparkle burst
  // play area on the offer plane, updated by the camera rig
  bounds: { halfW: 1.2, halfH: 0.8, cx: 0, cy: 1.35 },
  planeZ: 0.62,
  time: 0,
}

export function setMood(m: Mood) {
  if (world.mood !== m) {
    world.mood = m
    world.moodSince = world.time
  }
}
