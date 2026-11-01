import { useCallback, useRef } from 'react'
import { flavors, vendorName } from '../content/projects'
import { allTasted, useGame } from '../store/gameStore'
import { ScoopIcon, Stamp, TileDivider } from './paper'
import { Sheet } from './Sheet'
import { StoryBody, StoryHeading } from './StoryBody'

const btn =
  'min-h-[50px] flex-1 rounded-lg px-5 text-[15px] font-semibold transition focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt'

export function StoryCard() {
  const phase = useGame((s) => s.phase)
  const currentId = useGame((s) => s.currentId)
  const tasted = useGame((s) => s.tasted)
  const closeStory = useGame((s) => s.closeStory)
  const order = useGame((s) => s.order)
  const open = phase === 'story'
  // keep the last story rendered while the sheet slides away
  const last = useRef(flavors[0])
  const found = flavors.find((x) => x.id === currentId)
  if (found) last.current = found
  const f = last.current
  const n = flavors.indexOf(f) + 1
  const close = useCallback(() => closeStory(), [closeStory])
  const nextUp = flavors.find((x) => !tasted.includes(x.id))

  return (
    <Sheet open={open} onClose={close} accent={f.accent} label={`${f.flavor}: ${f.project}`}>
      <header className="flex items-start justify-between gap-3 sm:pr-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <ScoopIcon color={f.color} className="h-9 w-7 shrink-0" />
          <div className="min-w-0 font-mono text-[11px] font-medium uppercase leading-snug tracking-[0.16em] text-ink-muted">
            <p className="truncate normal-case text-ink">
              FİŞ No. {String(n).padStart(3, '0')} · <span className="uppercase">{f.flavor}</span>
            </p>
            <p>Dondurma · {vendorName}</p>
          </div>
        </div>
        <Stamp key={open ? f.id : 'closed'} rotate={-12} className="relative z-[1] -mb-4 mt-1 shrink-0" />
      </header>
      <TileDivider className="mb-6 mt-3" />

      <StoryHeading f={f} />
      <StoryBody f={f} />

      <p className="mt-8 text-center font-mono text-[10.5px] uppercase tracking-[0.24em] text-ink-muted">
        ✦ Teşekkürler · afiyet olsun ✦
      </p>
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <button onClick={close} className={`${btn} border-[1.5px] border-ink text-ink hover:bg-ink/[0.06]`}>
          Back to the menu
        </button>
        {nextUp ? (
          <button onClick={() => order(nextUp.id)} className={`${btn} bg-ink text-paper shadow-[0_8px_18px_-10px_rgba(30,27,46,0.9)] hover:-translate-y-0.5 hover:bg-[#2c2843]`}>
            Next: {nextUp.flavor} →
          </button>
        ) : (
          allTasted(tasted) && (
            <button onClick={() => order('wispr')} className={`${btn} bg-plum text-paper shadow-[0_8px_22px_-8px_rgba(107,79,191,0.9)] hover:-translate-y-0.5 hover:brightness-110`}>
              Unlock the secret flavor →
            </button>
          )
        )}
      </div>
    </Sheet>
  )
}
