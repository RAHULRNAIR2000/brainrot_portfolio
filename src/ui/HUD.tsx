import { flavors } from '../content/projects'
import { useGame } from '../store/gameStore'
import { ScoopIcon } from './paper'

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="m16 9 5 6m0-6-5 6" />
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </>
      )}
    </svg>
  )
}

const press =
  'transition hover:-translate-y-0.5 hover:bg-[#fbf5e8] active:translate-y-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper'

// Always visible: skip, mute, flavors tasted. Small paper/enamel tokens.
export function HUD() {
  const muted = useGame((s) => s.muted)
  const toggleMute = useGame((s) => s.toggleMute)
  const setSkip = useGame((s) => s.setSkip)
  const tasted = useGame((s) => s.tasted)
  const phase = useGame((s) => s.phase)
  const inGame = phase !== 'loading' && phase !== 'gate'

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 sm:px-5"
      style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
    >
      <div className={`pointer-events-auto flex items-center gap-2 transition-opacity duration-700 ${inGame ? 'opacity-100' : 'opacity-0'}`}>
        <div className="token flex h-11 items-center rounded-full pl-2 pr-3" role="img" aria-label={`Flavors tasted ${tasted.length} of ${flavors.length}`}>
          {flavors.map((f) => {
            const done = tasted.includes(f.id)
            return <ScoopIcon key={f.id} color={f.color} empty={!done} className={`h-[22px] w-[15px] transition-transform duration-500 ${done ? 'scale-110' : 'scale-90'}`} />
          })}
          <span className="ml-2 font-mono text-[12px] font-medium tabular-nums text-ink">
            {tasted.length}/{flavors.length}
          </span>
        </div>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        <button onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} className={`token flex h-11 w-11 items-center justify-center rounded-full ${press}`}>
          <SpeakerIcon muted={muted} />
        </button>
        <button onClick={() => setSkip(true)} className={`token h-11 rounded-full px-3.5 text-[13px] font-semibold sm:px-4 ${press}`}>
          <span className="hidden sm:inline">Skip, just show me the work</span>
          <span className="sm:hidden">Skip to the work</span>
        </button>
      </div>
    </div>
  )
}
