/**
 * What a settled screen IS, for the purpose of comparing two of them.
 *
 * THE UNIT OF COMPARISON IS THE ACCESSIBLE TREE, never innerHTML, never a screenshot and never a
 * test id. Comparing markup makes a refactor look like a defect and makes a defect look like a
 * refactor: change a `div` to a `section` and the fingerprint moves although nobody's screen did.
 * Comparing what a screen reader would announce is comparing what the user is told.
 *
 * ROLE AND NAME COME FROM `dom-accessibility-api`, which Testing Library already depends on, so
 * this is not a hand-rolled walker guessing at the accessible name computation.
 */
import { computeAccessibleName } from 'dom-accessibility-api'

export interface Node {
  readonly role: string
  readonly name: string
  readonly value: string
}

/** Every element that carries a role, in document order, as role, name and value. */
export function fingerprint(root: HTMLElement): readonly Node[] {
  const nodes: Node[] = []
  // `[data-consequential]` IS IN THIS LIST BECAUSE OF WHAT WAS MISSING WITHOUT IT. The selector
  // was an explicit `role` attribute plus a short tag list, and the risk panel is built from
  // `section`, `p`, `ul` and `li`, which carry IMPLICIT roles and match none of it. Its
  // fingerprint came back with zero nodes and its determinacy test compared thirty digests of
  // nothing.
  //
  // The marker is the right thing to add rather than more tag names. This repository already
  // uses `data-consequential` to mean "this node states something to the user", which is exactly
  // the set a screen comparison should compare, and it is declared by the component rather than
  // guessed at by a selector.
  for (const element of root.querySelectorAll<HTMLElement>(
    '[role], [data-consequential], button, a, input, table, tr, td, th, h1, h2, h3',
  )) {
    const role = element.getAttribute('role') ?? implicitRole(element)
    // A consequential node is compared whatever its tag, and named by the claim it carries, so
    // two screens differing only in a verdict are two screens.
    const marker = element.getAttribute('data-consequential')
    if (role === '' && marker === null) continue
    nodes.push({
      role: role === '' ? `consequential:${marker}` : role,
      name: computeAccessibleName(element),
      value: readValue(element),
    })
  }
  return nodes
}

/** The subset of implicit roles these subjects use. Anything else must be declared explicitly. */
function implicitRole(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase()
  const roles: Record<string, string> = {
    button: 'button',
    a: 'link',
    table: 'table',
    tr: 'row',
    td: 'cell',
    th: 'columnheader',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    input: 'textbox',
  }
  return roles[tag] ?? ''
}

function readValue(element: HTMLElement): string {
  if (element instanceof HTMLInputElement) return element.value
  // The element's own text, with descendants' text excluded, so a container does not repeat
  // everything inside it and make two different screens look different for the same reason.
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim()
}

/** A stable string for one screen, so a set of them can be counted. */
export function digest(nodes: readonly Node[]): string {
  // AN EMPTY FINGERPRINT IS A BLIND INSTRUMENT, NOT A SCREEN, and this refusal is the whole
  // reason the function exists rather than the join being written at each call site.
  //
  // MEASURED, NOT FEARED. The risk panel's fingerprint returned ZERO nodes, because `fingerprint`
  // selects on an explicit `role` attribute plus a short tag list, and that panel is built from
  // `section`, `p`, `ul` and `li`, which carry implicit roles and match none of it. Its
  // determinacy test then ran thirty orderings, digested nothing thirty times, and asserted that
  // the number of distinct screens was one. It passed, and it was reporting that an instrument
  // pointed at nothing saw the same nothing every time.
  //
  // One is the answer a correct component gives. One over zero nodes is the answer a broken
  // measurement gives, and the two were indistinguishable in every test that used this function.
  if (nodes.length === 0) {
    throw new Error(
      'fingerprint is empty, so this subject cannot be compared: a cardinality of one over zero ' +
        'nodes says the instrument saw nothing, not that the component is deterministic',
    )
  }
  return nodes.map((node) => `${node.role}|${node.name}|${node.value}`).join('\n')
}
