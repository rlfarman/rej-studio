import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import type { Shot as ShotType } from './timeline'

type Props = {
  shot: ShotType
  index: number
}

/**
 * A single still with a Ken Burns zoom toward an optional focus rectangle,
 * crossfaded in, with a caption pill that springs up from the bottom.
 */
export const Shot: React.FC<Props> = ({ shot, index }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames, width, height } = useVideoConfig()

  const focus = shot.focus ?? { x: 0.5, y: 0.5, width: 0, height: 0 }
  const focusCx = focus.x + focus.width / 2
  const focusCy = focus.y + focus.height / 2
  const hasFocus = shot.focus !== undefined

  const startScale = hasFocus ? 1.0 : 1.05
  const endScale = hasFocus ? 1.35 : 1.12

  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const easedProgress = 1 - Math.pow(1 - progress, 3)
  const scale = startScale + (endScale - startScale) * easedProgress

  // Translate so the focal point stays centered as we scale in.
  const offsetX = (0.5 - focusCx) * width * scale
  const offsetY = (0.5 - focusCy) * height * scale

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames - 1],
    [1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  )
  const opacity = Math.min(fadeIn, fadeOut)

  const captionY = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, mass: 0.6 },
  })
  const captionOpacity = interpolate(captionY, [0, 1], [0, 1])
  const captionTranslate = interpolate(captionY, [0, 1], [40, 0])

  const captionFade = interpolate(
    frame,
    [durationInFrames - 14, durationInFrames - 2],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0b0f', opacity }}>
      <AbsoluteFill
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: '50% 50%',
        }}
      >
        <Img
          src={staticFile(`frames/${shot.file}`)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </AbsoluteFill>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Focus ring */}
      {hasFocus && (
        <div
          style={{
            position: 'absolute',
            left: `${focus.x * 100}%`,
            top: `${focus.y * 100}%`,
            width: `${focus.width * 100}%`,
            height: `${focus.height * 100}%`,
            border: '2px solid rgba(167, 243, 208, 0.9)',
            borderRadius: 10,
            boxShadow:
              '0 0 0 6px rgba(16, 185, 129, 0.12), 0 0 40px rgba(16, 185, 129, 0.35)',
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            transformOrigin: `${focusCx * 100}% ${focusCy * 100}%`,
            opacity:
              interpolate(frame, [10, 24], [0, 1], {
                extrapolateRight: 'clamp',
              }) * captionFade,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Caption */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: captionOpacity * captionFade,
          transform: `translateY(${captionTranslate}px)`,
        }}
      >
        <div
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
            fontSize: 56,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: '#f8fafc',
            background: 'rgba(10, 12, 18, 0.78)',
            backdropFilter: 'blur(14px)',
            padding: '20px 40px',
            borderRadius: 9999,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {shot.caption}
        </div>
      </div>

      {/* Shot counter (debug-ish, remove if not wanted) */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 48,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 18,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        {String(index + 1).padStart(2, '0')} · REJ Studio
      </div>
    </AbsoluteFill>
  )
}
