/**
 * The explorer's own two answers, checked directly: what it counts, and what it hands a reader
 * as a way to get back to one of the screens it found.
 *
 * A RECIPE THAT NAMES TWO SCREENS IS NOT A RECIPE, and that is what the published one was. Both
 * numbers here were wrong in the same way and for the same reason, so both are pinned.
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { explore } from '../src/explore'

/**
 * Two endpoints asked about one account, which is the blotter in miniature.
 *
 * fast-check labels a scheduled function by its argument list, so both requests here report as
 * `("desk")` and the label alone cannot say which of the two landed first. Whichever settles
 * last decides the screen, so this subject has exactly two orderings and exactly two screens,
 * and they are told apart by task identity or not at all.
 */
async function settle(scheduler: fc.Scheduler): Promise<string> {
  const rows = scheduler.scheduleFunction(async (account: string) => `rows for ${account}`)
  const header = scheduler.scheduleFunction(async (account: string) => `header for ${account}`)
  let last = ''
  void rows('desk').then((value) => {
    last = value
  })
  void header('desk').then((value) => {
    last = value
  })
  await scheduler.waitIdle()
  return last
}

describe('the explorer', () => {
  it('hands back a reproduction that reaches one screen and not the other', async () => {
    // THE DEFECT THIS PINS. The recipe was the labels alone, so both orderings of this subject
    // recorded `("desk") then ("desk")` and a reader following the published one arrived at
    // either screen. On the blotter it was worse and quieter: twenty four orderings collapsed
    // into six names, four of which covered more than one settled screen, and the demo happened
    // to publish an ambiguous one on the card and in the README.
    const found = await explore(settle, { runs: 20, seed: 3 })
    expect(found.screens.size).toBe(2)
    expect(
      new Set(found.screens.values()).size,
      'two screens were recorded under one reproduction, so following it is a coin flip',
    ).toBe(found.screens.size)
  })

  it('counts delivery orders rather than the runs that drew them', async () => {
    // Twenty draws over a subject with two orderings is two orderings, not twenty. The line
    // printed by the demo says both numbers because they are different numbers, and reporting
    // the second under the first overstated the search on the subject this repository is about.
    const found = await explore(settle, { runs: 20, seed: 3 })
    expect(found.runs).toBe(20)
    expect(found.orderings).toBe(2)
  })
})
