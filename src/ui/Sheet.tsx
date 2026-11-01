import { useEffect, useRef, useState, type ReactNode } from 'react'
import { inkOn } from './paper'

// A paper receipt handed over the counter.
// Bottom sheet on phones (swipe down to close), centered modal on desktop.
export function Sheet({ open, onClose, accent, children, label }: { open: boolean; onClose: () => void; accent: string; children: ReactNode; label: string }) {
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setDrag(0)
    scroller.current?.scrollTo({ top: 0 })
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [open, onClose])

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    if ((scroller.current?.scrollTop ?? 0) > 4) return
    start.current = e.clientY
  }
  const onMove = (e: React.PointerEvent) => {
    if (start.current === null) return
    setDrag(Math.max(0, e.clientY - start.current))
  }
  const onUp = () => {
    if (start.current === null) return
    start.current = null
    if (drag > 110) onClose()
    else setDrag(0)
  }

  return (
    <div className={`fixed inset-0 z-30 ${open ? '' : 'pointer-events-none'}`} role="dialog" aria-modal="true" aria-label={label} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-night-950/45 backdrop-blur-[2px] transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 flex justify-center transition-[transform,opacity] sm:inset-0 sm:items-center sm:p-6 ${
          start.current !== null ? 'duration-0' : 'duration-[650ms] ease-[cubic-bezier(.2,.95,.25,1.05)]'
        } ${open ? 'opacity-100' : 'translate-y-full opacity-0 sm:translate-y-8'}`}
        style={open && drag ? { transform: `translateY(${drag}px)` } : undefined}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="w-full sm:max-w-[640px] sm:drop-shadow-[0_28px_36px_rgba(0,0,0,0.6)]">
          <div
            ref={scroller}
            className={`paper receipt scroll-ink relative max-h-[88dvh] w-full overflow-y-auto overflow-x-hidden sm:max-h-[90dvh] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{ colorScheme: 'light' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <div className="sticky top-0 z-10 flex justify-center pb-1 pt-3 sm:hidden">
              <span className="h-1 w-10 rounded-full" style={{ background: inkOn(accent, 3), opacity: 0.5 }} />
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-4 z-10 hidden h-11 w-11 items-center justify-center rounded-full text-ink-soft transition hover:bg-ink/[0.07] hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt sm:flex"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
            <div className="px-5 pb-[calc(var(--safe-bottom)+28px)] pt-2 sm:px-10 sm:pb-12 sm:pt-10">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
