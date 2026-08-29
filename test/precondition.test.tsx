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
import { unnamed } from '../src/precondition'

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
    // WATCHED REFUSING. A precondition nobody has seen reject anything is a precondition that
    // might be checking nothing at all, which is exactly the failure it exists to prevent.
    const view = render(<Unnamed open />)
    const found = await unnamed(screen.getByRole('region', { name: 'Unnamed' }))
    expect(found.length).toBeGreaterThan(0)
    expect(found.map((entry) => entry.id)).toContain('button-name')
    view.unmount()
  })

  it('checks only the rules that decide whether two screens can be told apart', async () => {
    // Running the whole axe suite would fail subjects for contrast or landmarks, which are real
    // accessibility findings and have nothing to do with distinguishing two screens. Mixing them
    // would make this a compliance gate wearing a measurement's clothes.
    const source = (await import('node:fs')).readFileSync('src/precondition.ts', 'utf8')
    expect(source).toContain("runOnly")
    expect(source).toContain('button-name')
    expect(source).not.toContain('color-contrast')
  })
})
