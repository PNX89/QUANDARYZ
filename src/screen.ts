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
  for (const element of root.querySelectorAll<HTMLElement>('[role], button, a, input, table, tr, td, th, h1, h2, h3')) {
    const role = element.getAttribute('role') ?? implicitRole(element)
    if (role === '') continue
    nodes.push({
      role,
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
  return nodes.map((node) => `${node.role}|${node.name}|${node.value}`).join('\n')
}
