import { RULES } from '../game/rules'
import { useGame } from '../store/gameStore'
import { isTouch } from '../utils/deviceTier'

export function TrollHint() {
  const phase = useGame((s) => s.phase)
  const attempts = useGame((s) => s.attempts)
  const currentId = useGame((s) => s.currentId)
  const show = phase === 'troll' && currentId !== 'wispr'
  const touch = isTouch()
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-20 flex justify-center px-3 transition-all duration-500 ${show ? 'opacity-100' : 'translate-y-3 opacity-0'}`}
      style={{ bottom: 'calc(var(--safe-bottom) + 22px)' }}
    >
      <div className="token flex max-w-full flex-col items-center gap-1 rounded-2xl px-4 py-2 font-mono sm:flex-row sm:gap-3 sm:rounded-full">
        <span className="flex items-center gap-3">
          <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink">Catch the cone</span>
          <span className="flex gap-1.5" role="img" aria-label={`${attempts} of ${RULES.maxFails} misses`}>
            {Array.from({ length: RULES.maxFails }).map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${i < attempts ? 'bg-stamp' : 'shadow-[inset_0_0_0_1.5px_rgba(30,27,46,0.3)]'}`}
              />
            ))}
          </span>
        </span>
        <span className="text-[11.5px] text-ink-muted sm:border-l sm:border-ink/15 sm:pl-3">{touch ? 'drag, lift your finger to grab' : 'move, click to grab'}</span>
      </div>
    </div>
  )
}
