/**
 * Four idiomatic wirings of one subject, and every cardinality printed.
 *
 * A MEASUREMENT, NOT A GATE. Nothing here asserts that one library is better than another, and
 * nothing fails when a number moves: the table is recorded and the reasons are read. Turning it
 * into a gate would make it a ranking, and a ranking is an opinion with a number stapled to it.
 *
 * What IS asserted is the shape of the result: that at least one wiring returns 1, so the
 * instrument is shown capable of finding nothing, and that at least one returns more, so the
 * subject is shown capable of tearing. Without both, the table would be unfalsifiable.
 */
import { render, screen } from '@testing-library/react'
import { writeFileSync, mkdirSync } from 'node:fs'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import type { Exposure, Position, Transport } from '../src/blotter'
import { Wired, freshClient, type WiringName } from '../src/wirings'
import { digest, fingerprint } from '../src/screen'
import { explore } from '../src/explore'

const WHOLE_BOOK: readonly Position[] = Array.from({ length: 128 }, (_, index) => ({
  id: `p${index}`,
  symbol: `SYM${index}`,
  quantity: index,
}))
const ONE_DESK = WHOLE_BOOK.slice(0, 41)
const EXPOSURE: Record<string, Exposure> = {
  all: { positions: 128, net: 4_820_000 },
  desk: { positions: 41, net: 1_190_000 },
}

function scheduled(scheduler: fc.Scheduler): Transport {
  return {
    positions: scheduler.scheduleFunction(async (account: string) =>
      account === 'all' ? WHOLE_BOOK : ONE_DESK,
    ),
    exposure: scheduler.scheduleFunction(async (account: string) => EXPOSURE[account]!),
  }
}

/**
 * WHICH WIRINGS THIS HARNESS ACTUALLY CONTROLS, and it is not all of them.
 *
 * The explorer enumerates orderings by handing every promise to fast-check's scheduler. That
 * works completely for a component whose only async steps are the two requests. A library with
 * its own scheduler does work this harness never sees, so the orderings it explores are a subset
 * and the count it returns is a LOWER BOUND rather than an enumeration.
 *
 * Measured, and this is why the distinction is here rather than in a comment: the two query
 * wirings returned 1 on one machine and 2 on another for the same seed. Committing either number
 * as though it were reproducible would have been the flakiest kind of evidence, the sort that
 * fails once a fortnight and gets deleted.
 */
const FULLY_SCHEDULED: ReadonlySet<WiringName> = new Set(['effect-guarded', 'effect-unguarded'])

async function cardinality(wiring: WiringName, runs = 30): Promise<number> {
  const found = await explore(async (scheduler) => {
    const transport = scheduled(scheduler)
    const client = freshClient()
    const view = render(
      <Wired wiring={wiring} transport={transport} account="all" client={client} />,
    )
    view.rerender(<Wired wiring={wiring} transport={transport} account="desk" client={client} />)
    await act(async () => {
      await scheduler.waitIdle()
    })
    const shot = digest(fingerprint(screen.getByRole('region', { name: 'Blotter' })))
    view.unmount()
    client.clear()
    return shot
  }, { runs, seed: 7 })
  return found.screens.size
}

describe('the wiring matrix', () => {
  it('publishes a cardinality for every wiring, including the ones that return one', async () => {
    const wirings: readonly WiringName[] = [
      'effect-guarded',
      'effect-unguarded',
      'query-default',
      'query-keep-previous',
    ]
    // REPEATED, because a count that moves between runs is not a count. Each wiring is
    // explored three times and the range is recorded, so a wiring the harness does not fully
    // control reports what it actually did rather than whichever number was seen first.
    const table: Record<string, { min: number; max: number; fullyScheduled: boolean }> = {}
    for (const wiring of wirings) {
      const seen = [await cardinality(wiring), await cardinality(wiring), await cardinality(wiring)]
      table[wiring] = {
        min: Math.min(...seen),
        max: Math.max(...seen),
        fullyScheduled: FULLY_SCHEDULED.has(wiring),
      }
      // eslint-disable-next-line no-console
      console.log(`${wiring}: observed ${seen.join(', ')}`)
    }

    // WRITTEN OUT, because the table IS the exhibit. CI diffs this file, so a wiring whose
    // cardinality moves is a red build that names which one moved rather than a number nobody
    // was watching.
    mkdirSync('docs/evidence', { recursive: true })
    // ONLY THE REPRODUCIBLE HALF IS COMMITTED. The wirings this harness fully controls have a
    // stable count and it is recorded; the ones it does not are recorded as a lower bound with
    // the reason, because pinning a number that moves is how an evidence file becomes noise.
    const committed = Object.fromEntries(
      Object.entries(table).map(([wiring, seen]) => [
        wiring,
        seen.fullyScheduled
          ? { cardinality: seen.min, fullyScheduled: true }
          : {
              // NO NUMBER AT ALL, and that is the honest record. Three repeats on one machine
              // returned different counts, so any figure committed here would fail a diff on
              // the next run and the file would be deleted within a fortnight. What is true and
              // stable is that this harness does not enumerate these orderings.
              fullyScheduled: false,
              reason:
                'this library schedules work the explorer does not control, so the count is a ' +
                'lower bound that moves between runs and is not committed',
            },
      ]),
    )
    writeFileSync(
      'docs/evidence/wirings.json',
      `${JSON.stringify({ runs: 30, seed: 7, repeats: 3, wirings: committed }, null, 2)}\n`,
    )

    expect(Object.keys(table)).toHaveLength(4)
    // A COUNT THIS HARNESS CONTROLS MUST NOT MOVE between repeats. If one did, the enumeration
    // would be incomplete for a wiring the harness claims to see all of, which is a defect in
    // the instrument rather than a property of the subject.
    for (const [wiring, seen] of Object.entries(table)) {
      if (seen.fullyScheduled) {
        expect(seen.min, `${wiring} returned different counts across repeats`).toBe(seen.max)
      }
    }
    // THE SHAPE, NOT THE RANKING. At least one wiring returns 1, so the instrument is shown
    // capable of finding nothing, and at least one returns more, so the subject is shown capable
    // of tearing. Without both, the table would be unfalsifiable.
    expect(Object.values(table).some((seen) => seen.max === 1)).toBe(true)
    expect(Object.values(table).some((seen) => seen.min > 1)).toBe(true)
  }, 60_000)
})
