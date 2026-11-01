import { useId } from 'react'

// Shared pieces of the "Istanbul paper and brass" UI: çini tiles, scoops, stamps, seals.

export const PAPER = '#f4ead5'
export const INK = '#1e1b2e'
const COBALT = '#1d4e9e'
const TURQ = '#2a9d97'
const RED = '#c63b32'

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lum = (c: number[]) => {
  const f = (v: number) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
const PAPER_L = lum(rgb(PAPER))

// Darkens a flavor colour (keeping its hue) until it reads on paper at WCAG AA.
export function inkOn(hex: string, min = 4.5) {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (max + mn) / 2
  const d = max - mn
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  const toRgb = (L: number) => {
    const C = (1 - Math.abs(2 * L - 1)) * s
    const X = C * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = L - C / 2
    const [a, bb, c] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X]
    return [a, bb, c].map((v) => Math.round((v + m) * 255))
  }
  for (let L = l; L > 0.05; L -= 0.02) {
    const c = toRgb(L)
    if ((PAPER_L + 0.05) / (lum(c) + 0.05) >= min) return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
  }
  return INK
}

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '')

function starPath(cx: number, cy: number, R: number, r: number) {
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2
    const rad = i % 2 ? r : R
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(2)} ${(cy + Math.sin(a) * rad).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}
const TILE_STAR = starPath(13, 15, 8, 4.9)

// Iznik tile band: cobalt 8-point stars, turquoise tulip buds, a red heart in each star.
export function TileBand({ height = 18, className = '' }: { height?: number; className?: string }) {
  const id = 'cini' + safeId(useId())
  const w = (height * 26) / 30
  return (
    <svg className={`block w-full ${className}`} height={height} aria-hidden>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={w} height={height} viewBox="0 0 26 30">
          <rect y="0" width="26" height="1.4" fill={COBALT} />
          <rect y="28.6" width="26" height="1.4" fill={COBALT} />
          <path d={TILE_STAR} fill={COBALT} />
          <circle cx="13" cy="15" r="2.4" fill={PAPER} />
          <circle cx="13" cy="15" r="1.2" fill={RED} />
          <path d="M0 11c1.6 1.3 2.2 2.6 2.2 4S1.6 17.7 0 19c-1.6-1.3-2.2-2.6-2.2-4s.6-2.7 2.2-4z" fill={TURQ} />
          <path d="M26 11c1.6 1.3 2.2 2.6 2.2 4s-.6 2.7-2.2 4c-1.6-1.3-2.2-2.6-2.2-4s.6-2.7 2.2-4z" fill={TURQ} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

const MINI_STAR = starPath(9, 9, 7.5, 4.6)

// Hairline with three small tile stars in the middle.
export function TileDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden>
      <span className="h-px flex-1 bg-ink/20" />
      <svg viewBox="0 0 62 18" className="h-[14px] w-auto shrink-0">
        <path d={MINI_STAR} fill={TURQ} transform="translate(0 2) scale(.78)" />
        <path d={MINI_STAR} fill={COBALT} transform="translate(22 0)" />
        <circle cx="31" cy="9" r="1.6" fill={RED} />
        <path d={MINI_STAR} fill={TURQ} transform="translate(48 2) scale(.78)" />
      </svg>
      <span className="h-px flex-1 bg-ink/20" />
    </div>
  )
}

// A scoop on a wafer cone, printed-illustration style.
export function ScoopIcon({ color, className = 'h-9 w-7', empty = false }: { color: string; className?: string; empty?: boolean }) {
  const id = 'cone' + safeId(useId())
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden>
      <defs>
        <clipPath id={id}>
          <path d="M8.5 18.5 16 38.5l7.5-20z" />
        </clipPath>
      </defs>
      <path d="M8.5 18.5 16 38.5l7.5-20z" fill={empty ? 'none' : '#d9a54a'} stroke={INK} strokeOpacity={empty ? 0.35 : 1} strokeWidth="1.3" strokeLinejoin="round" />
      {!empty && (
        <g clipPath={`url(#${id})`} stroke="#8a5a1c" strokeWidth="0.9" opacity="0.7">
          <path d="M6 20l14 14M10 18l14 14M2 22l14 14M26 20 12 34M22 18 8 32M30 22 16 36" />
        </g>
      )}
      <path
        d="M6.3 18.2C4.6 10.6 9.4 4.6 16 4.6s11.4 6 9.7 13.6c-1.2 1.6-3 .6-4.1 2-1.2 1.6-3 .1-5.6.6-2.6-.5-4.4 1-5.6-.6-1.1-1.4-2.9-.4-4.1-2z"
        fill={empty ? 'none' : color}
        stroke={INK}
        strokeOpacity={empty ? 0.35 : 1}
        strokeDasharray={empty ? '2.2 2' : undefined}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {!empty && <ellipse cx="11.6" cy="10.2" rx="2.6" ry="1.6" transform="rotate(-30 11.6 10.2)" fill="#fff" opacity="0.55" />}
    </svg>
  )
}

// Red rubber stamp: TADILDI · TASTED.
export function Stamp({ top = 'Tadıldı', bottom = 'Tasted', rotate = -9, className = '' }: { top?: string; bottom?: string; rotate?: number; className?: string }) {
  return (
    <span
      className={`stamp stamp-in pointer-events-none inline-flex select-none flex-col items-center px-2.5 py-1 leading-none ${className}`}
      style={{ '--r': `${rotate}deg` } as React.CSSProperties}
      aria-label={`${top}, ${bottom}`}
      role="img"
    >
      <span className="font-sans text-[12px] font-extrabold uppercase tracking-[0.14em]">{top}</span>
      <span className="mt-[3px] font-mono text-[8.5px] font-medium uppercase tracking-[0.3em]">· {bottom} ·</span>
    </span>
  )
}

const SEAL =
  'M18 2.5c1.6 0 2.4 1.7 3.9 2.1s3.1-.6 4.4.3.9 2.8 1.9 4 3 1.3 3.5 2.8-.9 2.9-.6 4.4 1.6 2.7 1.1 4.2-2.4 1.6-3 3-.1 3.3-1.4 4.2-3 .1-4.4.7-2.2 2.4-3.8 2.5-2.6-1.4-4.1-1.7-3.1 1-4.4.1-.9-2.8-1.9-4-3-1.3-3.5-2.8.9-2.9.6-4.4-1.6-2.7-1.1-4.2 2.4-1.6 3-3 .1-3.3 1.4-4.2 3-.1 4.4-.7S16.4 2.5 18 2.5z'

// Wax seal for the locked secret flavor.
export function WaxSeal({ className = 'h-10 w-10' }: { className?: string }) {
  const id = 'wax' + safeId(useId())
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden>
      <defs>
        <radialGradient id={id} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#e0574b" />
          <stop offset="0.55" stopColor="#b5332b" />
          <stop offset="1" stopColor="#7d1f1a" />
        </radialGradient>
      </defs>
      <path d={SEAL} fill={`url(#${id})`} />
      <circle cx="18" cy="18" r="10" fill="none" stroke="#5e1612" strokeOpacity="0.45" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="10" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="0.8" transform="translate(-.6 -.6)" />
      <g fill="none" stroke="#f6d9c9" strokeWidth="1.5" strokeLinecap="round" opacity="0.9">
        <rect x="14" y="17.2" width="8" height="6.3" rx="1.2" fill="#f6d9c9" fillOpacity="0.15" />
        <path d="M15.8 17.2v-2a2.2 2.2 0 0 1 4.4 0v2" />
      </g>
    </svg>
  )
}

// Mono label used for receipt metadata.
export function Meta({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted ${className}`}>{children}</p>
}
