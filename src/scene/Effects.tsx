import { Bloom, ChromaticAberration, EffectComposer, HueSaturation, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { Vector2 } from 'three'
import { useGame } from '../store/gameStore'

const CA = new Vector2(0.0007, 0.0007)

export function Effects() {
  const post = useGame((s) => s.settings.post)
  if (post === 'none') return null
  if (post === 'bloom')
    return (
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.8} luminanceThreshold={1.0} luminanceSmoothing={0.25} radius={0.72} />
        <ToneMapping mode={ToneMappingMode.AGX} />
        <HueSaturation saturation={0.12} />
        <Vignette offset={0.28} darkness={0.65} />
      </EffectComposer>
    )
  return (
    <EffectComposer multisampling={0}>
      <N8AO quality="high" aoRadius={0.7} intensity={2.6} distanceFalloff={0.8} color="#1a0f08" />
      <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1.0} luminanceSmoothing={0.25} radius={0.75} />
      <ChromaticAberration offset={CA} radialModulation modulationOffset={0.35} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <HueSaturation saturation={0.14} />
      <Vignette offset={0.26} darkness={0.7} />
      <Noise opacity={0.04} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  )
}
