import { create } from 'zustand'
import { flavors } from '../content/projects'
import { detectTier, settingsFor, type TierSettings } from '../utils/deviceTier'

export type Phase = 'loading' | 'gate' | 'intro' | 'menu' | 'troll' | 'reward' | 'story' | 'final'

type Subtitle = { text: string; key: number; until: number }

type GameState = {
  phase: Phase
  currentId: string | null
  tasted: string[]
  muted: boolean
  skipOpen: boolean
  subtitle: Subtitle | null
  attempts: number
  settings: TierSettings
  load: { loaded: number; total: number; item: string } | null // 3D asset progress, null until the scene chunk arrives
  setPhase: (p: Phase) => void
  order: (id: string) => void
  finishRound: () => void
  closeStory: () => void
  toggleMute: () => void
  setSkip: (open: boolean) => void
  showSubtitle: (text: string, ms: number) => void
  setAttempts: (n: number) => void
  downgrade: () => void
}

const readMuted = () => {
  try {
    return localStorage.getItem('dondurma:muted') === '1'
  } catch {
    return false
  }
}

const tierOrder = ['high', 'mid', 'low'] as const

export const useGame = create<GameState>((set, get) => ({
  phase: 'loading',
  currentId: null,
  tasted: [],
  muted: readMuted(),
  skipOpen: false,
  subtitle: null,
  attempts: 0,
  settings: settingsFor(detectTier()),
  load: null,

  setPhase: (phase) => set({ phase }),
  order: (id) => set({ currentId: id, phase: 'troll', attempts: 0 }),
  finishRound: () => {
    const { currentId, tasted } = get()
    set({ phase: currentId === 'wispr' ? 'final' : 'story', tasted: currentId && !tasted.includes(currentId) ? [...tasted, currentId] : tasted })
  },
  closeStory: () => set({ phase: 'menu', currentId: null }),
  toggleMute: () => {
    const muted = !get().muted
    try {
      localStorage.setItem('dondurma:muted', muted ? '1' : '0')
    } catch {
      /* storage blocked */
    }
    set({ muted })
  },
  setSkip: (skipOpen) => set({ skipOpen }),
  showSubtitle: (text, ms) => set({ subtitle: { text, key: performance.now(), until: performance.now() + ms } }),
  setAttempts: (attempts) => set({ attempts }),
  downgrade: () => {
    const i = tierOrder.indexOf(get().settings.tier)
    if (i < tierOrder.length - 1) set({ settings: settingsFor(tierOrder[i + 1]) })
  },
}))

export const allTasted = (tasted: string[]) => flavors.every((f) => tasted.includes(f.id))
