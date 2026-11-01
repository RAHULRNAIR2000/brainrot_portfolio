import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio/audioManager'
import { flavors, vendorName } from '../content/projects'
import { useGame } from '../store/gameStore'

// What's actually downloading, in street terms.
function labelFor(item: string, chunk: boolean) {
  if (!chunk) return 'Building the street'
  if (item.includes('/models/vendor')) return `Waking up ${vendorName}`
  if (item.includes('/models/cat')) return 'Finding Pamuk the cat'
  if (item.includes('/hdri/')) return 'Switching on the night sky'
  if (item.includes('/textures/')) return 'Laying the cobblestones'
  return 'Sharpening the ice cream stick'
}

// Real progress: the 3D chunk counts for the first 20%, its files for the rest. Eased so it never jumps back.
function useLoadProgress(ready: boolean) {
  const load = useGame((s) => s.load)
  const target = ready ? 1 : load ? 0.2 + 0.78 * (load.total ? load.loaded / load.total : 0) : 0.18
  const [p, setP] = useState(0.04)
  const goal = useRef(target)
  goal.current = Math.max(goal.current, target)
  useEffect(() => {
    let id = 0
    const tick = () => {
      // without a chunk yet, creep toward 18% so the first seconds still move
      setP((v) => Math.min(goal.current, v + Math.max(0.002, (goal.current - v) * 0.08)))
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])
  const done = ready && p > 0.995
  return { p, label: done ? 'Ice cream is ready' : labelFor(load?.item ?? '', !!load) }
}

// Dome on top, scalloped skirt underneath; (x, y) is the middle of the skirt line.
function scoopPath(x: number, y: number) {
  const bumps = Array.from({ length: 6 }, () => 'q-4.33 6 -8.67 0').join(' ')
  return `M${x - 26} ${y} C${x - 26} ${y - 16} ${x - 15} ${y - 24} ${x} ${y - 24} C${x + 15} ${y - 24} ${x + 26} ${y - 16} ${x + 26} ${y} ${bumps} Z`
}

// A tall Maraş cone: one scoop per story, stacked as the street loads.
function ScoopStack({ p }: { p: number }) {
  const n = flavors.length
  const step = 17
  const coneY = 30 + (n - 1) * step + 2
  return (
    <svg viewBox={`0 0 100 ${coneY + 80}`} className="h-[min(30vh,230px)] w-auto overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="scoop-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
        <pattern id="waffle" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0H9M0 0V9" stroke="#9c6428" strokeWidth="1.4" opacity="0.65" />
        </pattern>
      </defs>
      {/* cone */}
      <path d={`M25 ${coneY} L50 ${coneY + 76} L75 ${coneY} Z`} fill="#dba159" stroke="#8a5a24" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={`M25 ${coneY} L50 ${coneY + 76} L75 ${coneY} Z`} fill="url(#waffle)" />
      {/* scoops, bottom first so each skirt drapes over the scoop below */}
      {flavors.map((f, i) => {
        const shown = p >= (i + 1) / n - 0.001
        const y = coneY + 2 - i * step
        const x = 50 + (i % 2 ? 2 : -2)
        const d = scoopPath(x, y)
        return (
          <g key={f.id} className={shown ? 'scoop-drop' : ''} style={{ opacity: shown ? 1 : 0, transformOrigin: `${x}px ${y}px` }}>
            <path d={scoopPath(x, y + 2.5)} fill="rgba(0,0,0,0.22)" />
            <path d={d} fill={f.color} />
            <path d={d} fill="url(#scoop-shade)" stroke="rgba(30,27,46,0.3)" strokeWidth="1" strokeLinejoin="round" />
            <ellipse cx={x - 10} cy={y - 15} rx="6.5" ry="3.2" fill="#fff" opacity="0.45" transform={`rotate(-22 ${x - 10} ${y - 15})`} />
          </g>
        )
      })}
    </svg>
  )
}

export function Loader({ ready }: { ready: boolean }) {
  const phase = useGame((s) => s.phase)
  const setPhase = useGame((s) => s.setPhase)
  const { p, label } = useLoadProgress(ready)
  const [gone, setGone] = useState(false)

  // open the gate once the bar has visibly reached the end
  useEffect(() => {
    if (!ready || p < 0.999) return
    const t = window.setTimeout(() => useGame.getState().phase === 'loading' && setPhase('gate'), 450)
    return () => clearTimeout(t)
  }, [ready, p, setPhase])

  const leaving = phase !== 'loading' && phase !== 'gate'
  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => setGone(true), 900)
    return () => clearTimeout(t)
  }, [leaving])
  if (gone) return null

  const enter = () => {
    audio.unlock()
    audio.setMuted(useGame.getState().muted)
    setPhase('intro')
  }
  const pct = Math.round(p * 100)

  return (
    <div
      className={`app-h fixed inset-0 z-30 flex flex-col items-center justify-center overflow-hidden px-6 pb-4 pt-[calc(var(--safe-top)+60px)] text-center transition-opacity duration-[900ms] ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(40,30,60,0.94), rgba(5,7,15,0.985) 72%)' }}
    >
      {/* warm stall glow behind the cone */}
      <div
        className="pointer-events-none absolute left-1/2 top-[52%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,150,70,0.35), rgba(255,61,172,0.12) 45%, transparent 70%)' }}
        aria-hidden
      />

      <p className="relative font-mono text-[10.5px] uppercase tracking-[0.32em] text-brass/90">Maraş dondurma · est. tonight</p>
      <h1 className="sign-on neon-pink relative mt-2 font-neon text-[clamp(3rem,14vw,6.5rem)] leading-none">Dondurma</h1>
      <p className="display-soft relative mt-3 text-[16px] italic leading-snug text-paper/80 sm:text-[19px]">
        {flavors.length} project stories, one stubborn ice cream man.
        <br className="sm:hidden" /> The work of Rahul R Nair.
      </p>

      <div className="relative mt-[clamp(10px,3vh,28px)] flex flex-col items-center">
        <ScoopStack p={p} />
      </div>

      <div className="relative mt-[clamp(10px,2.5vh,22px)] flex h-[104px] w-full max-w-[300px] flex-col items-center justify-start">
        {phase === 'gate' ? (
          <>
            <button
              onClick={enter}
              className="rise pulse paper display-soft min-h-[54px] rounded-lg border border-ink/20 px-9 py-3 text-[19px] font-semibold text-ink transition hover:-translate-y-0.5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper"
            >
              Step up to the cart
            </button>
            <button
              onClick={() => useGame.getState().setSkip(true)}
              className="rise mt-2 min-h-[36px] font-mono text-[11px] uppercase tracking-[0.18em] text-paper/60 underline decoration-paper/30 underline-offset-4 hover:text-paper"
              style={{ animationDelay: '120ms' }}
            >
              or just read the work
            </button>
          </>
        ) : (
          <>
            <div className="flex w-full items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.16em]">
              <span key={label} className="rise truncate text-paper/75">
                {label}
                <span className="loading-dots" />
              </span>
              <span className="ml-3 tabular-nums text-paper/55">{pct}%</span>
            </div>
            <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-paper/10">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #c9993f, #ffcf7a)', boxShadow: '0 0 10px rgba(255,190,90,0.6)' }} />
            </div>
          </>
        )}
      </div>

      <p className="relative mt-3 max-w-sm text-[13.5px] leading-relaxed text-paper/60">
        Turkish ice cream sellers are famous for trolling customers with the cone. Catch it and he hands over a story.
      </p>
      <p className="relative mt-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-paper/45">sound on · headphones are nice</p>
    </div>
  )
}
