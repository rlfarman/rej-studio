import React from 'react'
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'

export const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )
  const opacity = Math.min(fadeIn, fadeOut)

  const rise = spring({ frame, fps, config: { damping: 16, mass: 0.7 } })
  const translateY = interpolate(rise, [0, 1], [28, 0])

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, #10261e 0%, #070a10 70%)',
        opacity,
      }}
    >
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          transform: `translateY(${translateY}px)`,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif',
          color: '#f8fafc',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            background:
              'linear-gradient(180deg, #ecfeff 0%, #67e8f9 55%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          REJ Studio
        </div>
        <div
          style={{
            fontSize: 28,
            color: 'rgba(226, 232, 240, 0.72)',
            letterSpacing: '0.02em',
          }}
        >
          Sequence design, accelerated.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
