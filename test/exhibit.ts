/**
 * The exhibit committed as `docs/evidence/wirings.json`, built FROM the measurement rather than
 * beside it.
 *
 * WHY THIS IS A SEPARATE UNIT: so it can be handed a measurement it did not come from. The
 * first version wrote `{ runs: 40, seed: 7, repeats: 3, wirings }`, three literals that happened
 * to agree with three constants elsewhere in the same file. CI gates the build on
 * `git diff --exit-code` of that file, so cutting the real run count from forty to twelve left
 * it byte-identical and the build green: the header recorded what somebody typed beside the
 * measurement, not what the measurement did. The README then quotes those numbers back as the
 * search this repository ran.
 *
 * Every field here is therefore derived from the observations, and a header that would have to
 * state one number for two different searches is refused rather than rounded.
 */

/** One repeat of one wiring, as the explorer reported it. */
export interface Observation {
  /** How many distinct screens this repeat reached. */
  readonly screens: number
  /** How many times the property actually ran, counted by the explorer rather than requested. */
  readonly runs: number
}

export interface Measured {
  readonly observations: readonly Observation[]
  /** Whether the explorer schedules every promise this wiring waits on. */
  readonly fullyScheduled: boolean
}

export interface Committed {
  readonly cardinality?: number
  readonly fullyScheduled: boolean
  readonly reason?: string
}

export interface Exhibit {
  readonly runs: number
  readonly seed: number
  readonly repeats: number
  readonly wirings: Readonly<Record<string, Committed>>
}

/**
 * NO NUMBER AT ALL for a wiring the harness does not fully control, and that is the honest
 * record. Three repeats on one machine returned different counts, so any figure committed here
 * would fail a diff on the next run and the file would be deleted within a fortnight.
 */
const UNCOMMITTED =
  'this library schedules work the explorer does not control, so the count is a ' +
  'lower bound that moves between runs and is not committed'

export function exhibit(measured: Readonly<Record<string, Measured>>, seed: number): Exhibit {
  const entries = Object.values(measured)
  return {
    runs: theOneAgreedValue(
      entries.flatMap((wiring) => wiring.observations.map((observation) => observation.runs)),
      'runs',
    ),
    seed,
    repeats: theOneAgreedValue(
      entries.map((wiring) => wiring.observations.length),
      'repeats',
    ),
    wirings: Object.fromEntries(
      Object.entries(measured).map(([name, wiring]) => [
        name,
        wiring.fullyScheduled
          ? {
              cardinality: Math.min(...wiring.observations.map((observation) => observation.screens)),
              fullyScheduled: true,
            }
          : { fullyScheduled: false, reason: UNCOMMITTED },
      ]),
    ),
  }
}

/** A header stating one number for two different searches is a lie, so it is refused instead. */
function theOneAgreedValue(values: readonly number[], what: string): number {
  const distinct = [...new Set(values)]
  if (distinct.length !== 1) {
    throw new Error(`the measurements disagree about ${what}: ${distinct.join(', ')}`)
  }
  return distinct[0]!
}
