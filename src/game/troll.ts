import * as THREE from 'three'
import { audio } from '../audio/audioManager'
import { vendorLines } from '../content/projects'
import { useGame } from '../store/gameStore'
import { prefersReducedMotion } from '../utils/deviceTier'
import { RULES } from './rules'
import { GIFT_LINE, say, sayFrom } from './say'
import { rand, Spring3 } from './springs'
import { setMood, world } from './world'

// The cone round. Easy enough to win in 10-20 s, annoying enough to be funny, never unfair.

type State = 'idle' | 'offer' | 'tell' | 'dodge' | 'recover' | 'return' | 'yield' | 'handover' | 'won'
type Pattern = 'flick' | 'hide' | 'overhead' | 'fakeout'
type Waypoint = { pos: THREE.Vector3; dur: number; hidden?: boolean; k?: number }


const REST = new THREE.Vector3(-0.42, 1.55, -0.3)
const PATTERNS: Pattern[] = ['flick', 'hide', 'overhead', 'fakeout']
const CATCH_OFFSET = new THREE.Vector3(0, 0.15, 0)
const HAND_REST = new THREE.Vector3(-0.08, 0.75, 0.12)

class Troll {
  state: State = 'idle'
  t = 0
  total = 0
  fails = 0
  gift = false
  lastPattern: Pattern | null = null
  waypoints: Waypoint[] = []
  wp = 0
  wpT = 0
  catchRadius = RULES.baseCatchRadius
  dodgeScale = 1
  target = REST.clone()
  spring = new Spring3(REST, 90, 1)
  teaseAuto = false
  onWin: ((lucky: boolean) => void) | null = null

  get offerPos() {
    const b = world.bounds
    return new THREE.Vector3(b.cx - 0.42, 1.4, world.planeZ)
  }

  catchPoint(out = new THREE.Vector3()) {
    return out.copy(world.cone).add(CATCH_OFFSET)
  }

  handDist() {
    const c = this.catchPoint()
    const dz = Math.abs(c.z - world.planeZ)
    if (dz > 0.45) return Infinity
    return Math.hypot(world.handRaw.x - c.x, world.handRaw.y - c.y)
  }

  start(gift = false) {
    this.gift = gift
    this.fails = 0
    this.total = 0
    this.catchRadius = RULES.baseCatchRadius
    this.dodgeScale = 1
    this.lastPattern = null
    world.coneOwnedByPlayer = false
    world.coneHidden = false
    useGame.getState().setAttempts(0)
    if (gift) {
      this.enter('handover')
      say(GIFT_LINE)
    } else {
      this.enter('offer')
      sayFrom(vendorLines.offer, 'offer')
    }
  }

  stop() {
    this.state = 'idle'
    world.dodging = false
    world.coneHidden = false
    world.coneOwnedByPlayer = false
  }

  enter(s: State) {
    this.state = s
    this.t = 0
    switch (s) {
      case 'offer':
        setMood('offer')
        this.spring.k = 70
        this.spring.zeta = 0.9
        break
      case 'tell':
        setMood('tell')
        audio.clink()
        break
      case 'dodge':
        setMood('dodge')
        world.dodging = true
        this.spring.k = 260
        this.spring.zeta = 0.72
        this.wp = 0
        this.wpT = 0
        if (!prefersReducedMotion()) world.shake = Math.max(world.shake, 1)
        world.punchStretch = 1
        audio.whoosh()
        break
      case 'recover':
        world.dodging = false
        world.coneHidden = false
        setMood('smug')
        this.spring.k = 140
        this.spring.zeta = 0.65
        sayFrom(vendorLines.taunts, 'taunt')
        break
      case 'return':
        this.spring.k = 60
        this.spring.zeta = 1
        break
      case 'yield':
        world.dodging = false
        world.coneHidden = false
        setMood('laugh')
        audio.laugh()
        say(vendorLines.yieldLine)
        break
      case 'handover':
        setMood('handover')
        this.spring.k = 30
        this.spring.zeta = 1
        break
      case 'won':
        world.dodging = false
        world.coneHidden = false
        world.coneOwnedByPlayer = true
        this.spring.k = 240
        this.spring.zeta = 0.8
        break
    }
  }

  fail() {
    this.fails++
    this.dodgeScale *= RULES.shrinkPerFail
    this.catchRadius *= RULES.growPerFail
    useGame.getState().setAttempts(this.fails)
  }

  win(lucky: boolean) {
    this.enter('won')
    audio.pop()
    world.punch = 1
    world.burst++
    try {
      navigator.vibrate?.(30)
    } catch {
      /* not supported */
    }
    if (lucky) {
      setMood('shocked')
      say(vendorLines.lucky)
    } else if (!this.gift) {
      setMood('celebrate')
      sayFrom(vendorLines.win, 'win')
    }
    this.onWin?.(lucky)
  }

  // Click / tap.
  grab() {
    world.handPulse = 1
    const d = this.handDist()
    switch (this.state) {
      case 'offer':
        if (d < this.catchRadius * 1.2) {
          if (Math.random() < RULES.luckyChance + this.fails * 0.05) return this.win(true)
          this.teaseAuto = false
          this.enter('tell')
          this.t = RULES.tellTime * 0.6 // snatch: shorter tell
        } else audio.whiff()
        break
      case 'tell':
      case 'recover':
        if (d < this.catchRadius) return this.win(false)
        audio.whiff()
        break
      case 'handover':
      case 'yield':
        if (d < this.catchRadius * 2.2) this.win(false)
        break
      default:
        audio.whiff()
    }
  }

  buildDodge(p: Pattern) {
    const b = world.bounds
    const c = world.cone.clone()
    const s = this.dodgeScale
    const A = Math.min(1.05, b.halfW * 0.8) * s
    const dir = world.handVisible && world.hand.x > c.x ? -1 : world.handVisible ? 1 : Math.random() < 0.5 ? -1 : 1
    const clampX = (x: number) => THREE.MathUtils.clamp(x, b.cx - b.halfW + 0.2, b.cx + b.halfW - 0.2)
    const Z = world.planeZ
    const V = new THREE.Vector3(0, 0, -0.72)
    const w: Waypoint[] = []
    switch (p) {
      case 'flick': {
        const endX = clampX(c.x + dir * A * rand(0.85, 1.15))
        w.push({ pos: new THREE.Vector3((c.x + endX) / 2, Math.min(1.95, c.y + 0.32 * s), Z), dur: 0.11 })
        w.push({ pos: new THREE.Vector3(endX, THREE.MathUtils.clamp(c.y + rand(-0.1, 0.12), 1.2, 1.85), Z), dur: 0.32 })
        break
      }
      case 'hide': {
        w.push({ pos: new THREE.Vector3(V.x + dir * 0.5, 1.5, V.z + 0.25), dur: 0.12 })
        w.push({ pos: new THREE.Vector3(V.x, 1.3, V.z - 0.42), dur: 0.16, hidden: true })
        w.push({ pos: new THREE.Vector3(V.x - dir * 0.05, 1.32, V.z - 0.45), dur: 0.5, hidden: true })
        w.push({ pos: new THREE.Vector3(V.x - dir * 0.55, 1.45, V.z + 0.25), dur: 0.14 })
        w.push({ pos: new THREE.Vector3(clampX(b.cx - dir * A * 0.6), 1.42, Z), dur: 0.26 })
        break
      }
      case 'overhead': {
        const x0 = c.x * 0.4
        w.push({ pos: new THREE.Vector3(x0, 1.98, Z - 0.12), dur: 0.18 })
        w.push({ pos: new THREE.Vector3(x0 + 0.3 * s, 2.02, Z - 0.12), dur: 0.16 })
        w.push({ pos: new THREE.Vector3(x0 - 0.3 * s, 2.0, Z - 0.12), dur: 0.16 })
        w.push({ pos: new THREE.Vector3(x0 + 0.22 * s, 2.0, Z - 0.12), dur: 0.14 })
        w.push({ pos: new THREE.Vector3(clampX(x0 + dir * 0.35 * s), 1.66, Z), dur: 0.22 })
        break
      }
      case 'fakeout': {
        const towards = new THREE.Vector3(c.x + (world.hand.x - c.x) * 0.5, c.y, Z + 0.3)
        w.push({ pos: towards, dur: 0.1 })
        w.push({ pos: new THREE.Vector3(c.x - dir * 0.15, c.y + 0.05, Z - 0.6), dur: 0.16 })
        w.push({ pos: new THREE.Vector3(clampX(c.x + dir * A * 0.55), 1.48, Z), dur: 0.3 })
        break
      }
    }
    return w
  }

  update(dt: number) {
    if (this.state === 'idle') {
      this.spring.k = 40
      this.spring.zeta = 1
      // with a rigged vendor the cone rests upright on the stick in his hand
      const rest = world.vendorHandValid ? this.target.copy(world.vendorHand).add(HAND_REST) : REST
      this.spring.step(rest, dt)
      world.cone.copy(this.spring.x)
      world.coneVel.copy(this.spring.v)
      return
    }
    this.t += dt
    if (this.state !== 'won') this.total += dt
    const d = this.handDist()

    switch (this.state) {
      case 'offer': {
        const o = this.offerPos
        o.y += Math.sin(this.t * 3.2) * 0.03
        o.x += Math.sin(this.t * 1.7) * 0.04
        this.target.copy(o)
        if (this.t > 0.35 && world.handVisible && d < RULES.triggerRadius) {
          this.teaseAuto = false
          this.enter('tell')
        } else if (this.t > RULES.autoTeaseAfter) {
          this.teaseAuto = true
          this.enter('tell')
        }
        break
      }
      case 'tell': {
        // anticipation: wind up away from the dodge, a little up
        const o = this.offerPos
        const away = world.handVisible && world.hand.x > world.cone.x ? 0.1 : -0.1
        this.target.set(o.x + away, o.y + 0.06, o.z - 0.12)
        if (this.t > RULES.tellTime) {
          let p: Pattern
          do p = PATTERNS[Math.floor(Math.random() * PATTERNS.length)]
          while (p === this.lastPattern)
          if (this.teaseAuto) p = this.lastPattern === 'fakeout' ? 'flick' : 'fakeout'
          this.lastPattern = p
          this.waypoints = this.buildDodge(p)
          if (!this.teaseAuto) this.fail()
          this.enter('dodge')
        }
        break
      }
      case 'dodge': {
        const w = this.waypoints[this.wp]
        this.target.copy(w.pos)
        world.coneHidden = !!w.hidden && this.wpT > w.dur * 0.6
        this.wpT += dt
        if (this.wpT >= w.dur) {
          this.wpT = 0
          this.wp++
          if (this.wp < this.waypoints.length && Math.random() < 0.5) audio.whoosh(0.6)
          if (this.wp >= this.waypoints.length) this.enter('recover')
        }
        break
      }
      case 'recover': {
        const win = RULES.baseWindow + this.fails * 0.1
        if (this.t > Math.min(0.95, win)) {
          if (this.fails >= RULES.maxFails || this.total > RULES.maxSeconds) this.enter('yield')
          else this.enter('return')
        }
        break
      }
      case 'return':
        this.target.copy(this.offerPos)
        if (this.t > 0.45) this.enter('offer')
        break
      case 'yield':
        this.target.copy(this.offerPos).add(new THREE.Vector3(0, 0.05, 0))
        if (this.t > 1.5) this.enter('handover')
        break
      case 'handover': {
        // drift toward the visitor, then just give it
        const o = this.offerPos
        this.target.set(world.bounds.cx, 1.36, o.z + 0.35)
        if (this.t > (this.gift ? 1.6 : 1.4)) this.win(false)
        break
      }
      case 'won': {
        this.target.copy(world.handVisible ? world.hand : new THREE.Vector3(world.bounds.cx, 1.3, world.planeZ + 0.6))
        this.target.y -= 0.1
        break
      }
    }

    this.spring.step(this.target, dt)
    world.cone.copy(this.spring.x)
    world.coneVel.copy(this.spring.v)
  }

  get catchable() {
    return this.state === 'tell' || this.state === 'recover' || this.state === 'handover'
  }
}

export const troll = new Troll()
