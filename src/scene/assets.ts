import { useEffect, useState } from 'react'

// Optional files dropped into public/ (models, voice lines, sfx). Missing files are fine: callers fall back.
const cache = new Map<string, Promise<boolean>>()

export function fileExists(url: string): Promise<boolean> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url, { method: 'HEAD' })
      .then((r) => r.ok && !(r.headers.get('content-type') || '').includes('text/html'))
      .catch(() => false)
    cache.set(url, p)
  }
  return p
}

// Resolves to the subset of urls that exist, or null while checking.
export function useExisting(urls: string[]) {
  const key = urls.join('|')
  const [found, setFound] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all(urls.map(fileExists)).then((ok) => alive && setFound(urls.filter((_, i) => ok[i])))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return found
}

export const VENDOR_CLIPS = ['idle', 'wave', 'offer', 'taunt', 'dodge', 'laugh', 'surprised', 'celebrate', 'shrug', 'talk'] as const
export type ClipKey = (typeof VENDOR_CLIPS)[number]

// Words that identify each clip when animations come embedded with arbitrary names.
export const CLIP_SYNONYMS: Record<ClipKey, RegExp> = {
  idle: /idle|breath|stand(?!ing_up)/i,
  wave: /wave|greet|hello/i,
  offer: /give|offer|hand.?over|reach/i,
  taunt: /taunt|teas|beckon|come/i,
  dodge: /dodge|swing|spin|swipe/i,
  laugh: /laugh|giggl/i,
  surprised: /surpris|shock|scare/i,
  celebrate: /cheer|celebrat|victory|clap|thumbs|dance/i,
  shrug: /shrug/i,
  talk: /talk|explain|speak|convers/i,
}
