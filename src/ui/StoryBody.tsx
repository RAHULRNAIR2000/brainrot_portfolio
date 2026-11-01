import type { Flavor } from '../content/projects'
import { inkOn } from './paper'

const BLOCKS: { key: 'built' | 'broke' | 'learned' | 'next'; label: string; icon: string }[] = [
  { key: 'built', label: 'What I built', icon: 'M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5' },
  { key: 'broke', label: 'What broke', icon: 'M12 3 2 21h20L12 3zm0 6v5m0 3v.5' },
  { key: 'learned', label: 'What I learned', icon: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z' },
  { key: 'next', label: 'What I did next', icon: 'M5 12h14m-6-6 6 6-6 6' },
]

// Placeholder copy (starts with TODO) gets a visible dashed outline so it can't ship by accident.
export function Copy({ text }: { text: string }) {
  const i = text.indexOf('TODO')
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="todo">{text.slice(i)}</span>
    </>
  )
}

// Big title + italic pull line.
export function StoryHeading({ f, as: H = 'h3' }: { f: Flavor; as?: 'h2' | 'h3' }) {
  const [name, ...rest] = f.project.split(' · ')
  const tone = inkOn(f.accent)
  return (
    <>
      <H className="display-hed text-[clamp(30px,8.4vw,46px)] font-extrabold leading-[0.98] text-ink">
        {name}
        {rest.length > 0 && <span className="mt-1.5 block text-[0.5em] font-medium leading-tight text-ink-soft">{rest.join(' · ')}</span>}
      </H>
      <p className="display-soft mt-4 border-l-[3px] pl-3.5 text-[18px] italic leading-snug text-ink-soft sm:text-[20px]" style={{ borderColor: tone }}>
        {f.hook}
      </p>
    </>
  )
}

const COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }

export function Stats({ f }: { f: Flavor }) {
  if (!f.stats.length) return null
  return (
    <dl className={`grid border-y-[3px] border-double border-ink/30 ${COLS[f.stats.length] ?? 'grid-cols-2 sm:grid-cols-4'}`}>
      {f.stats.map((s, i) => (
        <div
          key={i}
          className={`flex flex-col-reverse justify-end px-3 py-3 first:pl-0 ${i > 0 ? 'border-l border-dotted border-ink/25' : ''} ${
            f.stats.length === 4 ? '[&:nth-child(3)]:border-l-0 [&:nth-child(3)]:pl-0 [&:nth-child(n+3)]:border-t sm:[&:nth-child(3)]:border-l sm:[&:nth-child(3)]:pl-3 sm:[&:nth-child(n+3)]:border-t-0' : ''
          }`}
        >
          <dt className="mt-1 font-mono text-[10.5px] uppercase leading-tight tracking-[0.12em] text-ink-muted">{s.label}</dt>
          <dd className="display-hed text-[clamp(28px,7.6vw,40px)] font-extrabold leading-none tabular-nums text-ink">
            <Copy text={s.value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function Timeline({ f }: { f: Flavor }) {
  return (
    <ol className="relative">
      <span className="absolute bottom-4 left-[15px] top-4 w-px bg-ink/30" aria-hidden />
      {BLOCKS.map((b, i) => (
        <li key={b.key} className={`relative flex gap-4 ${i < BLOCKS.length - 1 ? 'pb-6' : ''}`}>
          <span
            className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] bg-paper ${
              b.key === 'broke' ? 'border-stamp text-stamp' : 'border-ink text-ink'
            }`}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d={b.icon} />
            </svg>
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h4 className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">{b.label}</h4>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink/90">
              <Copy text={f[b.key]} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function StackLine({ f }: { f: Flavor }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t border-dashed border-ink/25 pt-3">
      <p className="font-mono text-[12px] leading-relaxed text-ink-soft">
        <span className="mr-2 text-[10.5px] uppercase tracking-[0.18em] text-ink-muted">Stack</span>
        {f.stack.join(' · ')}
      </p>
      {f.link && (
        <a
          href={f.link.href}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[12.5px] font-medium underline decoration-1 underline-offset-4 hover:decoration-2"
          style={{ color: inkOn(f.accent) }}
        >
          {f.link.label} ↗
        </a>
      )}
    </div>
  )
}

// Stats, the four beats and the stack. The heading lives with the caller.
export function StoryBody({ f }: { f: Flavor }) {
  return (
    <>
      <div className="mt-6">
        <Stats f={f} />
      </div>
      <div className="mt-8">
        <Timeline f={f} />
      </div>
      {f.media && (
        <figure className="mt-6 overflow-hidden rounded-sm border border-ink/15 bg-paper-deep p-1.5 shadow-[0_8px_18px_-12px_rgba(30,27,46,0.6)]">
          {f.media.type === 'video' ? (
            <video src={f.media.src} className="w-full" autoPlay muted loop playsInline aria-label={f.media.alt} />
          ) : (
            <img src={f.media.src} alt={f.media.alt} className="w-full" loading="lazy" />
          )}
        </figure>
      )}
      <div className="mt-7">
        <StackLine f={f} />
      </div>
    </>
  )
}
