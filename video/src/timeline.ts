import timelineJson from '../timeline.json'

export type FocusRect = { x: number; y: number; width: number; height: number }
export type Shot = {
  id: string
  file: string
  caption: string
  durationInSeconds: number
  focus?: FocusRect
}
export type Timeline = {
  width: number
  height: number
  fps: number
  shots: Shot[]
}

export const timeline = timelineJson as Timeline

export const OUTRO_SECONDS = 4

export const totalDurationInFrames = Math.round(
  (timeline.shots.reduce((s, sh) => s + sh.durationInSeconds, 0) +
    OUTRO_SECONDS) *
    timeline.fps,
)
