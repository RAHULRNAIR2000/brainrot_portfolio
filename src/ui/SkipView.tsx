import { useEffect } from 'react'
import { finalScoop, flavors, vendorName } from '../content/projects'
import { useGame } from '../store/gameStore'
import { ContactLinks, ThirtyDays } from './FinalScoop'
import { ScoopIcon, TileBand, TileDivider } from './paper'
import { StoryBody, StoryHeading } from './StoryBody'

const chip =
  'flex min-h-[44px] items-center gap-2 rounded-full border border-ink/15 bg-paper px-3.5 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-ink shadow-[0_2px_0_rgba(30,27,46,0.06)] transition hover:-translate-y-0.5 hover:border-ink/40 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt'

// The plain, fast version: a small printed magazine. Everything a recruiter needs, no game required.
export function SkipView({ canPlay }: { canPlay: boolean }) {
  const setSkip = useGame((s) => s.setSkip)
  const phase = useGame((s) => s.phase)
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && canPlay && setSkip(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canPlay, setSkip])

  return (
    <div className="paper app-h scroll-ink fixed inset-0 z-50 select-text overflow-y-auto overflow-x-hidden" style={{ colorScheme: 'light' }}>
      <TileBand height={14} />
      <div className="mx-auto max-w-[760px] px-4 pb-16 sm:px-8" style={{ paddingTop: 'calc(var(--safe-top) + 18px)' }}>
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-ink/40 pb-3">
          <div className="min-w-0">
            <p className="display-hed text-[26px] font-extrabold italic leading-none text-ink">Dondurma</p>
            <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Issue No. 1 · Istanbul / Bengaluru</p>
          </div>
          {canPlay && (
            <button
              onClick={() => setSkip(false)}
              className="min-h-[44px] shrink-0 rounded-lg border-[1.5px] border-ink px-3.5 text-[13px] font-semibold text-ink transition hover:bg-ink/[0.06] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
            >
              {phase === 'loading' || phase === 'gate' ? 'Enter the street' : 'Back to the street'}
            </button>
          )}
        </div>

        <header className="mt-10 sm:mt-14">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cobalt">The work of</p>
          <h1 className="display-hed mt-2 text-[clamp(48px,14vw,104px)] font-extrabold leading-[0.88] text-ink">Rahul R Nair</h1>
          <p className="display-soft mt-6 max-w-[34em] text-[19px] leading-relaxed text-ink-soft sm:text-[21px]">
            I build 0-to-1 AI products and bring AI into how teams work. Three years shipping payments systems, two LLM products end to end, and a
            habit of taking loosely defined problems all the way to done. Bengaluru.
          </p>
          <nav className="mt-8" aria-label="Projects">
            <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-muted">In this issue</p>
            <ul className="flex flex-wrap gap-2">
              {flavors.map((f) => (
                <li key={f.id}>
                  <a href={`#${f.id}`} className={chip}>
                    <ScoopIcon color={f.color} className="h-6 w-5 shrink-0" />
                    {f.project.split(' · ')[0]}
                  </a>
                </li>
              ))}
              <li>
                <a href="#first-30-days" className={chip}>
                  <ScoopIcon color={finalScoop.color} className="h-6 w-5 shrink-0" />
                  <span className="text-plum">First 30 days</span>
                </a>
              </li>
            </ul>
          </nav>
        </header>

        {flavors.map((f, i) => (
          <article key={f.id} id={f.id} className="scroll-mt-6 pt-14 sm:pt-20">
            <TileDivider className="mb-8" />
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              <ScoopIcon color={f.color} className="h-6 w-5 shrink-0" />
              No. {String(i + 1).padStart(2, '0')} · {f.flavor}
            </p>
            <StoryHeading f={f} as="h2" />
            <StoryBody f={f} />
          </article>
        ))}

        <section id="first-30-days" className="scroll-mt-6 pt-14 sm:pt-20">
          <TileDivider className="mb-8" />
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-plum">Secret flavor · {finalScoop.flavor}</p>
          <h2 className="display-hed mb-6 mt-2 text-[clamp(32px,9vw,48px)] font-extrabold leading-[0.98] text-ink">{finalScoop.title}</h2>
          <ThirtyDays />
          <p className="mb-3 mt-8 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">Say hi</p>
          <ContactLinks />
        </section>

        <footer className="mt-16 border-t-[3px] border-double border-ink/40 pt-5 text-[12.5px] leading-relaxed text-ink-muted">
          <p>
            The street and the cart are built in code with three.js and React Three Fiber. {vendorName} is Quaternius&apos; Universal Animation
            Library mannequin, dressed up in code; Pamuk is Quaternius&apos; animated cat (both CC0). Cobblestone, plaster, wood and shutter
            textures and the night sky are from Poly Haven (CC0). {vendorName}&apos;s voice is the Piper TTS &quot;northern_english_male&quot; voice (CC BY-SA 4.0); other sounds are synthesised with Web Audio. Fonts: Fraunces, Inter, IBM Plex Mono and
            Pacifico (SIL Open Font License). Made for the Wispr Flow hiring challenge.
          </p>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.2em]">Teşekkürler · afiyet olsun</p>
        </footer>
      </div>
    </div>
  )
}
