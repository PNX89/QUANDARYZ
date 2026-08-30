/**
 * The precondition, watched holding and watched refusing.
 *
 * A subject whose accessible tree cannot describe it would report cardinality 1 for a component
 * that tears, because the instrument would be blind rather than the component correct. That
 * failure is silent and it flatters the subject, so it is checked before either property runs.
 */
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'

import { Book, type Level } from '../src/book'
import { RiskPanel, type LimitCheck } from '../src/risk'
import { Unnamed } from '../src/unnamed'
import { NAME_RULES, unnamed } from '../src/precondition'
import { digest, fingerprint } from '../src/screen'

const LADDER: readonly Level[] = [{ price: 61000.75, size: 2 }]
const CHECKS: readonly LimitCheck[] = [{ limit: 'gross', breached: false }]

describe('the precondition', () => {
  it('holds on the subjects that are measured', async () => {
    for (const [label, element] of [
      ['Book', <Book transport={{ depth: async () => LADDER }} symbol="BTCUSD" />],
      ['Risk', <RiskPanel transport={{ check: async () => CHECKS }} limits={['gross']} />],
    ] as const) {
      const view = render(element)
      await act(async () => {
        await Promise.resolve()
      })
      const found = await unnamed(screen.getByRole('region', { name: label }))
      expect(found, `${label} has elements a fingerprint cannot describe`).toEqual([])
      view.unmount()
    }
  })

  it('refuses a subject whose tree cannot describe it', async () => {
    // WATCHED REFUSING, AND BY EVERY RULE IT RUNS. A precondition nobody has seen reject
    // anything is a precondition that might be checking nothing at all, which is exactly the
    // failure it exists to prevent, and three quarters of this one was in that state: the blind
    // subject carried a button and nothing else, so `link-name`, `input-button-name` and
    // `aria-command-name` had never refused a thing and could be dropped with the suite green.
    const view = render(<Unnamed open />)
    const found = await unnamed(screen.getByRole('region', { name: 'Unnamed' }))
    expect(new Set(found.map((entry) => entry.id))).toEqual(new Set(NAME_RULES))
    view.unmount()
  })

  it('checks only the rules that decide whether two screens can be told apart', () => {
    // PINNED BY NAME AND BY LENGTH, against the exported list rather than against the text of
    // the file that declares it. The version of this test that read src/precondition.ts as a
    // string and asserted the names appeared in it was satisfied by a comment: the option was
    // replaced with a broad tag sweep, which is the compliance gate this module exists not to
    // be, the names were written above it in a comment, and every gate stayed green.
    expect([...NAME_RULES]).toEqual([
      'button-name',
      'link-name',
      'input-button-name',
      'aria-command-name',
    ])
  })
})

describe('the fingerprint refuses to report a blind reading', () => {
  it('throws rather than digesting nothing', () => {
    // THE GUARD THAT ALMOST SHIPPED UNWATCHED. Widening the fingerprint to see the risk panel
    // meant no subject produces an empty fingerprint any more, so the refusal added in the same
    // change was exercised by nothing: removing it left the whole suite green. A guard nobody
    // has watched refuse is the defect this repository is about, so it is driven directly here.
    expect(() => digest([])).toThrow(/instrument saw nothing/)
  })

  it('digests a real reading normally', () => {
    // The other half. A guard that refuses everything is an outage, not a safeguard.
    expect(digest([{ role: 'row', name: 'BTCUSD', value: '1' }])).toBe('row|BTCUSD|1')
  })

  it('the risk panel is visible to the fingerprint at all', async () => {
    // THE SUBJECT THAT WAS INVISIBLE. Its determinacy test ran thirty orderings, digested an
    // empty fingerprint thirty times, and asserted the number of distinct screens was one. It
    // passed. What it reported was that an instrument pointed at nothing saw the same nothing
    // every time, which is indistinguishable from a deterministic component in every assertion
    // that existed.
    const view = render(<RiskPanel transport={{ check: async () => CHECKS }} limits={['gross']} />)
    await act(async () => {
      await Promise.resolve()
    })
    const found = fingerprint(screen.getByRole('region', { name: 'Risk' }))
    expect(found.length).toBeGreaterThan(0)
    expect(found.map((node) => node.role)).toContain('consequential:verdict')
    view.unmount()
  })
})
