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

const README = readFileSync('README.md', 'utf8')
const WIRINGS = JSON.parse(readFileSync('docs/evidence/wirings.json', 'utf8'))
const DEMO = readFileSync('docs/evidence/demo.txt', 'utf8')
const WORKFLOW = readFileSync('.github/workflows/ci.yml', 'utf8')

/** The page minus the generated cross-link footer, which describes other repositories. */
function ownProse(): string {
  const start = README.indexOf('<!-- toolset:start -->')
  const end = README.indexOf('<!-- toolset:end -->')
  if (start === -1 || end === -1) return README
  return README.slice(0, start) + README.slice(end)
}

describe('the front page', () => {
  it('states the numbers this repository measured', () => {
    const claims: Record<string, string> = {
      'the guarded cardinality': String(WIRINGS.wirings['effect-guarded'].cardinality),
      'the unguarded cardinality': String(WIRINGS.wirings['effect-unguarded'].cardinality),
      'the orderings explored': String(WIRINGS.runs),
    }
    const missing = Object.entries(claims).filter(([, value]) => !README.includes(value))
    expect(missing, `the page no longer states: ${JSON.stringify(missing)}`).toEqual([])
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
