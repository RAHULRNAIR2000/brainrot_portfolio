import { finalScoop, flavors } from '../content/projects'
import { allTasted, useGame } from '../store/gameStore'
import { ScoopIcon, Stamp, TileBand, WaxSeal } from './paper'

const rowBase =
  'group relative flex min-h-[56px] w-full items-center gap-3 rounded-md px-2 py-2 text-left transition duration-200 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cobalt'

export function MenuBoard() {
  const phase = useGame((s) => s.phase)
  const tasted = useGame((s) => s.tasted)
  const order = useGame((s) => s.order)
  const open = phase === 'menu'
  const unlocked = allTasted(tasted)

  return (
    <aside
      className={`fixed z-20 transition-all duration-700 ease-[cubic-bezier(.2,.9,.25,1)]
        inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-1/2 sm:w-[384px] sm:-translate-y-1/2 sm:-rotate-[1.5deg]
        ${open ? 'translate-y-0 opacity-100 sm:translate-x-0' : 'pointer-events-none translate-y-[110%] opacity-0 sm:translate-x-[120%] sm:translate-y-[-50%]'}`}
      aria-hidden={!open}
      aria-label="Menu"
    >
      {/* brass pin holding the card to the cart */}
      <span
        className="absolute left-1/2 top-1.5 z-10 hidden h-3.5 w-3.5 -translate-x-1/2 rounded-full sm:block"
        style={{ background: 'radial-gradient(circle at 35% 30%, #fbe3a6, #c9993f 55%, #7a5a1f)', boxShadow: '0 2px 3px rgba(0,0,0,.45)' }}
        aria-hidden
      />
      <div
        className="paper mx-auto flex max-h-[52dvh] flex-col overflow-hidden rounded-t-[20px] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.7)] sm:max-h-[78dvh] sm:rounded-[6px] sm:shadow-[0_2px_0_rgba(30,27,46,0.12),0_28px_50px_-18px_rgba(0,0,0,0.85),0_10px_18px_-10px_rgba(0,0,0,0.6)]"
        style={{ colorScheme: 'light' }}
      >
        <TileBand height={16} className="shrink-0" />
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-ink/20 sm:hidden" />
        <header className="mx-4 shrink-0 border-b border-ink/15 pb-2.5 pt-1 sm:mx-6 sm:pb-3 sm:pt-5">
          <div className="flex items-end justify-between gap-3">
            <h2 className="display-hed text-[38px] font-extrabold leading-[0.9] text-ink sm:text-[46px]">Menü</h2>
            <p className="pb-1 font-mono text-[10.5px] font-medium tabular-nums text-ink-muted">
              {tasted.length}/{flavors.length} tasted
            </p>
          </div>
          <p className="mt-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cobalt">Maraş usulü · since 1923</p>
          <p className="mt-2 hidden text-[13px] leading-snug text-ink-soft sm:block">
            One flavor, one project. Catch the cone to taste it. He never makes it easy, but he always gives in.
          </p>
        </header>

        <ul className="scroll-ink min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-[calc(var(--safe-bottom)+12px)] pt-1 sm:px-4 sm:pb-5">
          {flavors.map((f, i) => {
            const done = tasted.includes(f.id)
            return (
              <li key={f.id} className="rise" style={{ animationDelay: open ? `${i * 60}ms` : '0ms' }}>
                <button
                  tabIndex={open ? 0 : -1}
                  onClick={() => order(f.id)}
                  aria-label={`${f.flavor}: ${f.project}${done ? ', tasted' : ''}`}
                  className={`${rowBase} hover:-translate-y-0.5 hover:bg-ink/[0.045] hover:shadow-[0_6px_14px_-10px_rgba(30,27,46,0.6)]`}
                >
                  <ScoopIcon color={f.color} className="h-10 w-8 shrink-0 transition-transform duration-300 group-hover:-rotate-6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-end gap-2">
                      <span className="display-soft text-[18px] font-semibold leading-tight text-ink">{f.flavor}</span>
                      <span className="leader mb-[5px] h-1 min-w-[12px] flex-1" aria-hidden />
                      <span className="font-mono text-[11px] font-medium tabular-nums text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">{f.project}</span>
                  </span>
                  {done && <Stamp rotate={-11} className="absolute right-7 top-1/2 -mt-4" />}
                </button>
              </li>
            )
          })}
          <li className="rise mt-1 border-t border-dashed border-ink/20 pt-1" style={{ animationDelay: open ? `${flavors.length * 60}ms` : '0ms' }}>
            <button
              tabIndex={open ? 0 : -1}
              disabled={!unlocked}
              onClick={() => order('wispr')}
              className={`${rowBase} ${
                unlocked
                  ? 'bg-[#b48cff]/[0.12] shadow-[0_0_0_1px_#b48cff,0_0_22px_-2px_rgba(180,140,255,0.75)] hover:-translate-y-0.5 hover:bg-[#b48cff]/20'
                  : 'cursor-not-allowed'
              }`}
            >
              {unlocked ? <ScoopIcon color={finalScoop.color} className="h-10 w-8 shrink-0" /> : <WaxSeal className="h-10 w-8 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className={`display-soft block text-[18px] font-semibold leading-tight ${unlocked ? 'text-plum' : 'text-ink-soft'}`}>
                  {unlocked ? `Secret: ${finalScoop.flavor}` : 'Secret flavor'}
                </span>
                <span className={`mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] ${unlocked ? 'text-plum' : 'text-ink-muted'}`}>
                  {unlocked ? 'My first 30 days · open it' : `Sealed · taste all ${flavors.length} · ${tasted.length}/${flavors.length}`}
                </span>
              </span>
              {!unlocked && (
                <span className="flex shrink-0 gap-1" aria-hidden>
                  {flavors.map((f) => (
                    <span key={f.id} className={`h-1.5 w-1.5 rounded-full ${tasted.includes(f.id) ? 'bg-stamp' : 'bg-ink/20'}`} />
                  ))}
                </span>
              )}
            </button>
          </li>
        </ul>
      </div>
    </aside>
  )
}
