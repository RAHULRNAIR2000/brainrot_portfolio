import * as THREE from 'three'

// Damped spring toward a target. zeta = 1 is critically damped.
export function springStep(x: number, v: number, target: number, k: number, zeta: number, dt: number): [number, number] {
  const c = 2 * zeta * Math.sqrt(k)
  // substep so stiff springs stay stable on slow frames
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)))
  const h = dt / steps
  for (let i = 0; i < steps; i++) {
    const a = k * (target - x) - c * v
    v += a * h
    x += v * h
  }
  return [x, v]
}

export class Spring1 {
  x: number
  v = 0
  constructor(x = 0, public k = 120, public zeta = 1) {
    this.x = x
  }
  step(target: number, dt: number) {
    ;[this.x, this.v] = springStep(this.x, this.v, target, this.k, this.zeta, dt)
    return this.x
  }
}

export class Spring3 {
  readonly x = new THREE.Vector3()
  readonly v = new THREE.Vector3()
  constructor(init: THREE.Vector3, public k = 120, public zeta = 1) {
    this.x.copy(init)
  }
  step(target: THREE.Vector3, dt: number) {
    ;[this.x.x, this.v.x] = springStep(this.x.x, this.v.x, target.x, this.k, this.zeta, dt)
    ;[this.x.y, this.v.y] = springStep(this.x.y, this.v.y, target.y, this.k, this.zeta, dt)
    ;[this.x.z, this.v.z] = springStep(this.x.z, this.v.z, target.z, this.k, this.zeta, dt)
    return this.x
  }
}

// Frame-rate independent exponential smoothing.
export const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.damp(a, b, lambda, dt)

export const rand = (a: number, b: number) => a + Math.random() * (b - a)
export const pick = <T,>(arr: T[], avoid?: T): T => {
  if (arr.length < 2) return arr[0]
  let v = arr[Math.floor(Math.random() * arr.length)]
  while (v === avoid) v = arr[Math.floor(Math.random() * arr.length)]
  return v
}
