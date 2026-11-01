import { audio } from '../audio/audioManager'
import { vendorLines } from '../content/projects'
import { useGame } from '../store/gameStore'
import { pick } from './springs'
import { world } from './world'

export const GIFT_LINE = 'This one is free, kid. Secret flavor.'

// Line text -> recording file name in public/voice/vendor/ (see ASSET_BRIEF.md).
const KEYS = new Map<string, string>()
KEYS.set(vendorLines.greeting, 'greeting')
KEYS.set(vendorLines.menu, 'menu')
vendorLines.offer.forEach((t, i) => KEYS.set(t, `offer-${i + 1}`))
vendorLines.taunts.forEach((t, i) => KEYS.set(t, `taunt-${i + 1}`))
KEYS.set(vendorLines.lucky, 'lucky')
vendorLines.win.forEach((t, i) => KEYS.set(t, `win-${i + 1}`))
KEYS.set(vendorLines.yieldLine, 'yield')
KEYS.set(vendorLines.allTasted, 'all-tasted')
KEYS.set(vendorLines.cat, 'cat')
vendorLines.idle.forEach((t, i) => KEYS.set(t, `idle-${i + 1}`))
KEYS.set(GIFT_LINE, 'gift')

// He only speaks the highlights out loud; every other line is a subtitle alone.
const HIGHLIGHTS = new Set(['greeting', 'lucky', 'yield', 'all-tasted', 'cat', 'gift'])

const SFX = ['bell', 'clink', 'whoosh', 'pop', 'meow', 'ambience']

export function prefetchSounds() {
  for (const key of KEYS.values()) audio.prefetch(`voice:${key}`, `/voice/vendor/${key}.mp3`)
  for (const s of SFX) audio.prefetch(`sfx:${s}`, `/sfx/${s}.mp3`)
}

const last: Record<string, string> = {}

// Vendor line: always a subtitle; spoken (with mouth flap) only when `aloud`.
export function say(text: string, aloud = HIGHLIGHTS.has(KEYS.get(text) ?? '')) {
  const recorded = aloud ? audio.voice(KEYS.get(text), text) : 0
  const ms = recorded ? recorded * 1000 : Math.min(3200, 700 + text.length * 48)
  useGame.getState().showSubtitle(text, ms + 600)
  if (aloud) world.talkUntil = world.time + ms / 1000
}

// Random line from a pool, never the same twice in a row. The first line from each pool is spoken aloud.
export function sayFrom(pool: string[], key: string) {
  const line = pick(pool, last[key])
  const first = !(key in last)
  last[key] = line
  say(line, first)
}
