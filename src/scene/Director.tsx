import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { audio } from '../audio/audioManager'
import { finalScoop, flavors, vendorLines } from '../content/projects'
import { prefetchSounds, say, sayFrom } from '../game/say'
import { troll } from '../game/troll'
import { setMood, world } from '../game/world'
import { allTasted, useGame } from '../store/gameStore'

// Runs the show: intro timeline, round start/finish, vendor moods between phases.
export function Director({ signPower }: { signPower: { current: number } }) {
  const phase = useGame((s) => s.phase)
  const said = useRef({ menu: false, all: false })
  const idleSince = useRef(0)

  useEffect(() => {
    const timers: number[] = []
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const st = useGame.getState()

    switch (phase) {
      case 'gate':
        signPower.current = 0
        break
      case 'intro': {
        // neon sign stutters on, bell, vendor spots you
        const tl = gsap.timeline()
        tl.to(signPower, { current: 1, duration: 0.05 }, 0.7)
          .to(signPower, { current: 0.1, duration: 0.05 }, 0.82)
          .to(signPower, { current: 1, duration: 0.05 }, 0.95)
          .to(signPower, { current: 0.2, duration: 0.04 }, 1.08)
          .to(signPower, { current: 1, duration: 0.3 }, 1.2)
        later(1300, () => audio.bell())
        later(2900, () => {
          setMood('greet')
          audio.clink()
          say(vendorLines.greeting)
        })
        later(6200, () => setMood('idle'))
        later(6900, () => useGame.getState().setPhase('menu'))
        return () => {
          tl.kill()
          timers.forEach(clearTimeout)
        }
      }
      case 'menu':
        gsap.to(signPower, { current: 1, duration: 0.4 })
        troll.stop()
        setMood('idle')
        idleSince.current = world.time
        if (allTasted(st.tasted) && !said.current.all) {
          said.current.all = true
          later(500, () => {
            setMood('greet')
            say(vendorLines.allTasted)
            later(2000, () => setMood('idle'))
          })
        } else if (!said.current.menu) {
          said.current.menu = true
          later(400, () => say(vendorLines.menu))
        }
        break
      case 'troll': {
        const f = flavors.find((x) => x.id === st.currentId)
        world.scoopColor = f ? f.color : finalScoop.color
        troll.onWin = () => {
          later(450, () => useGame.getState().setPhase('reward'))
        }
        troll.start(st.currentId === 'wispr')
        break
      }
      case 'reward':
        later(1100, () => useGame.getState().finishRound())
        break
      case 'story':
      case 'final':
        setMood('idle')
        break
    }
    return () => timers.forEach(clearTimeout)
  }, [phase, signPower])

  useEffect(() => prefetchSounds(), [])

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __dondurma: { troll, world, useGame } })
  }, [])

  useFrame(({ clock }, rawDt) => {
    world.time = clock.elapsedTime
    const dt = Math.min(rawDt, 1 / 20)
    troll.update(dt)
    // nudge the visitor if they idle on the menu
    if (useGame.getState().phase === 'menu' && world.time - idleSince.current > 22) {
      idleSince.current = world.time
      sayFrom(vendorLines.idle, 'idle')
    }
  })
  return null
}
