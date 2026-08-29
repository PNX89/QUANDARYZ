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

/**
 * The manifest, if this is a checkout that has it beside us.
 *
 * A clone of this repository ALONE is a legitimate way to have it, and the contract lives one
 * directory up in the toolset. So the manifest is optional and its absence skips the second
 * test rather than failing it, which is the difference between a check and a trap for anybody
 * who clones a single repository to read it.
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
    const contract = manifest()
    if (contract === null) return

    const body = suite()
    const missing: Record<string, string> = {}
    for (const kind of ['number', 'command', 'output', 'reference'] as const) {
      const name = contract[kind]
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

  it('declares no file exception it no longer needs', () => {
    const contract = manifest()
    if (contract === null) return
    const stale = (contract.fileExceptions ?? []).filter((path) => existsSync(path))
    expect(stale).toEqual([])
  })
})
