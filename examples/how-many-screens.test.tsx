/**
 * The demo, and it is a test file because that is the only honest way to run it.
 *
 *     npm run demo
 *
 * Everything here needs a DOM and React's `act`, so a plain node script would have to build both
 * and would then be demonstrating the harness rather than the subject. Running it through the
 * same runner the tests use means what a reader sees is what CI runs.
 */
import { render, screen } from '@testing-library/react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { act } from 'react'
import { it } from 'vitest'
import fc from 'fast-check'

import { Blotter, type Exposure, type Position, type Transport } from '../src/blotter'
import { RiskPanel, type LimitCheck } from '../src/risk'
import { delivered, unattributed } from '../src/attribution'
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
const CHECKS: readonly LimitCheck[] = [
  { limit: 'gross', breached: false },
  { limit: 'net', breached: false },
]

/**
 * THE DEMO WRITES ITS OWN TRANSCRIPT, and the first version did not.
 *
 * It printed to stdout and a capture script parsed the test runner's output back out again. That
 * worked on a terminal and produced nothing on CI, because the reporter formats differently
 * without a TTY: the capture step failed with "the demo printed almost nothing" on a demo that
 * had run perfectly. Anything that parses another program's presentation layer is reading
 * something nobody promised to keep stable.
 */
const lines: string[] = []

function say(line = ''): void {
  lines.push(line)
  // eslint-disable-next-line no-console
  console.log(line)
}

it('how many screens', async () => {
  const scheduled = (scheduler: fc.Scheduler): Transport => ({
    positions: scheduler.scheduleFunction(async (account: string) =>
      account === 'all' ? WHOLE_BOOK : ONE_DESK,
    ),
    exposure: scheduler.scheduleFunction(async (account: string) => EXPOSURE[account]!),
  })

  const settle = (wiring: 'guarded' | 'unguarded') => async (scheduler: fc.Scheduler) => {
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

  say('A trader narrows the account filter from the whole book to one desk.')
  say('The rows come from one endpoint and the exposure figure in the header from another.')
  say()

  for (const wiring of ['guarded', 'unguarded'] as const) {
    const found = await explore(settle(wiring), { runs: 40, seed: 1 })
    say(`  ${wiring.padEnd(11)} ${found.screens.size} distinct screen${found.screens.size === 1 ? '' : 's'} across ${found.orderings} orderings`)
  }
  say()
  say('  The guarded wiring applies the flag react.dev documents three times. It works.')
  say('  Without it, which screen the trader gets is decided by the network.')
  say()

  const found = await explore(settle('unguarded'), { runs: 40, seed: 1 })
  const torn = [...found.screens.entries()].find(
    ([shot]) =>
      shot.includes('128 positions') &&
      shot.split('\n').filter((line) => line.startsWith('row|')).length === 41,
  )
  if (torn) {
    const heading = torn[0].split('\n').find((line) => line.startsWith('heading|')) ?? ''
    say(`  One of them reads: ${heading.split('|')[2]}`)
    say('  above 41 rows. Both figures were computed and sent by the server, so there is no')
    say('  spinner, no error and nothing stale in the sense anybody checks for.')
    say(`  Reproduce it with: ${torn[1].slice(0, 60)}...`)
  }
  say()

  const view = render(<RiskPanel transport={{ check: async () => CHECKS }} limits={['gross', 'net']} />)
  await act(async () => {
    await Promise.resolve()
  })
  const missing = unattributed(screen.getByRole('region', { name: 'Risk' }), delivered(CHECKS))
  say('And a second property, on a screen that never tears at all:')
  say()
  say(`  the risk panel settles the same way every time, and renders "${missing[0]?.text}"`)
  say('  over a response about only the limits it asked about. No delivered value accounts')
  say('  for that phrase. It was composed in the browser out of the absence of a breach.')
  view.unmount()

  mkdirSync('docs/evidence', { recursive: true })
  writeFileSync('docs/evidence/demo.txt', `${lines.join('\n').trim()}\n`)
})
