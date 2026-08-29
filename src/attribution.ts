/**
 * Where did the text on this screen come from?
 *
 * THE SECOND PROPERTY, and it answers a question determinacy cannot. A screen can be perfectly
 * deterministic and perfectly wrong: the same thing every time, and that thing invented in the
 * browser. Attribution asks, of every node the component DECLARES consequential, whether its
 * text is either a value present in a delivered response body, or the output of one of a small
 * set of published derivations over such a value.
 *
 * IT IS CONTAINMENT OVER ANNOTATED NODES, NOT DISCOVERY, and that distinction is the whole
 * design. A node nobody marked is invisible to this. That sounds like a weakness and is the
 * opposite: inferring which nodes matter by matching strings against response bodies finds
 * coincidences, and a number that happens to appear in a payload is not the same as a number
 * that came from it. Requiring the component to say which of its nodes carry consequence makes
 * the claim narrow, checkable, and honest about what it does not cover.
 *
 * THE DERIVATIONS ARE PUBLISHED AND CLOSED. Anything not on this list is not an attribution, so
 * a component cannot pass by claiming its own arithmetic is a derivation.
 */

export type Derivation = (value: unknown) => string

/** The complete set. Adding to it is a decision, which is why it is here rather than inline. */
export const DERIVATIONS: Readonly<Record<string, Derivation>> = {
  /** The value itself, rendered as text. */
  identity: (value) => String(value),
  /** A count of a delivered collection. */
  count: (value) => String(Array.isArray(value) ? value.length : Number.NaN),
  /** Millions, to two places, which is how a trading surface shows an exposure. */
  millions: (value) => `${(Number(value) / 1_000_000).toFixed(2)}m`,
  /** A fixed-point number, for a price or a quantity. */
  fixed2: (value) => Number(value).toFixed(2),
  /** A percentage of a delivered value. */
  percent: (value) => `${(Number(value) * 100).toFixed(1)}%`,
  /** A delivered boolean as the words a screen shows. */
  yesNo: (value) => (value ? 'Yes' : 'No'),
}

export interface Delivered {
  /** Every value the transport actually handed the component, flattened. */
  readonly values: readonly unknown[]
}

/** Flatten a response body to the values a screen could legitimately show. */
export function delivered(...bodies: readonly unknown[]): Delivered {
  const values: unknown[] = []
  const walk = (node: unknown): void => {
    values.push(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node !== null && typeof node === 'object') {
      for (const item of Object.values(node)) walk(item)
    }
  }
  for (const body of bodies) walk(body)
  return { values }
}

export interface Unattributed {
  readonly text: string
  readonly node: string
}

/**
 * Every annotated node whose text is not a delivered value or a published derivation of one.
 *
 * An empty result is the property holding. A non-empty one names the text that came from
 * nowhere, which is the only useful form for a failure to take.
 */
export function unattributed(root: HTMLElement, source: Delivered): readonly Unattributed[] {
  const found: Unattributed[] = []
  for (const element of root.querySelectorAll<HTMLElement>('[data-consequential]')) {
    const text = (element.textContent ?? '').trim()
    if (text === '') continue
    const explained = source.values.some((value) =>
      Object.values(DERIVATIONS).some((derive) => {
        try {
          return derive(value) === text
        } catch {
          return false
        }
      }),
    )
    if (!explained) {
      found.push({ text, node: element.getAttribute('data-consequential') ?? '' })
    }
  }
  return found
}
