/**
 * The counterexample, reproduced in a real browser with the ordering the explorer printed.
 *
 * WHAT THIS LEG IS FOR, and it is not coverage. Every other test here runs in happy-dom, which
 * is somebody's implementation of a specification: faithful enough for these fingerprints, and
 * still exactly the kind of thing this repository is careful not to trust elsewhere. If the
 * blotter's tear were an artefact of that implementation, this is where it would fail to appear.
 *
 * It runs ONE subject rather than the whole suite, because the question is narrow: does the
 * named counterexample survive leaving the simulation?
 */
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { Blotter, type Exposure, type Position, type Transport } from '../../src/blotter'
import { digest, fingerprint } from '../../src/screen'
import { explore } from '../../src/explore'

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

async function settle(scheduler: fc.Scheduler, wiring: 'guarded' | 'unguarded'): Promise<string> {
  const transport = scheduled(scheduler)
  const view = render(<Blotter transport={transport} account="all" wiring={wiring} />)
  view.rerender(<Blotter transport={transport} account="desk" wiring={wiring} />)
  await act(async () => {
    await scheduler.waitIdle()
  })
  const shot = digest(fingerprint(screen.getByRole('region', { name: 'Blotter' })))
  view.unmount()
  return shot
}

describe('in a real browser', () => {
  it('reproduces the counterexample the simulated DOM found', async () => {
    const found = await explore((scheduler) => settle(scheduler, 'unguarded'), {
      runs: 40,
      seed: 1,
    })
    expect(found.screens.size).toBeGreaterThan(1)

    const wrong = [...found.screens.keys()].find(
      (shot) =>
        shot.includes('128 positions') &&
        shot.split('\n').filter((line) => line.startsWith('row|')).length === 41,
    )
    expect(wrong, 'the tear did not appear outside the simulated DOM').toBeDefined()
  }, 60_000)

  it('still returns exactly one for the control', async () => {
    // The control has to hold HERE as well. If a real browser produced more than one screen for
    // the guarded wiring, the number that makes every other result believable would be an
    // artefact of the simulation.
    const found = await explore((scheduler) => settle(scheduler, 'guarded'), { runs: 40, seed: 1 })
    expect(found.screens.size).toBe(1)
  }, 60_000)
})
