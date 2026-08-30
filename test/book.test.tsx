/**
 * The control, and the reason every other number in this repository can be believed.
 *
 * An instrument that reports a defect whatever it is pointed at is indistinguishable from one
 * that works. This subject is arranged so that neither property fires, and both are run against
 * it anyway.
 */
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { Book, type BookTransport, type Level } from '../src/book'
import { delivered, unattributed } from '../src/attribution'
import { digest, fingerprint } from '../src/screen'
import { explore } from '../src/explore'

const LADDERS: Record<string, readonly Level[]> = {
  BTC: [
    { price: 61000.5, size: 1.25 },
    { price: 61001, size: 0.5 },
  ],
  BTCUSD: [
    { price: 61000.75, size: 2 },
    { price: 61002.25, size: 0.125 },
  ],
}

function scheduled(scheduler: fc.Scheduler): BookTransport {
  return { depth: scheduler.scheduleFunction(async (symbol: string) => LADDERS[symbol]!) }
}

async function settleAfterSwitch(scheduler: fc.Scheduler): Promise<string> {
  const transport = scheduled(scheduler)
  const view = render(<Book transport={transport} symbol="BTC" />)
  view.rerender(<Book transport={transport} symbol="BTCUSD" />)
  await act(async () => {
    await scheduler.waitIdle()
  })
  const shot = digest(fingerprint(screen.getByRole('region', { name: 'Book' })))
  view.unmount()
  return shot
}

describe('the order book, which is the control', () => {
  it('settles into exactly one screen however the responses are ordered', async () => {
    const found = await explore(settleAfterSwitch, { runs: 40, seed: 3 })
    expect(found.runs).toBe(40)
    // Two tasks, so there are only two orders to reach, and forty runs reach both.
    expect(found.orderings).toBe(2)
    expect(found.screens.size).toBe(1)
  })

  it('shows the ladder for the symbol that was asked for last', async () => {
    const found = await explore(settleAfterSwitch, { runs: 40, seed: 3 })
    const only = [...found.screens.keys()][0]!
    expect(only).toContain('61000.75')
    expect(only, 'the first symbol’s ladder survived the switch').not.toContain('61000.50')
  })

  it('accounts for every consequential node it renders', async () => {
    const view = render(<Book transport={{ depth: async () => LADDERS.BTCUSD! }} symbol="BTCUSD" />)
    await act(async () => {
      await Promise.resolve()
    })
    const missing = unattributed(
      screen.getByRole('region', { name: 'Book' }),
      delivered(LADDERS.BTCUSD),
    )
    expect(missing, 'a node on the control subject came from nowhere').toEqual([])
    view.unmount()
  })
})
