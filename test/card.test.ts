/**
 * The published card, against the run it says it came from.
 *
 * NOTHING READ THIS FILE. The card at https://pnx89.github.io/QUANDARYZ/ carries a test count, a
 * Node version, a release, a claim about how many screens the blotter settles into and the
 * demo's transcript in full, under a note reading "It is committed to the repository and a test
 * fails when it stops matching a live run, so this page cannot quietly drift from the code it
 * describes." No test read it, and the only guard anywhere was a grep in pages.yml for the FIRST
 * line of the transcript, a sentence with no number in it. Every figure on the card could be
 * rewritten, and the transcript replaced with different counts, with the whole suite green and
 * the publication job still willing to deploy.
 *
 * The card is generated outside this repository from a shared manifest and committed here, so
 * what this checks is the committed artefact against the committed evidence: the two things a
 * reader can see.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CARD = readFileSync('site/index.html', 'utf8')
const FACTS = JSON.parse(readFileSync('docs/evidence/facts.json', 'utf8'))
const DEMO = readFileSync('docs/evidence/demo.txt', 'utf8')
const IMAGE = readFileSync('docs/demo.svg', 'utf8')
const WIRINGS = JSON.parse(readFileSync('docs/evidence/wirings.json', 'utf8'))

/** Counts small enough that the card writes them as words. */
const IN_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']

/** One cell of the strip at the top of the card. */
function fact(label: string): string {
  const found = CARD.match(new RegExp(`<dt>${label}</dt><dd>([^<]*)</dd>`))
  expect(found, `the card no longer shows a ${label} figure`).not.toBeNull()
  return found![1]!.trim()
}

/** The five entities the generator escapes, put back, so the block can be compared as text. */
function decoded(html: string): string {
  return html
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&')
}

describe('the published card', () => {
  it('states the facts it was built from', () => {
    expect(fact('Tests')).toBe(String(FACTS.tests))
    expect(fact('Node')).toBe(String(FACTS.node))
    expect(fact('Release')).toBe(String(FACTS.release))
    expect(CARD, 'the card links to a release it does not name').toContain(
      `/releases/tag/${FACTS.release}`,
    )
    expect(CARD).toContain(`Output captured on ${FACTS.captured}.`)
  })

  it('claims the cardinality that was measured, in the sentence that carries it', () => {
    // The most prominent figure on the page, and the one a reviewer takes away from it. It is
    // written as a word rather than a digit, which is why it is matched inside its own phrase:
    // searching the page for a number finds a badge URL, and searching it for a word finds
    // whatever the prose happens to say elsewhere.
    const claim = CARD.match(/<p class="claim">([\s\S]*?)<\/p>/)
    expect(claim, 'the card no longer leads with a claim').not.toBeNull()
    const said = claim![1]!.match(/settles into (\w+) different screens/)
    expect(said, 'the card no longer says how many screens the blotter settles into').not.toBeNull()
    expect(said?.[1]).toBe(IN_WORDS[WIRINGS.wirings['effect-unguarded'].cardinality])
  })

  it('shows the transcript the demo printed, to the character', () => {
    // Not a substring of it, and not its first line: the whole block. A card built from an
    // older capture publishes counts this repository no longer produces, and the reader has no
    // way to tell because the transcript looks exactly like a transcript.
    const block = CARD.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)
    expect(block, 'the card no longer carries the captured output at all').not.toBeNull()
    expect(decoded(block![1]!).trim()).toBe(DEMO.trim())
  })

  it('renders the same transcript into the image on the front page', () => {
    // The third published copy. The reproduction line that named two screens was committed to
    // the transcript, pasted into this card AND drawn into docs/demo.svg, which is the first
    // thing on the README, so a stale capture reaches a reader three ways.
    const drawn = [...IMAGE.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
      .map((line) => decoded(line[1]!))
      .filter((line) => line.trim() !== '' && !line.startsWith('$ '))
    expect(drawn).toEqual(DEMO.trim().split('\n').filter((line) => line.trim() !== ''))
  })
})
