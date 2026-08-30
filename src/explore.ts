/**
 * How many distinct screens a component can settle into, when the same responses arrive in a
 * different order.
 *
 * WHAT THIS ADDS TO fast-check, WHICH IS NOT MUCH AND IS THE POINT. `fc.scheduler` already
 * explores the orderings and already shrinks a counterexample; it is somebody else's maintained
 * library and this repository does not reimplement it. What it does not ship is CARDINALITY:
 * fast-check answers "is there an ordering that breaks this predicate" and stops at the first
 * one. The question here is "how many distinct screens are reachable at all", which needs every
 * ordering explored and each settled screen fingerprinted and counted.
 *
 * ONE is the answer a correct component gives. Anything above one means a user can be shown
 * more than one thing for the same actions and the same data, and which one they get is decided
 * by the network.
 */
import fc from 'fast-check'

export interface Exploration {
  readonly screens: ReadonlyMap<string, string>
  /** How many DISTINCT delivery orders were actually reached. */
  readonly orderings: number
  /** How many times the property ran. Never fewer than `orderings`, usually more. */
  readonly runs: number
}

/**
 * Run `settle` under many delivery orders and collect the distinct screens.
 *
 * `settle` is handed a scheduler, wires it into the transport, drives the interaction, waits for
 * quiescence and returns the fingerprint of what is on the screen.
 */
export async function explore(
  settle: (scheduler: fc.Scheduler) => Promise<string>,
  options: { runs: number; seed?: number },
): Promise<Exploration> {
  const screens = new Map<string, string>()
  // THE COUNT USED TO BE THE NUMBER OF RUNS AND WAS REPORTED AS THE NUMBER OF ORDERINGS, and
  // those are different numbers. fast-check draws an ordering per run and may draw the same one
  // twice, so thirty runs over a subject with two tasks cannot possibly be thirty orderings.
  // Measured on these subjects: forty runs reach seventeen of the blotter's twenty-four possible
  // orders, two of the control's, and one of the risk panel's.
  //
  // Saying "forty orderings" overstated the search by more than a factor of two on the subject
  // the whole repository is about, and understated nothing, which is the direction that costs a
  // reader their trust.
  const orders = new Set<string>()
  let runs = 0

  await fc.assert(
    fc.asyncProperty(fc.scheduler(), async (scheduler) => {
      const digest = await settle(scheduler)
      runs += 1
      orders.add(scheduler.report().map((item) => item.label).join(' then '))
      // The ordering that produced this screen is kept, so a reader is given a way to reproduce
      // it rather than a count they have to trust.
      if (!screens.has(digest)) screens.set(digest, scheduler.report().map((item) => item.label).join(' then '))
      return true
    }),
    { numRuns: options.runs, ...(options.seed === undefined ? {} : { seed: options.seed }) },
  )

  return { screens, orderings: orders.size, runs }
}
