import React from 'react'
import { AbsoluteFill, Sequence } from 'remotion'
import { OUTRO_SECONDS, timeline } from './timeline'
import { Shot } from './Shot'
import { Outro } from './Outro'

export const Walkthrough: React.FC = () => {
  const fps = timeline.fps
  const segments = timeline.shots.reduce<
    {
      shot: (typeof timeline.shots)[number]
      from: number
      durationInFrames: number
    }[]
  >((acc, shot) => {
    const from = acc.length
      ? acc[acc.length - 1].from + acc[acc.length - 1].durationInFrames
      : 0
    return [
      ...acc,
      {
        shot,
        from,
        durationInFrames: Math.round(shot.durationInSeconds * fps),
      },
    ]
  }, [])
  const outroFrom = segments.length
    ? segments[segments.length - 1].from +
      segments[segments.length - 1].durationInFrames
    : 0

  return (
    <AbsoluteFill style={{ backgroundColor: '#05070c' }}>
      {segments.map(({ shot, from, durationInFrames }, index) => (
        <Sequence
          key={shot.file}
          from={from}
          durationInFrames={durationInFrames}
          name={shot.id}
        >
          <Shot shot={shot} index={index} />
        </Sequence>
      ))}

      <Sequence
        from={outroFrom}
        durationInFrames={OUTRO_SECONDS * fps}
        name="outro"
      >
        <Outro />
      </Sequence>
    </AbsoluteFill>
  )
}
