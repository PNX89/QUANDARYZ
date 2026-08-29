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
    const table: Record<string, number> = {}
    for (const wiring of wirings) {
      table[wiring] = await cardinality(wiring)
    }

    // WRITTEN OUT, because the table IS the exhibit. CI diffs this file, so a wiring whose
    // cardinality moves is a red build that names which one moved rather than a number nobody
    // was watching.
    mkdirSync('docs/evidence', { recursive: true })
    writeFileSync(
      'docs/evidence/wirings.json',
      `${JSON.stringify({ runs: 30, seed: 7, cardinality: table }, null, 2)}\n`,
    )

    expect(Object.keys(table)).toHaveLength(4)
    // THE SHAPE, NOT THE RANKING. At least one wiring must return 1, so the instrument is shown
    // capable of finding nothing, and at least one must return more, so the subject is shown
    // capable of tearing. Without both, the table would be unfalsifiable.
    expect(Object.values(table).some((count) => count === 1)).toBe(true)
    expect(Object.values(table).some((count) => count > 1)).toBe(true)
  }, 60_000)
})
