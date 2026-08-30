/**
 * The shared doc-drift contract, held by the repository that made the declaration.
 *
 * Every repository in this toolset makes checkable claims in its README on purpose, because a
 * claim that was true when written and is false now is worse than one never made: it reads as
 * evidence right up until somebody checks it, and those somebodies are interviewers.
 *
 * THIS FILE EXISTS BECAUSE A COMMENT PROMISED IT. The generator that writes
 * `tests/test_doc_contract.py` into the Python repositories skips this one deliberately, and
 * rightly: pytest is not installed here and never will be, so a Python file asserting the
 * contract would have been generated, committed, and silently unenforced. Its comment then said
 * a repository without Python "declares the same four claim kinds in its own suite instead, and
 * the manifest's contract block names them, so the declaration is checked by the repository that
 * made it". The first half was true. The second half named no file, and nothing here read the
 * manifest at all, so the four names in `toolset.json` were a description rather than a contract.
 *
 * Two things are asserted, and they are the two the Python version asserts:
 *
 *   1. every path the README names resolves in this tree
 *   2. every claim kind the manifest declares for this repository still has a test implementing
 *      it, found by the name the manifest gives
 *
 * The manifest is read from disk rather than copied in here, which is the one difference from
 * the Python version and is a deliberate one: this repository sits beside the manifest in a
 * checkout, so it can hold the real thing to account instead of a snapshot of it.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const README = readFileSync('README.md', 'utf8')

/** Paths a README may name that are extensions this repository actually uses. */
const PATH_CLAIM = /`([A-Za-z0-9_./-]+\.(?:ts|tsx|json|md|yml|yaml|txt|svg|png|lock|html|css))`/g

type Contract = {
  number: string
  command: string
  output: string
  reference: string
  fileExceptions: string[]
}

const KINDS = ['number', 'command', 'output', 'reference'] as const

/**
 * THE DECLARATION, HELD INSIDE THE REPOSITORY THAT MAKES IT.
 *
 * It used to live only in `../toolset.json`, and `manifest()` returns null when that file is not
 * beside this checkout: both contract tests then returned early and reported a pass. That is the
 * layout of a plain `git clone`, and it is the layout of actions/checkout in ci.yml, which takes
 * this repository alone into a directory whose parent holds nothing else. So the contract was
 * enforced on one laptop and nowhere else, in the file whose own docstring says it exists
 * because a generated Python version "would have been generated, committed, and silently
 * unenforced". Renaming all four claim tests in a clone with no sibling manifest gave three
 * passing tests.
 *
 * The manifest is still read, and it is now checked AGAINST this copy rather than instead of it.
 */
const DECLARED: Record<(typeof KINDS)[number], string> = JSON.parse(
  readFileSync('docs/contract.json', 'utf8'),
)

/**
 * The manifest, if this is a checkout that has it beside us.
 *
 * A clone of this repository ALONE is a legitimate way to have it, and the toolset's copy of the
 * contract lives one directory up. So the manifest stays optional: what its absence may skip is
 * the comparison BETWEEN the two declarations, never the enforcement of the one held here.
 */
function manifest(): Contract | null {
  const path = join('..', 'toolset.json')
  if (!existsSync(path)) return null
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  const entry = parsed.repos.find((repo: { name: string }) => repo.name === 'QUANDARYZ')
  return entry?.contract ?? null
}

/**
 * Every test file, read as one string, WITH ITS COMMENTS REMOVED.
 *
 * The comment stripping is not tidiness, it is the whole reason this function exists. The first
 * version of this file searched the raw text for `it('<name>'` and said in a comment beside it
 * that matching the call form rather than a bare substring closed the hole. It did not. Commenting
 * out a test and writing a differently named one beside it left the string present, inside the
 * comment, and this suite stayed green: precisely the failure it claimed to have prevented, in the
 * code that claimed it.
 *
 * Block comments first, then line comments, and neither pattern can see inside a string literal.
 * That is acceptable here because a false FAILURE is the safe direction: a test name written
 * inside a string in some other test would make this report a missing implementation, which sends
 * a reader to look, rather than hiding one.
 */
function suite(): string {
  return readdirSync('test')
    .filter((name) => name.endsWith('.test.ts') || name.endsWith('.test.tsx'))
    .map((name) => readFileSync(join('test', name), 'utf8'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
}

describe('the documentation contract', () => {
  it('names only files that exist in this tree', () => {
    const claims = [...new Set([...README.matchAll(PATH_CLAIM)].map((match) => match[1]!))].sort()
    expect(claims.length).toBeGreaterThan(0)
    const broken = claims.filter((claim) => !existsSync(claim) && !existsSync(join('src', claim)))
    expect(broken).toEqual([])
  })

  it('still implements every claim kind the manifest declares for it', () => {
    // NO EARLY RETURN. This runs in a lone clone and in CI, which is where it never ran before.
    const body = suite()
    const missing: Record<string, string> = {}
    for (const kind of KINDS) {
      const name = DECLARED[kind]
      // Matched as `it('<name>'` against a comment-stripped suite. Both halves are needed and
      // this was proved by trying it: matching the call form alone still passed when the test
      // was commented out, which is the same false pass this toolset shipped once before in a
      // CI check satisfied by its own name inside a YAML comment.
      if (!body.includes(`it('${name}'`) && !body.includes(`it("${name}"`)) {
        missing[kind] = name
      }
    }
    expect(missing).toEqual({})
  })

  it('holds a declaration that came with the clone', () => {
    // The point of the file above: something local to hold the contract to, so that the check
    // is real in every checkout rather than in the one that happens to sit beside the toolset.
    expect(existsSync('docs/contract.json'), 'the contract has nothing local to hold').toBe(true)
    expect(Object.keys(DECLARED).sort()).toEqual([...KINDS].sort())
  })

  it('gives every test its own name, so a claim kind cannot be held by the wrong test', () => {
    // The kinds above are matched by name against the whole suite. Two tests sharing a name
    // means deleting the one that implements the claim leaves the other one answering for it,
    // which is the failure this file is about wearing different clothes.
    const names = [...suite().matchAll(/\bit\('([^']+)'/g)].map((match) => match[1]!)
    const twice = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]
    expect(twice, `these test names appear more than once: ${twice.join(', ')}`).toEqual([])
  })

  it('declares the same contract as the manifest, where the manifest is beside it', () => {
    const contract = manifest()
    if (contract === null) return
    for (const kind of KINDS) {
      expect(contract[kind], `the manifest and docs/contract.json disagree about ${kind}`).toBe(
        DECLARED[kind],
      )
    }
    const stale = (contract.fileExceptions ?? []).filter((path) => existsSync(path))
    expect(stale, 'the manifest declares a file exception it no longer needs').toEqual([])
  })
})
