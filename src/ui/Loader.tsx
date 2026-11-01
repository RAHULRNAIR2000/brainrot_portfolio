import { useEffect, useRef, useState } from 'react'
import { audio } from '../audio/audioManager'
import { flavors, vendorName } from '../content/projects'
import { useGame } from '../store/gameStore'

// What's actually downloading, in street terms.
function labelFor(item: string, chunk: boolean) {
  if (!chunk) return 'Building the street'
  if (item.includes('/models/vendor')) return `Waking up ${vendorName.split(' ')[0]}`
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
  return { p, label: labelFor(load?.item ?? '', !!load) }
}

// Shop front height: room for the HUD row, then the sign. The shutter hangs below it.
const FRONT = 'calc(var(--safe-top) + 150px)'
const HOUSING = 20

// Painted metal slats over the real shutter texture the street uses.
const SLATS = {
  backgroundImage:
    'linear-gradient(90deg, rgba(0,0,0,0.28), transparent 7%, transparent 93%, rgba(0,0,0,0.28)), repeating-linear-gradient(#a9b6b0 0 3px, #8f9d98 3px 13px, #6c7975 13px 15px, #3b4543 15px 17px), url(/textures/painted_metal_shutter/diff.jpg)',
  backgroundSize: '100% 100%, 100% 17px, 260px',
  backgroundBlendMode: 'normal, multiply, normal',
} as const

function Shutter({ p, label, gone }: { p: number; label: string; gone: boolean }) {
  const pct = Math.round(p * 100)
  const left = 1 - p
  return (
    <>
      {/* warm light from the shop leaking under the shutter */}
      <div
        className="pointer-events-none absolute inset-x-0 h-24 transition-opacity duration-700"
        style={{
          top: `calc(${FRONT} + ${HOUSING}px + (100% - ${FRONT} - ${HOUSING}px) * ${left})`,
          background: 'radial-gradient(55% 100% at 50% 0, rgba(255,170,80,0.45), rgba(255,120,40,0.12) 45%, transparent 75%)',
          opacity: gone || p > 0.97 ? 0 : 1,
        }}
        aria-hidden
      />
      <div
        className="absolute inset-x-0 overflow-hidden shadow-[0_12px_20px_-8px_rgba(0,0,0,0.85)]"
        style={{ ...SLATS, top: `calc(${FRONT} + ${HOUSING}px)`, height: `calc((100% - ${FRONT} - ${HOUSING}px) * ${left})` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Loading the street"
      >
        {/* Mehmet's note, taped near the bottom so it rides up with the shutter */}
        <div
          className="absolute left-1/2 w-[184px] -translate-x-1/2 -rotate-3 bg-[#f6efdc] px-3 pb-2.5 pt-3 text-center text-[#2a1d18] shadow-[0_8px_14px_-6px_rgba(0,0,0,0.85)] transition-opacity duration-300"
          style={{ bottom: 'clamp(70px, 24%, 230px)', opacity: p > 0.9 ? 0 : 1 }}
        >
          <span className="absolute -left-3 -top-2 h-[18px] w-12 -rotate-[24deg] bg-[#e8dcb3]/80" aria-hidden />
          <span className="absolute -right-3 -top-2 h-[18px] w-12 rotate-[22deg] bg-[#e8dcb3]/80" aria-hidden />
          <p className="font-hand text-[24px] font-semibold leading-[1.02]">Back in 5 min!</p>
          <p key={label} className="rise mt-1 font-hand text-[20px] font-semibold leading-[1.05] text-[#5a3a2c]">
            {label}…
          </p>
          <p className="mt-1.5 font-mono text-[10.5px] tabular-nums tracking-[0.08em] text-[#6a5d55]">— {vendorName.split(' ')[0]} · {pct}%</p>
        </div>
        {/* bottom bar and handle */}
        <div className="absolute inset-x-0 bottom-0 h-3 border-t border-[#c3cdc8] bg-gradient-to-b from-[#5b6461] to-[#2c3331]" aria-hidden />
        <div className="absolute bottom-3.5 left-1/2 h-2.5 w-12 -translate-x-1/2 rounded-md border-2 border-[#9aa6a2] bg-[#2b3130]" aria-hidden />
      </div>
    </>
  )
}

function ShopFront({ gone }: { gone: boolean }) {
  return (
    <div
      className="absolute inset-x-0 top-0 transition-transform duration-[900ms] ease-[cubic-bezier(.6,0,.3,1)]"
      style={{ height: `calc(${FRONT} + ${HOUSING}px)`, transform: gone ? 'translateY(-110%)' : 'none' }}
    >
      {/* plaster wall */}
      <div
        className="absolute inset-x-0 top-0 border-b-[3px] border-[#1b1512]"
        style={{ height: FRONT, backgroundColor: '#3a2f2a', backgroundImage: 'var(--grain), linear-gradient(#4b3c34, #2d2420)', backgroundSize: '180px 180px, 100% 100%' }}
      />
      {/* enamel sign with two bulbs */}
      <div className="absolute inset-x-4 mx-auto max-w-[440px]" style={{ top: 'calc(var(--safe-top) + 60px)' }}>
        {[14, -14].map((x) => (
          <span
            key={x}
            className="absolute -top-3 h-2 w-2 rounded-full bg-[#ffd27a] shadow-[0_0_10px_3px_rgba(255,179,71,0.55)]"
            style={x > 0 ? { left: x } : { right: -x }}
            aria-hidden
          />
        ))}
        <div className="flex h-[74px] flex-col items-center justify-center rounded-md border-[3px] border-brass bg-[#18463a] shadow-[0_8px_16px_-6px_rgba(0,0,0,0.9),inset_0_0_0_2px_#0e2c24]">
          <h1 className="display-hed text-[27px] font-black leading-none tracking-[0.01em] text-[#f1d58a] [text-shadow:0_1px_0_#6b4d17]">Rahul R Nair</h1>
          <p className="display-soft mt-1 text-[12.5px] italic text-[#e9dcc0]">Maraş Dondurması · backend engineer</p>
        </div>
      </div>
      {/* shutter housing */}
      <div
        className="absolute inset-x-0 border-b-2 border-[#232a2a] bg-gradient-to-b from-[#626e6c] to-[#3d4746] shadow-[0_4px_8px_-2px_rgba(0,0,0,0.6)]"
        style={{ top: FRONT, height: HOUSING }}
      />
    </div>
  )
}

export function Loader({ ready }: { ready: boolean }) {
  const phase = useGame((s) => s.phase)
  const setPhase = useGame((s) => s.setPhase)
  const { p, label } = useLoadProgress(ready)
  const [gone, setGone] = useState(false)

  // open the gate once the shutter has visibly reached the top
  useEffect(() => {
    if (!ready || p < 0.999) return
    const t = window.setTimeout(() => useGame.getState().phase === 'loading' && setPhase('gate'), 350)
    return () => clearTimeout(t)
  }, [ready, p, setPhase])

  const leaving = phase !== 'loading' && phase !== 'gate'
  useEffect(() => {
    if (!leaving) return
    const t = window.setTimeout(() => setGone(true), 1000)
    return () => clearTimeout(t)
  }, [leaving])
  if (gone) return null

  const gate = phase === 'gate'
  const enter = () => {
    audio.unlock()
    audio.setMuted(useGame.getState().muted)
    setPhase('intro')
  }

  return (
    <div className={`app-h fixed inset-0 z-30 overflow-hidden ${gate ? 'cursor-pointer' : ''} ${leaving ? 'pointer-events-none' : ''}`} onClick={gate ? enter : undefined}>
      <Shutter p={p} label={label} gone={leaving} />
      <ShopFront gone={leaving} />

      {gate && (
        <div
          className={`paper absolute inset-x-3 mx-auto max-w-[440px] cursor-default rounded-xl p-4 shadow-[0_14px_30px_-10px_rgba(0,0,0,0.9)] transition-all duration-500 sm:p-5 ${
            leaving ? 'translate-y-6 opacity-0' : 'rise'
          }`}
          style={{ bottom: 'calc(var(--safe-bottom) + 14px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="display-hed text-[19px] font-bold leading-snug text-ink sm:text-[21px]">I build backends. He trolls people with ice cream.</p>
          <p className="mt-1 text-[13.5px] leading-snug text-ink-soft">
            {flavors.length} project stories inside. Catch the cone to read one. Sound on if you can.
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={enter}
              className="min-h-[46px] rounded-lg bg-ink px-5 text-[15px] font-semibold text-paper transition hover:-translate-y-0.5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
            >
              Step up to the cart →
            </button>
            <button
              onClick={() => useGame.getState().setSkip(true)}
              className="min-h-[44px] text-[13.5px] font-medium text-cobalt underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              or just read the work
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
