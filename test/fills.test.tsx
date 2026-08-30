/**
 * Both properties, firing on different things about one subject.
 *
 * That they can is the point: a repository shipping two properties has to show they are not two
 * spellings of one.
 */
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { FillFeed, type CancelResult, type Fill, type FillTransport } from '../src/fills'
import { delivered, unattributed } from '../src/attribution'
import { digest, fingerprint } from '../src/screen'
import { explore } from '../src/explore'

const FILLS: readonly Fill[] = [
  { id: 'o-1', filled: 100 },
  { id: 'o-2', filled: 0 },
]
const ANSWER: CancelResult = { ok: true, affected: 0 }

function scheduled(scheduler: fc.Scheduler): FillTransport {
  return {
    fills: scheduler.scheduleFunction(async () => FILLS),
    cancel: scheduler.scheduleFunction(async () => ANSWER),
  }
}

async function settle(scheduler: fc.Scheduler): Promise<string> {
  const view = render(<FillFeed transport={scheduled(scheduler)} cancelling="o-1" />)
  await act(async () => {
    await scheduler.waitIdle()
  })
  const shot = digest(fingerprint(screen.getByRole('region', { name: 'Fills' })))
  view.unmount()
  return shot
}

describe('the fill feed', () => {
  it('reports more than one screen, and is right to', async () => {
    // DECLARED ORDER-SENSITIVE BY THE SUBJECT. Whether the fills or the cancel result lands
    // first genuinely changes what a trader should be looking at, so a count above one here is
    // a real difference rather than a defect. The declaration is per subject and made by the
    // subject, which is the only place that knows.
    const found = await explore(settle, { runs: 40, seed: 4 })
    expect(found.screens.size).toBeGreaterThan(1)
  })

  it('renders a state no response body contains, whichever ordering it settles into', async () => {
    // WHICH WORD SURVIVES DEPENDS ON THE ORDERING, which is the two properties meeting on one
    // subject: determinacy says the screens differ, attribution says the thing they differ
    // about came from nobody. Both words are checked because the point is that neither is in a
    // response body, not that one particular one is.
    const seen = new Set<string>()
    await explore(async (scheduler) => {
      const view = render(<FillFeed transport={scheduled(scheduler)} cancelling="o-1" />)
      await act(async () => {
        await scheduler.waitIdle()
      })
      const region = screen.getByRole('region', { name: 'Fills' })
      for (const entry of unattributed(region, delivered(FILLS, ANSWER))) seen.add(entry.text)
      const shot = digest(fingerprint(region))
      view.unmount()
      return shot
    }, { runs: 40, seed: 5 })

    expect(seen).toContain('Working')
    expect(seen).toContain('Cancelled')

    // THE ORACLE CHECKED AGAINST THE BODIES DIRECTLY, because the two lines above are the
    // oracle reporting on itself. Three assertions stood here instead, `expect(ANSWER.ok)
    // .toBe(true)` and two like it over constants declared at the top of this same file: they
    // compared fixtures with themselves and a comment above them made them read as a finding
    // about the subject. What is actually claimed is that the venue never said either word, and
    // that is a statement about what it sent.
    const bodies = JSON.stringify([FILLS, ANSWER])
    for (const word of seen) {
      expect(bodies, `the oracle called ${word} unaccounted for and it is in a body`).not.toContain(
        word,
      )
    }
  })

  it('accounts for the numbers, so the failure is about the word', async () => {
    const view = render(
      <FillFeed transport={{ fills: async () => FILLS, cancel: async () => ANSWER }} cancelling="o-2" />,
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const missing = unattributed(
      screen.getByRole('region', { name: 'Fills' }),
      delivered(FILLS, ANSWER),
    )
    // Every id and every quantity is a delivered value. What is not attributed is the two
    // states, and naming that precisely is the difference between an oracle and an alarm.
    expect(missing.every((entry) => entry.node.startsWith('state:'))).toBe(true)
    view.unmount()
  })
})
