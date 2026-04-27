import React from 'react'
import { Composition } from 'remotion'
import { Walkthrough } from './Walkthrough'
import { OUTRO_SECONDS, timeline } from './timeline'

export const RemotionRoot: React.FC = () => {
  const fps = timeline.fps
  const shotsSeconds = timeline.shots.reduce(
    (s, sh) => s + sh.durationInSeconds,
    0,
  )
  const durationInFrames = Math.max(
    fps,
    Math.round((shotsSeconds + OUTRO_SECONDS) * fps),
  )

  return (
    <Composition
      id="Walkthrough"
      component={Walkthrough}
      durationInFrames={durationInFrames}
      fps={fps}
      width={timeline.width}
      height={timeline.height}
    />
  )
}
