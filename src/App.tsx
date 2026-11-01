import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { audio } from './audio/audioManager'
import { useGame } from './store/gameStore'
import { FinalScoop } from './ui/FinalScoop'
import { HUD } from './ui/HUD'
import { Loader } from './ui/Loader'
import { MenuBoard } from './ui/MenuBoard'
import { SkipView } from './ui/SkipView'
import { StoryCard } from './ui/StoryCard'
import { Subtitles } from './ui/Subtitles'
import { TrollHint } from './ui/TrollHint'

// The 3D chunk loads after first paint so the loader shows instantly.
const Scene = lazy(() => import('./scene/Scene').then((m) => ({ default: m.Scene })))

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [noWebGL, setNoWebGL] = useState(false)
  const muted = useGame((s) => s.muted)
  const skipOpen = useGame((s) => s.skipOpen)

  // the street goes quiet while the plain "just the work" page is open
  useEffect(() => audio.setMuted(muted || skipOpen), [muted, skipOpen])

  useEffect(() => {
    // no WebGL: the work is still one tap away
    const c = document.createElement('canvas')
    if (!(c.getContext('webgl2') || c.getContext('webgl'))) {
      setNoWebGL(true)
      useGame.getState().setSkip(true)
    }
  }, [])

  return (
    <div className="app-h relative w-full overflow-hidden select-none">
      {!noWebGL && (
        <SceneBoundary
          onError={() => {
            setNoWebGL(true)
            useGame.getState().setSkip(true)
          }}
        >
          <Suspense fallback={null}>
            <Scene onReady={() => setReady(true)} />
          </Suspense>
        </SceneBoundary>
      )}
      <MenuBoard />
      <TrollHint />
      <Subtitles />
      <StoryCard />
      <FinalScoop />
      <Loader ready={ready || noWebGL} />
      <HUD />
      {skipOpen && <SkipView canPlay={!noWebGL} />}
    </div>
  )
}
