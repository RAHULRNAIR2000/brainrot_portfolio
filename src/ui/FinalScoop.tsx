import { useCallback } from 'react'
import { finalScoop, flavors, vendorName } from '../content/projects'
import { useGame } from '../store/gameStore'
import { ScoopIcon, Stamp, TileDivider } from './paper'
import { Sheet } from './Sheet'

const PLUM = '#6b4fbf'

const ICONS: Record<string, string> = {
  Email: 'M3 6h18v12H3zM3 7l9 6 9-6',
  LinkedIn: 'M4 9h4v11H4zM6 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM11 9h3.8v1.6c.6-1 1.9-1.9 3.7-1.9 3 0 3.5 2 3.5 4.6V20h-4v-5.8c0-1.3-.1-2.6-1.7-2.6s-1.9 1.2-1.9 2.5V20H11z',
  GitHub: 'm8 8-5 4 5 4m8-8 5 4-5 4M14 5l-4 14',
}

// Three ticket stubs.
export function ContactLinks() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {finalScoop.contact.map((c, i) => (
        <a
          key={c.label}
          href={c.href}
          target={c.href.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
          className={`group block rounded-[3px] text-ink transition hover:-translate-y-0.5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt ${
            i === 0 ? 'sm:col-span-2' : ''
          }`}
        >
          <span className="ticket flex min-h-[60px] items-stretch rounded-[3px]">
            <span className="flex w-14 shrink-0 items-center justify-center border-r-[1.5px] border-dashed border-ink/25 pl-1.5" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={PLUM} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS[c.label] ?? ICONS.Email} />
              </svg>
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-2 pr-5">
              <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-plum">{c.label}</span>
              <span className="break-all text-[14px] font-medium leading-snug group-hover:underline group-hover:underline-offset-4">{c.text}</span>
            </span>
          </span>
        </a>
      ))}
    </div>
  )
}

export function ThirtyDays() {
  return (
    <ol className="border-y-[3px] border-double border-ink/30">
      {finalScoop.plan.map((p, i) => (
        <li key={i} className="flex gap-4 border-ink/20 py-4 [&+&]:border-t [&+&]:border-dotted">
          <span className="display-hed w-9 shrink-0 text-[30px] font-extrabold leading-none tabular-nums text-plum">{String(i + 1).padStart(2, '0')}</span>
          <p className="text-[15px] leading-relaxed text-ink/90">{p}</p>
        </li>
      ))}
    </ol>
  )
}

export function FinalScoop() {
  const phase = useGame((s) => s.phase)
  const closeStory = useGame((s) => s.closeStory)
  const close = useCallback(() => closeStory(), [closeStory])
  return (
    <Sheet open={phase === 'final'} onClose={close} accent={PLUM} label={`Secret flavor: ${finalScoop.flavor}`}>
      <header className="flex items-start justify-between gap-3 sm:pr-10">
        <div className="flex min-w-0 items-center gap-2.5">
          <ScoopIcon color={finalScoop.color} className="h-9 w-7 shrink-0" />
          <div className="min-w-0 font-mono text-[11px] font-medium uppercase leading-snug tracking-[0.16em] text-ink-muted">
            <p className="truncate normal-case text-ink">
              FİŞ No. {String(flavors.length + 1).padStart(3, '0')} · <span className="uppercase">Özel</span>
            </p>
            <p>Dondurma · {vendorName}</p>
          </div>
        </div>
        <Stamp top="Özel" bottom="Secret" rotate={-10} className="relative z-[1] -mb-4 mt-1 shrink-0 !text-plum" />
      </header>
      <TileDivider className="mb-6 mt-3" />

      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-plum">Secret flavor · {finalScoop.flavor}</p>
      <h3 className="display-hed mt-2 text-[clamp(32px,9vw,48px)] font-extrabold leading-[0.98] text-ink">{finalScoop.title}</h3>
      <p className="display-soft mt-4 border-l-[3px] pl-3.5 text-[18px] italic leading-snug text-ink-soft sm:text-[20px]" style={{ borderColor: PLUM }}>
        You tasted everything, kid. Here is what I'd do with the first 30 days.
      </p>

      <div className="my-7">
        <ThirtyDays />
      </div>
      <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">Say hi · keep the stub</p>
      <ContactLinks />
      <button
        onClick={close}
        className="mt-8 min-h-[50px] w-full rounded-lg border-[1.5px] border-ink px-5 text-[15px] font-semibold text-ink transition hover:bg-ink/[0.06] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
      >
        Back to the street
      </button>
    </Sheet>
  )
}
