/**
 * The subject where determinacy passes and attribution fires.
 *
 * A green risk panel meaning "we did not ask about that limit" is perfectly deterministic and
 * perfectly wrong, which is why one property cannot stand in for the other.
 */
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { RiskPanel, type LimitCheck, type RiskTransport } from '../src/risk'
import { delivered, unattributed } from '../src/attribution'
import { digest, fingerprint } from '../src/screen'
import { explore } from '../src/explore'

const ASKED = ['gross', 'net'] as const
const ANSWER: readonly LimitCheck[] = [
  { limit: 'gross', breached: false },
  { limit: 'net', breached: false },
]

function scheduled(scheduler: fc.Scheduler): RiskTransport {
  return { check: scheduler.scheduleFunction(async () => ANSWER) }
}

async function settle(scheduler: fc.Scheduler): Promise<string> {
  const view = render(<RiskPanel transport={scheduled(scheduler)} limits={ASKED} />)
  await act(async () => {
    await scheduler.waitIdle()
  })
  const shot = digest(fingerprint(screen.getByRole('region', { name: 'Risk' })))
  view.unmount()
  return shot
}

describe('the risk panel', () => {
  it('is deterministic, so the first property has nothing to say about it', async () => {
    const found = await explore(settle, { runs: 30, seed: 2 })
    expect(found.screens.size).toBe(1)
  })

  it('renders a verdict that no delivered value can account for', async () => {
    const view = render(<RiskPanel transport={{ check: async () => ANSWER }} limits={ASKED} />)
    await act(async () => {
      await Promise.resolve()
    })
    const region = screen.getByRole('region', { name: 'Risk' })
    const missing = unattributed(region, delivered(ANSWER))

    expect(missing.map((entry) => entry.node)).toContain('verdict')
    const verdict = missing.find((entry) => entry.node === 'verdict')
    expect(verdict?.text).toBe('Within limits')
    view.unmount()
  })

  it('accounts for every limit it did render, so the failure is specific', async () => {
    // The oracle must not simply reject everything: the limit names ARE delivered values, and a
    // property that fires on all of them is a property that names nothing.
    const view = render(<RiskPanel transport={{ check: async () => ANSWER }} limits={ASKED} />)
    await act(async () => {
      await Promise.resolve()
    })
    const missing = unattributed(screen.getByRole('region', { name: 'Risk' }), delivered(ANSWER))
    expect(missing).toHaveLength(1)
    view.unmount()
  })
})
