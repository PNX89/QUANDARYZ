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
import { Wired, freshClient, WIRING_NAMES, type WiringName } from '../src/wirings'
import { exhibit, type Measured, type Observation } from './exhibit'
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

// THE SEARCH, NAMED ONCE, because the exhibit has to be able to state what it was. These three
// used to appear twice: here as arguments, and again as literals in the object written to
// docs/evidence/wirings.json, where nothing tied the two together.
const RUNS = 40
const SEED = 7
const REPEATS = 3

async function cardinality(wiring: WiringName, runs = RUNS): Promise<Observation> {
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
  }, { runs, seed: SEED })
  // THE RUN COUNT COMES BACK WITH THE RESULT rather than being read off the call beside it, so
  // the exhibit can record the search that happened. `explore` counts the runs it performed.
  return { screens: found.screens.size, runs: found.runs }
}

describe('the wiring matrix', () => {
  it('publishes a cardinality for every wiring, including the ones that return one', async () => {
    // TAKEN FROM src/wirings.tsx RATHER THAN RETYPED HERE. This list used to be its own four
    // literals, so a fifth name added to `WiringName` compiled clean, rendered as TanStack Query
    // and appeared in this loop, this table and docs/evidence/wirings.json exactly zero times.
    // Reading the same array `Wired` derives its union from means "every wiring" cannot mean
    // "every wiring somebody remembered to type twice".
    const wirings: readonly WiringName[] = WIRING_NAMES
    // REPEATED, because a count that moves between runs is not a count. Each wiring is
    // explored three times and the range is recorded, so a wiring the harness does not fully
    // control reports what it actually did rather than whichever number was seen first.
    const table: Record<string, Measured> = {}
    for (const wiring of wirings) {
      const observations: Observation[] = []
      for (let repeat = 0; repeat < REPEATS; repeat += 1) observations.push(await cardinality(wiring))
      table[wiring] = { observations, fullyScheduled: FULLY_SCHEDULED.has(wiring) }
      console.log(`${wiring}: observed ${observations.map((seen) => seen.screens).join(', ')}`)
    }

    // WRITTEN OUT, because the table IS the exhibit. CI diffs this file, so a wiring whose
    // cardinality moves is a red build that names which one moved rather than a number nobody
    // was watching.
    mkdirSync('docs/evidence', { recursive: true })
    // ONLY THE REPRODUCIBLE HALF IS COMMITTED, and the header is derived from the observations
    // rather than typed beside them: see the comment in test/exhibit.ts for what that cost.
    writeFileSync(
      'docs/evidence/wirings.json',
      `${JSON.stringify(exhibit(table, SEED), null, 2)}\n`,
    )

    expect(Object.keys(table)).toHaveLength(WIRING_NAMES.length)
    // A COUNT THIS HARNESS CONTROLS MUST NOT MOVE between repeats. If one did, the enumeration
    // would be incomplete for a wiring the harness claims to see all of, which is a defect in
    // the instrument rather than a property of the subject.
    for (const [wiring, seen] of Object.entries(table)) {
      const counts = seen.observations.map((observation) => observation.screens)
      if (seen.fullyScheduled) {
        expect(Math.min(...counts), `${wiring} returned different counts across repeats`).toBe(
          Math.max(...counts),
        )
      }
    }
    // THE SHAPE, NOT THE RANKING. At least one wiring returns 1, so the instrument is shown
    // capable of finding nothing, and at least one returns more, so the subject is shown capable
    // of tearing. Without both, the table would be unfalsifiable.
    const counts = Object.values(table).map((seen) => seen.observations.map((one) => one.screens))
    expect(counts.some((seen) => Math.max(...seen) === 1)).toBe(true)
    expect(counts.some((seen) => Math.min(...seen) > 1)).toBe(true)
  }, 60_000)
})

describe('the committed exhibit', () => {
  it('states the search the measurement actually ran', () => {
    // THE DEFECT THIS PINS. `runs`, `seed` and `repeats` were written as literals beside the
    // measurement rather than taken from it. Cutting the real run count from forty to twelve
    // left docs/evidence/wirings.json byte-identical, and a `git diff --exit-code` on that file
    // is the only thing in CI watching what was measured.
    const built = exhibit(
      {
        'effect-guarded': {
          observations: [
            { screens: 1, runs: 12 },
            { screens: 1, runs: 12 },
          ],
          fullyScheduled: true,
        },
        'query-default': {
          observations: [
            { screens: 3, runs: 12 },
            { screens: 2, runs: 12 },
          ],
          fullyScheduled: false,
        },
      },
      9,
    )
    expect(built.runs).toBe(12)
    expect(built.repeats).toBe(2)
    expect(built.seed).toBe(9)
    expect(built.wirings['effect-guarded']).toEqual({ cardinality: 1, fullyScheduled: true })
    // A wiring the harness does not fully control carries no number at all, only the reason.
    expect(built.wirings['query-default']).not.toHaveProperty('cardinality')
    expect(built.wirings['query-default']?.reason).toContain('not committed')
  })

  it('refuses to head an exhibit with a number only half the run used', () => {
    expect(() =>
      exhibit(
        {
          'effect-guarded': {
            observations: [
              { screens: 1, runs: 40 },
              { screens: 1, runs: 12 },
            ],
            fullyScheduled: true,
          },
        },
        SEED,
      ),
    ).toThrow(/disagree about runs/)
  })
})

/**
 * A transport whose promises are released by hand, so a screen can be read while a request is
 * still in flight.
 *
 * The scheduler answers how many screens exist across every ordering. These two tests ask the
 * narrower question the wiring table's last two rows depend on: that those rows were produced by
 * TanStack Query at all, and that the two configurations differ. Nothing asked either before, so
 * both rows survived being rewired to plain effects with every gate green.
 */
function heldOpen(): { transport: Transport; deliver: () => Promise<void> } {
  const held: (() => void)[] = []
  return {
    transport: {
      positions: (account) =>
        new Promise((resolve) => held.push(() => resolve(account === 'all' ? WHOLE_BOOK : ONE_DESK))),
      exposure: (account) => new Promise((resolve) => held.push(() => resolve(EXPOSURE[account]!))),
    },
    deliver: async () => {
      for (const release of held.splice(0)) release()
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    },
  }
}

/** What the blotter is showing, read through this repository's own unit of comparison. */
function shown(): { heading: string; rows: number } {
  const nodes = fingerprint(screen.getByRole('region', { name: 'Blotter' }))
  const heading = nodes.find((node) => node.role === 'heading')
  expect(heading, 'the blotter rendered no header at all').toBeDefined()
  return { heading: heading?.value ?? '', rows: nodes.filter((node) => node.role === 'row').length }
}

describe('the two rows the wiring table publishes as TanStack Query', () => {
  it('fetches through the query client it was handed', async () => {
    for (const wiring of ['query-default', 'query-keep-previous'] as const) {
      const { transport, deliver } = heldOpen()
      const client = freshClient()
      const view = render(<Wired wiring={wiring} transport={transport} account="all" client={client} />)
      await deliver()

      expect(shown(), `${wiring} did not render the delivered book`).toEqual({
        heading: '128 positions, 4.82m net',
        rows: 128,
      })
      // THE ROW HAS TO BE ABOUT THE LIBRARY IT NAMES. Rewiring `Wired` to return the effects
      // component for all four names left the published table, the evidence file and every
      // gate untouched, so these two rows were a measurement of the wiring beside them.
      const keys = client
        .getQueryCache()
        .getAll()
        .map((query) => JSON.stringify(query.queryKey))
      expect(keys, `${wiring} never went through the query client`).toContain('["positions","all"]')
      expect(keys).toContain('["exposure","all"]')
      view.unmount()
      client.clear()
    }
  })

  it('keeps the previous screen only in the wiring that asked for it', async () => {
    // The two rows are one option apart. Deleting `placeholderData: keepPreviousData` from both
    // `useQuery` calls made them the same wiring published twice, and nothing noticed: the
    // matrix commits no number for either, and the shape assertions above are satisfied by the
    // two effect wirings on their own.
    const held: Record<string, { heading: string; rows: number }> = {}
    for (const wiring of ['query-default', 'query-keep-previous'] as const) {
      const { transport, deliver } = heldOpen()
      const client = freshClient()
      const view = render(<Wired wiring={wiring} transport={transport} account="all" client={client} />)
      await deliver()
      // The filter narrows and neither request for the desk has come back yet.
      view.rerender(<Wired wiring={wiring} transport={transport} account="desk" client={client} />)
      await act(async () => {
        await Promise.resolve()
      })
      held[wiring] = shown()
      view.unmount()
      client.clear()
    }

    // Keeping the previous screen is what the option is for, and it is also the reason the
    // wiring can settle on a header from one account above rows from another.
    expect(held['query-keep-previous']).toEqual({ heading: '128 positions, 4.82m net', rows: 128 })
    expect(held['query-default']).toEqual({ heading: 'Loading exposure', rows: 0 })
  })
})
