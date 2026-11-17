/** Clamp a split point inside a sequence: at least one base either side. */
function clampSplitPoint(position: number, length: number): number {
  return Math.max(1, Math.min(length - 1, position))
}

/**
 * Where the split points were last placed, as exact fractions of the
 * sequence length. Rescaling from the fractions, not from the previous
 * rounded positions, keeps a split where it was while a sequence is typed:
 * rounding and clamping on every keystroke walked it to the last base.
 */
export interface SplitAnchor {
  length: number
  positions: number[]
  fractions: number[]
}

function samePositions(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i])
}

/**
 * Move the split points with the sequence as the user types or deletes:
 * each keeps its relative place. Typing from empty, or clearing the field,
 * starts again from even splits — the empty form's split point is a
 * placeholder, not a choice.
 *
 * Only typing goes through here. Writes that set a sequence together with
 * its split points (a paste, a FASTA upload, reverse translation, a restored
 * draft or design) keep the points they set.
 *
 * `anchor` is the result of the previous call; it is used only while the
 * form still holds the positions it produced.
 */
export function rescaleSplitPoints(
  positions: readonly number[],
  previousLength: number,
  nextLength: number,
  anchor: SplitAnchor | null,
): SplitAnchor {
  const from = Math.max(previousLength, 1)
  const to = Math.max(nextLength, 1)
  const anchored =
    anchor !== null &&
    anchor.length === from &&
    samePositions(anchor.positions, positions)
  const current = anchored ? anchor.fractions : positions.map((p) => p / from)

  if (from === to) {
    return { length: to, positions: [...positions], fractions: current }
  }
  const fractions =
    from <= 1 || to <= 1
      ? positions.map((_, i) => (i + 1) / (positions.length + 1))
      : current
  return {
    length: to,
    positions: fractions.map((f) => clampSplitPoint(Math.round(f * to), to)),
    fractions,
  }
}
