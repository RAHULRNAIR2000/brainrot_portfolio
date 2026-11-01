import { useEffect, useState } from 'react'
import { vendorName } from '../content/projects'
import { useGame } from '../store/gameStore'

// Bubble tail. Points up toward the vendor, or down when the bubble sits above him.
function Tail({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 22 12" className={`absolute left-8 h-3 w-[22px] ${className}`} aria-hidden>
      <path d="M0 12 11 0l11 12" fill="#f4ead5" stroke="rgba(30,27,46,0.15)" strokeWidth="1" />
      <rect x="0" y="11" width="22" height="2" fill="#f4ead5" />
    </svg>
  )
}

export function Subtitles() {
  const sub = useGame((s) => s.subtitle)
  const phase = useGame((s) => s.phase)
  const [shown, setShown] = useState(0)
  const [visible, setVisible] = useState(false)

  // typewriter + auto-hide
  useEffect(() => {
    if (!sub) return
    setShown(0)
    setVisible(true)
    const step = window.setInterval(() => setShown((n) => (n >= sub.text.length ? n : n + 1)), 24)
    const hide = window.setTimeout(() => setVisible(false), sub.until - performance.now())
    return () => {
      clearInterval(step)
      clearTimeout(hide)
    }
  }, [sub])

  if (!sub) return null
  const lifted = phase === 'menu' || phase === 'story' || phase === 'final'
  const above = phase === 'troll' || phase === 'reward'
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4 transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${
        lifted
          ? 'top-[calc(var(--safe-top)+70px)] sm:top-auto sm:bottom-10 sm:right-[440px]'
          : above
            ? 'bottom-[calc(var(--safe-bottom)+92px)] sm:bottom-[calc(var(--safe-bottom)+80px)]'
            : 'bottom-[calc(var(--safe-bottom)+28px)]'
      }`}
      aria-live="polite"
    >
      <div className="token relative max-w-[min(92vw,520px)] rounded-2xl px-4 pb-3 pt-2.5">
        {lifted ? <Tail className="bottom-[-12px] rotate-180 sm:bottom-auto sm:top-[-12px] sm:rotate-0" /> : <Tail className="top-[-12px]" />}
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-cobalt">{vendorName}</p>
        <p className="display-soft mt-0.5 text-[17px] italic leading-snug text-ink">
          <span>{sub.text.slice(0, shown)}</span>
          <span className="invisible">{sub.text.slice(shown)}</span>
        </p>
      </div>
    </div>
  )
}
