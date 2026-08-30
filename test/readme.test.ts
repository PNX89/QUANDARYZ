/**
 * Every checkable claim on the front page, checked, and written before the page existed.
 *
 * Four kinds of claim, following the contract this toolset shares:
 *
 *     NUMBER     a figure on the page against the measurement that produced it
 *     COMMAND    a command the page offers against what CI actually runs
 *     OUTPUT     a quoted block, line by line, against the transcript it names
 *     REFERENCE  every link and path against what exists
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { NAME_RULES } from '../src/precondition'

const README = readFileSync('README.md', 'utf8')
const WIRINGS = JSON.parse(readFileSync('docs/evidence/wirings.json', 'utf8'))
const DEMO = readFileSync('docs/evidence/demo.txt', 'utf8')
const WORKFLOW = readFileSync('.github/workflows/ci.yml', 'utf8')

/** Counts small enough that the page writes them as words. */
const IN_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** The wiring table, as the name in each row against the figure printed beside it. */
function wiringTable(): Record<string, string> {
  const rows: Record<string, string> = {}
  for (const match of README.matchAll(/^\|\s*`([a-z-]+)`[^|]*\|\s*([^|]+?)\s*\|$/gm)) {
    rows[match[1]!] = match[2]!
  }
  return rows
}

/**
 * The figure the page states inside the phrase that carries it.
 *
 * The phrase is required to be there: a page that has stopped making the claim is not a page
 * that still holds it, and reporting "undefined is not 4" would send a reader looking for a
 * drifted number rather than a deleted sentence.
 */
function stated(pattern: RegExp): string | undefined {
  const found = README.match(pattern)
  expect(found, `the page no longer says anything matching ${pattern.source}`).not.toBeNull()
  return found?.[1]
}

/** A markdown table read as rows of trimmed cells, found by the label in its header. */
function tableRows(header: string): string[][] {
  const lines = README.split('\n')
  const start = lines.findIndex((line) => line.startsWith(header))
  expect(start, `the page no longer carries a table headed ${header}`).toBeGreaterThan(-1)
  const rows: string[][] = []
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break
    rows.push(line.split('|').map((cell) => cell.trim()))
  }
  return rows
}

/** The page minus the generated cross-link footer, which describes other repositories. */
function ownProse(): string {
  const start = README.indexOf('<!-- toolset:start -->')
  const end = README.indexOf('<!-- toolset:end -->')
  if (start === -1 || end === -1) return README
  return README.slice(0, start) + README.slice(end)
}

describe('the front page', () => {
  it('states the numbers this repository measured', () => {
    // EACH FIGURE COMPARED WHERE THE PAGE STATES IT, never searched for across the page. This
    // test built its claims as `String(cardinality)` and asserted `README.includes(value)`,
    // which for a single-digit count is a one-character substring search over nine kilobytes of
    // prose. The unguarded count could be changed from four to two everywhere the page states
    // it and this still passed, satisfied by the `node-24-blue` badge URL. Four of the ten
    // digits appear nowhere on the page, so whether a drift was caught came down to which digit
    // it drifted to.
    const table = wiringTable()
    expect(Object.keys(table).sort()).toEqual(Object.keys(WIRINGS.wirings).sort())
    for (const [wiring, entry] of Object.entries(WIRINGS.wirings) as [
      string,
      { cardinality?: number; fullyScheduled: boolean },
    ][]) {
      if (entry.fullyScheduled) {
        expect(table[wiring], `the wiring table's row for ${wiring}`).toBe(String(entry.cardinality))
      } else {
        // The honest half: no count was committed for these, so none may be printed either.
        expect(table[wiring], `the page prints a count for ${wiring}`).not.toMatch(/\d/)
      }
    }

    // The headline figure, in the sentence a reader takes it from.
    expect(stated(/the answer is (\d+)/)).toBe(
      String(WIRINGS.wirings['effect-unguarded'].cardinality),
    )

    // The search behind that table, stated where the table is introduced.
    expect(stated(/explored over (\d+) runs/)).toBe(String(WIRINGS.runs))
    expect(stated(/repeated (\d+) times/)).toBe(String(WIRINGS.repeats))

    // The precondition's rule count, from the list the precondition runs.
    expect(stated(/(\w+) axe-core rules/)).toBe(IN_WORDS[NAME_RULES.length])
  })

  it('reports a property result only for a subject that property can see', () => {
    // A PASS OVER AN EMPTY NODE SET IS NOT A PASS. Attribution is containment over annotated
    // nodes, so a subject declaring none returns the empty list whatever was delivered. The
    // blotter declares none, and this table published `passes` for it: the absence of a result
    // printed in the same column, in the same words, as a result.
    const subjects: Record<string, string> = {
      'order book': 'src/book.tsx',
      'position blotter': 'src/blotter.tsx',
      'risk panel': 'src/risk.tsx',
      'fill feed': 'src/fills.tsx',
    }
    const rows = tableRows('| subject |')
    // Pinned by name and by number, so deleting a row covers one subject fewer rather than
    // quietly passing with three.
    expect(rows.map((cells) => cells[1])).toEqual(Object.keys(subjects))
    for (const cells of rows) {
      const path = subjects[cells[1]!]!
      const declares = readFileSync(path, 'utf8').includes('data-consequential')
      const cell = cells[3]!
      if (declares) {
        expect(cell, `${path} declares consequential nodes and the table reports ${cell}`).toMatch(
          /passes|fires/,
        )
      } else {
        expect(
          cell,
          `${path} declares no consequential node, so "${cell}" is not a result it can have`,
        ).not.toMatch(/passes|fires/)
      }
    }
  })

  it('says which wirings the harness does not fully control, and does not print a count for them', () => {
    // THE HONEST HALF. Two wirings return a count that moves between runs, so the page must
    // say so rather than quoting whichever number was seen last.
    for (const [name, entry] of Object.entries(WIRINGS.wirings) as [string, { fullyScheduled: boolean }][]) {
      if (entry.fullyScheduled) continue
      expect(README, `the page does not name ${name}`).toContain(name)
    }
    expect(ownProse().toLowerCase()).toContain('does not control')
  })

  it('quotes only lines the demo actually printed', () => {
    const blocks = [...README.matchAll(/<!-- quoted from (\S+) -->\n```text\n([\s\S]*?)```/g)]
    expect(blocks.length, 'no block on the page declares where it was quoted from').toBeGreaterThan(0)
    for (const [, path, body] of blocks) {
      expect(existsSync(path!), `the page quotes ${path}, which does not exist`).toBe(true)
      const source = new Set(readFileSync(path!, 'utf8').split('\n').map((line) => line.trim()))
      for (const line of body!.split('\n')) {
        if (line.trim() === '') continue
        expect(source, `the page quotes ${JSON.stringify(line.trim())} as from ${path}`).toContain(
          line.trim(),
        )
      }
    }
  })

  it('offers only commands CI runs', () => {
    const offered = [...README.matchAll(/^(npm (?:run |ci|test)[^\n]*)$/gm)].map((match) => match[1]!.trim())
    expect(offered.length).toBeGreaterThan(0)
    for (const command of offered) {
      expect(WORKFLOW, `the page offers \`${command}\` and CI never runs it`).toContain(command)
    }
  })

  it('points only at paths that exist', () => {
    const targets = new Set<string>()
    for (const match of README.matchAll(/\]\((?!https?:)([^)#]+)\)/g)) targets.add(match[1]!.trim())
    for (const match of README.matchAll(/`([a-zA-Z0-9_./-]+)`/g)) {
      const found = match[1]!
      if (found.includes('/') && !found.startsWith('-')) targets.add(found)
    }
    const missing = [...targets].filter((target) => !existsSync(target))
    expect(missing, `the page points at paths that do not exist: ${missing.join(', ')}`).toEqual([])
  })

  it('does not claim a running application it does not ship', () => {
    // The card at a public URL is a page describing this repository. It is not a deployed
    // trading surface, and a reader must not be able to read it as one.
    const flat = ownProse().toLowerCase()
    for (const phrase of ['live application', 'deployed app', 'in production', 'real trading']) {
      expect(flat, `the page claims ${phrase}`).not.toContain(phrase)
    }
  })

  it('credits fast-check where a reader meets the mechanism', () => {
    // The scheduler is somebody else's maintained library and the original part is small. Saying
    // so on the first screenful is the difference between a contribution and a claim.
    const firstScreenful = README.split('\n').slice(0, 45).join(' ').toLowerCase()
    expect(firstScreenful).toContain('fast-check')
  })

  it('says what the demo says', () => {
    expect(DEMO).toContain('distinct screen')
    expect(README).toContain('Within limits')
  })
})
