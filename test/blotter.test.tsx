/**
 * The headline defect, counted rather than described.
 *
 * The trader narrows the account filter. Rows come from one endpoint and the exposure figure in
 * the header from another, and both requests guard themselves against their own predecessors
 * exactly as react.dev documents. Nothing guards them against each other.
 *
 * What this asserts is a CARDINALITY. Not "there exists a bad ordering", which is what a
 * property test usually reports, but how many distinct screens a user can be shown for one
 * script of actions. Above one means the network decides what they see.
 */
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { Blotter, type Exposure, type Position, type Transport } from '../src/blotter'
import { digest, fingerprint } from '../src/screen'
import { explore } from '../src/explore'

const WHOLE_BOOK = Array.from({ length: 128 }, (_, index) => ({
  id: `p${index}`,
  symbol: `SYM${index}`,
  quantity: index,
})) satisfies readonly Position[]

const ONE_DESK = WHOLE_BOOK.slice(0, 41)

const EXPOSURE: Record<string, Exposure> = {
  all: { positions: 128, net: 4_820_000 },
  desk: { positions: 41, net: 1_190_000 },
}

/** A transport whose promises are handed to the scheduler, so their order is the thing varied. */
function scheduled(scheduler: fc.Scheduler): Transport {
  return {
    positions: scheduler.scheduleFunction(async (account: string) =>
      account === 'all' ? WHOLE_BOOK : ONE_DESK,
    ),
    exposure: scheduler.scheduleFunction(async (account: string) => EXPOSURE[account]!),
  }
}

async function settleAfterNarrowing(
  scheduler: fc.Scheduler,
  wiring: 'guarded' | 'unguarded',
): Promise<string> {
  const transport = scheduled(scheduler)
  const view = render(<Blotter transport={transport} account="all" wiring={wiring} />)
  // The action: the trader narrows from the whole book to one desk. Four requests are now in
  // flight, two for each account, and any of them can land first.
  view.rerender(<Blotter transport={transport} account="desk" wiring={wiring} />)
  await act(async () => {
    await scheduler.waitIdle()
  })
  const region = screen.getByRole('region', { name: 'Blotter' })
  const shot = digest(fingerprint(region))
  view.unmount()
  return shot
}

describe('the blotter under out-of-order delivery', () => {
  it('is deterministic when every request is guarded, which is the control', async () => {
    // WITHOUT THIS NUMBER EVERY OTHER ONE IS UNFALSIFIABLE. An instrument that never returns 1
    // is an instrument that reports a defect whatever it is pointed at.
    const found = await explore((scheduler) => settleAfterNarrowing(scheduler, 'guarded'), {
      runs: 40,
      seed: 1,
    })
    expect(found.orderings).toBe(40)
    expect(found.screens.size).toBe(1)
  })

  it('settles into more than one screen when the guard is absent', async () => {
    const found = await explore((scheduler) => settleAfterNarrowing(scheduler, 'unguarded'), {
      runs: 40,
      seed: 1,
    })
    expect(found.screens.size).toBeGreaterThan(1)

    const headings = [...found.screens.keys()].map(
      (shot) => shot.split('\n').find((line) => line.startsWith('heading|')) ?? '',
    )
    // BOTH HEADERS WERE COMPUTED AND SENT BY THE SERVER, which is what makes this invisible to
    // every check that looks for staleness: neither number was made up in the browser.
    expect(headings.some((heading) => heading.includes('128 positions'))).toBe(true)
    expect(headings.some((heading) => heading.includes('41 positions'))).toBe(true)
  })

  it('shows the narrowed rows under the whole-book header in at least one ordering', async () => {
    const found = await explore((scheduler) => settleAfterNarrowing(scheduler, 'unguarded'), {
      runs: 40,
      seed: 1,
    })
    const wrong = [...found.screens.keys()].find(
      (shot) =>
        shot.includes('128 positions') &&
        shot.split('\n').filter((line) => line.startsWith('row|')).length === 41,
    )
    expect(wrong, 'no ordering produced the narrowed rows under the whole-book header').toBeDefined()
  })
})
