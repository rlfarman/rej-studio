import { designToolCopy } from '@/features/design-tool/copy'

// The strings live under `recentJobs` because that list was the first to need
// them; "My cloud designs" says it the same way, so two lists in the same
// sidebar don't date their entries differently.
const copy = designToolCopy.recentJobs

/** How long ago an ISO timestamp was, in the sidebar's words ("3d ago"). */
export function formatTimeAgo(dateString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  )
  if (seconds < 60) return copy.justNow
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return copy.minutesAgo(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return copy.hoursAgo(hours)
  const days = Math.floor(hours / 24)
  return copy.daysAgo(days)
}
