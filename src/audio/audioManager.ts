import { fileExists } from '../scene/assets'

// Sounds are synthesised with Web Audio. If a real recording exists (public/sfx, public/voice/vendor) it plays instead.

type Vowel = [number, number]
const VOWELS: Record<string, Vowel> = {
  a: [800, 1200],
  e: [500, 1900],
  i: [320, 2300],
  o: [500, 900],
  u: [350, 800],
}
// Hijaz on D: the street musician's scale
const HIJAZ = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66, 311.13, 369.99]

class AudioManager {
  ctx: AudioContext | null = null
  master!: GainNode
  sfx!: GainNode
  amb!: GainNode
  verb!: ConvolverNode
  verbSend!: GainNode
  noise!: AudioBuffer
  muted = false
  private musicTimer = 0
  private raw = new Map<string, Promise<ArrayBuffer | null>>()
  private buf = new Map<string, AudioBuffer>()
  private synthAmb: GainNode[] = []
  private ambFile = false

  get ready() {
    return !!this.ctx
  }

  unlock() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.9
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)
    this.sfx = ctx.createGain()
    this.sfx.connect(this.master)
    this.amb = ctx.createGain()
    this.amb.gain.value = 0
    this.amb.connect(this.master)
    this.verb = ctx.createConvolver()
    this.verb.buffer = this.impulse(2.4)
    this.verbSend = ctx.createGain()
    this.verbSend.gain.value = 0.35
    this.verbSend.connect(this.verb).connect(this.master)
    this.noise = this.makeNoise()
    this.startAmbience()
    for (const key of this.raw.keys()) this.decode(key)
  }

  // Start downloading an optional recording; it's decoded once audio is unlocked.
  prefetch(key: string, url: string) {
    if (!this.raw.has(key))
      this.raw.set(
        key,
        fileExists(url)
          .then((ok) => (ok ? fetch(url).then((r) => r.arrayBuffer()) : null))
          .catch(() => null),
      )
    if (this.ctx) this.decode(key)
  }

  private decode(key: string) {
    if (this.buf.has(key)) return
    void this.raw.get(key)?.then((ab) => {
      if (!ab || !this.ctx || this.buf.has(key)) return
      this.ctx
        .decodeAudioData(ab.slice(0))
        .then((b) => {
          this.buf.set(key, b)
          if (key === 'sfx:ambience') this.useAmbienceFile()
        })
        .catch(() => {})
    })
  }

  // Plays a decoded recording; returns its duration, or 0 if there isn't one.
  private play(key: string, gain = 1, rate = 1, dest?: AudioNode, loop = false) {
    const b = this.buf.get(key)
    if (!b || !this.ctx) return 0
    const src = this.ctx.createBufferSource()
    src.buffer = b
    src.loop = loop
    src.playbackRate.value = rate
    const g = this.ctx.createGain()
    g.gain.value = gain
    src.connect(g).connect(dest ?? this.sfx)
    src.start()
    return b.duration / rate
  }

  // Vendor line: the recorded clip if there is one, else the babble voice. Returns seconds when recorded.
  voice(key: string | undefined, text: string) {
    const d = key ? this.play(`voice:${key}`, 1.1) : 0
    if (!d) this.babble(text)
    return d
  }

  private useAmbienceFile() {
    if (!this.ctx || this.ambFile) return
    this.ambFile = true
    for (const g of this.synthAmb) g.gain.setTargetAtTime(0, this.ctx.currentTime, 1)
    this.play('sfx:ambience', 0.6, 1, this.amb, true)
  }

  setMuted(m: boolean) {
    this.muted = m
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05)
  }

  private makeNoise() {
    const ctx = this.ctx!
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    return b
  }

  private impulse(sec: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * sec)
    const b = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    return b
  }

  private noiseSrc() {
    const s = this.ctx!.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    return s
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d)
  }

  private panner(p: number) {
    const ctx = this.ctx!
    if (ctx.createStereoPanner) {
      const n = ctx.createStereoPanner()
      n.pan.value = p
      return n
    }
    return ctx.createGain()
  }

  private startAmbience() {
    const ctx = this.ctx!
    // distant city: brown-ish rumble
    const rumble = this.noiseSrc()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 260
    const rg = ctx.createGain()
    rg.gain.value = 0.18
    this.synthAmb.push(rg)
    rumble.connect(lp).connect(rg).connect(this.amb)
    rumble.start()
    // breeze between the buildings
    const wind = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 700
    bp.Q.value = 0.6
    const wg = ctx.createGain()
    wg.gain.value = 0.035
    this.synthAmb.push(wg)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoG = ctx.createGain()
    lfoG.gain.value = 300
    lfo.connect(lfoG).connect(bp.frequency)
    lfo.start()
    wind.connect(bp).connect(wg).connect(this.amb)
    wind.start()
    this.amb.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5)
    this.scheduleSaz()
  }

  // A saz player somewhere down the street. Plucked notes in hijaz, far away.
  private scheduleSaz() {
    const play = () => {
      if (!this.ctx) return
      const t = this.ctx.currentTime + 0.05
      let idx = Math.floor(Math.random() * 6) + 2
      const notes = 3 + Math.floor(Math.random() * 5)
      let at = t
      for (let i = 0; i < notes; i++) {
        idx = Math.max(0, Math.min(HIJAZ.length - 1, idx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2)))
        this.pluck(HIJAZ[idx], at, 0.05)
        if (Math.random() < 0.3) this.pluck(HIJAZ[idx], at + 0.09, 0.03)
        at += [0.22, 0.33, 0.44][Math.floor(Math.random() * 3)]
      }
      this.musicTimer = window.setTimeout(play, (at - t) * 1000 + 1800 + Math.random() * 4000)
    }
    window.clearTimeout(this.musicTimer)
    this.musicTimer = window.setTimeout(play, 2500)
  }

  private pluck(f: number, t: number, vol: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const o2 = ctx.createOscillator()
    o2.type = 'square'
    o2.frequency.value = f * 2.003
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(f * 9, t)
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.35)
    const g = ctx.createGain()
    this.env(g, t, 0.004, vol, 0.9)
    const g2 = ctx.createGain()
    g2.gain.value = 0.3
    o.connect(lp)
    o2.connect(g2).connect(lp)
    const pan = this.panner(-0.4)
    lp.connect(g).connect(pan)
    pan.connect(this.amb)
    pan.connect(this.verbSend)
    o.start(t)
    o2.start(t)
    o.stop(t + 1)
    o2.stop(t + 1)
  }

  whoosh(strength = 1) {
    if (!this.ctx) return
    if (this.play('sfx:whoosh', 0.7 * strength, 0.9 + Math.random() * 0.25)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = this.noiseSrc()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.4
    bp.frequency.setValueAtTime(350, t)
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.12)
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.3)
    const g = ctx.createGain()
    this.env(g, t, 0.05, 0.55 * strength, 0.26)
    const pan = this.panner((Math.random() - 0.5) * 1.2)
    src.connect(bp).connect(g).connect(pan).connect(this.sfx)
    src.start(t, Math.random())
    src.stop(t + 0.4)
  }

  whiff() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = this.noiseSrc()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const g = ctx.createGain()
    this.env(g, t, 0.01, 0.25, 0.12)
    src.connect(lp).connect(g).connect(this.sfx)
    src.start(t, Math.random())
    src.stop(t + 0.2)
  }

  clink() {
    if (!this.ctx) return
    if (this.play('sfx:clink', 0.8, 0.95 + Math.random() * 0.1)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    for (const [f, v] of [
      [2380, 0.12],
      [3710, 0.08],
      [5240, 0.05],
      [6900, 0.03],
    ]) {
      const o = ctx.createOscillator()
      o.frequency.value = f * (0.98 + Math.random() * 0.04)
      const g = ctx.createGain()
      this.env(g, t, 0.002, v, 0.28)
      o.connect(g)
      g.connect(this.sfx)
      g.connect(this.verbSend)
      o.start(t)
      o.stop(t + 0.35)
    }
  }

  bell() {
    if (!this.ctx) return
    if (this.play('sfx:bell', 0.8)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    for (const [r, v] of [
      [1, 0.14],
      [2.76, 0.07],
      [5.4, 0.04],
      [8.93, 0.02],
    ]) {
      const o = ctx.createOscillator()
      o.frequency.value = 1046 * r
      const g = ctx.createGain()
      this.env(g, t, 0.003, v, 1.6 / Math.sqrt(r))
      o.connect(g)
      g.connect(this.sfx)
      g.connect(this.verbSend)
      o.start(t)
      o.stop(t + 1.8)
    }
  }

  pop() {
    if (!this.ctx) return
    if (this.play('sfx:pop', 0.9, 0.95 + Math.random() * 0.1)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(720, t)
    o.frequency.exponentialRampToValueAtTime(160, t + 0.13)
    const g = ctx.createGain()
    this.env(g, t, 0.004, 0.6, 0.16)
    o.connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.25)
    // sparkle: rising pings
    ;[1318, 1568, 2093, 2637].forEach((f, i) => {
      const p = ctx.createOscillator()
      p.type = 'triangle'
      p.frequency.value = f
      const pg = ctx.createGain()
      this.env(pg, t + 0.06 + i * 0.055, 0.003, 0.09, 0.35)
      p.connect(pg)
      pg.connect(this.sfx)
      pg.connect(this.verbSend)
      p.start(t + 0.05 + i * 0.055)
      p.stop(t + 0.6 + i * 0.055)
    })
  }

  // Animal-Crossing style voice: one formant-filtered blip per letter.
  babble(text: string, pitch = 1) {
    if (!this.ctx) return
    const ctx = this.ctx
    let t = ctx.currentTime + 0.02
    const base = 128 * pitch
    const exclaim = text.includes('!')
    const letters = text.toLowerCase().replace(/[^a-zçğıöşü !?.,]/g, '')
    let n = 0
    for (const ch of letters) {
      if (ch === ' ') {
        t += 0.035
        continue
      }
      if ('.,!?'.includes(ch)) {
        t += 0.12
        continue
      }
      if (n++ % 2) continue // every other letter: chattier, less machine-gun
      const vowel = VOWELS['aeiou'.includes(ch) ? ch : 'aeiou'[ch.charCodeAt(0) % 5]]
      const f = base * (1 + ((ch.charCodeAt(0) * 7) % 9) * 0.045) * (exclaim ? 1.12 : 1)
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f, t)
      o.frequency.linearRampToValueAtTime(f * 0.94, t + 0.07)
      const mix = ctx.createGain()
      mix.gain.value = 1
      for (const [fq, q] of [
        [vowel[0], 7],
        [vowel[1], 9],
      ]) {
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = fq
        bp.Q.value = q
        o.connect(bp).connect(mix)
      }
      const g = ctx.createGain()
      this.env(g, t, 0.012, 0.9, 0.07)
      mix.connect(g).connect(this.sfx)
      o.start(t)
      o.stop(t + 0.1)
      t += 0.075
    }
  }

  laugh() {
    if (!this.ctx) return
    // "ha ha ha ha" with a falling pitch
    const ctx = this.ctx
    let t = ctx.currentTime + 0.05
    for (let i = 0; i < 6; i++) {
      const f = 210 - i * 14
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f * 1.1, t)
      o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.12)
      const bp1 = ctx.createBiquadFilter()
      bp1.type = 'bandpass'
      bp1.frequency.value = 820
      bp1.Q.value = 5
      const bp2 = ctx.createBiquadFilter()
      bp2.type = 'bandpass'
      bp2.frequency.value = 1250
      bp2.Q.value = 6
      const g = ctx.createGain()
      this.env(g, t, 0.015, 1.1, 0.11)
      o.connect(bp1).connect(g)
      o.connect(bp2).connect(g)
      g.connect(this.sfx)
      // breathy "h"
      const n = this.noiseSrc()
      const ng = ctx.createGain()
      this.env(ng, t - 0.01, 0.008, 0.08, 0.05)
      n.connect(ng).connect(this.sfx)
      n.start(t - 0.01, Math.random())
      n.stop(t + 0.08)
      o.start(t)
      o.stop(t + 0.16)
      t += 0.15 + i * 0.012
    }
  }

  meow() {
    if (!this.ctx) return
    if (this.play('sfx:meow', 0.8, 0.95 + Math.random() * 0.12)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(520, t)
    o.frequency.linearRampToValueAtTime(820, t + 0.18)
    o.frequency.linearRampToValueAtTime(480, t + 0.5)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 4
    bp.frequency.setValueAtTime(900, t)
    bp.frequency.linearRampToValueAtTime(2200, t + 0.2)
    bp.frequency.linearRampToValueAtTime(800, t + 0.5)
    const g = ctx.createGain()
    this.env(g, t, 0.06, 0.6, 0.45)
    o.connect(bp).connect(g).connect(this.sfx)
    o.start(t)
    o.stop(t + 0.6)
  }
}

export const audio = new AudioManager()
