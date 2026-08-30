/**
 * The same subject, wired four idiomatic ways, with every cardinality published.
 *
 * WHY PUBLISH THE ONES THAT EMBARRASS THE INSTRUMENT. A repository that measured four wirings
 * and printed the two that tear would be selecting its evidence. The interesting result is the
 * TABLE: which ordinary, documented, widely recommended way of fetching two things at once can
 * settle into more than one screen, and which cannot. A wiring that returns 1 is not a failure
 * of the instrument, it is the answer for that wiring.
 *
 * THIS IS A MEASUREMENT, NOT A GATE. No test here asserts that a particular library is better,
 * and none fails when a cardinality changes: the numbers are recorded and the reasons are read.
 * Turning it into a gate would make it a ranking, and a ranking is an opinion with a number
 * stapled to it.
 */
import { QueryClient, QueryClientProvider, useQuery, keepPreviousData } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { Exposure, Position, Transport } from './blotter'

/**
 * The four names, and the union is derived from this array rather than typed beside it.
 *
 * `WiringName` used to be its own literal union, and `Wired` dispatched on it with an if that
 * fell through to the query branch for anything not an effects wiring. Adding a fifth name to
 * the union then compiled clean and rendered as TanStack Query, measured by nothing: the test
 * that publishes "every wiring" iterated this same list of four written out a second time by
 * hand, so the new name appeared in no test and no evidence file. Deriving the union from the
 * array, and the test's list from the same array, leaves one place to add a wiring rather than
 * three that can drift apart.
 */
export const WIRING_NAMES = ['effect-guarded', 'effect-unguarded', 'query-keep-previous', 'query-default'] as const

export type WiringName = (typeof WIRING_NAMES)[number]

/** The rendered surface, identical in every wiring, so only the fetching differs. */
function Surface({
  positions,
  exposure,
}: {
  positions: readonly Position[]
  exposure: Exposure | null
}) {
  return (
    <section aria-label="Blotter">
      <h2 data-consequential="header">
        {exposure === null
          ? 'Loading exposure'
          : `${exposure.positions} positions, ${(exposure.net / 1_000_000).toFixed(2)}m net`}
      </h2>
      <table aria-label="Positions">
        <tbody>
          {positions.map((position) => (
            <tr key={position.id}>
              <td data-consequential={`symbol:${position.id}`}>{position.symbol}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function WithEffects({
  transport,
  account,
  guarded,
}: {
  transport: Transport
  account: string
  guarded: boolean
}) {
  const [positions, setPositions] = useState<readonly Position[]>([])
  const [exposure, setExposure] = useState<Exposure | null>(null)

  useEffect(() => {
    let ignore = false
    void transport.positions(account).then((rows) => {
      if (!ignore || !guarded) setPositions(rows)
    })
    return () => {
      ignore = true
    }
  }, [transport, account, guarded])

  useEffect(() => {
    let ignore = false
    void transport.exposure(account).then((found) => {
      if (!ignore || !guarded) setExposure(found)
    })
    return () => {
      ignore = true
    }
  }, [transport, account, guarded])

  return <Surface positions={positions} exposure={exposure} />
}

function WithQuery({
  transport,
  account,
  keepPrevious,
}: {
  transport: Transport
  account: string
  keepPrevious: boolean
}) {
  // `placeholderData: keepPreviousData` is TanStack Query's own documented recommendation for
  // paginated and filtered UIs. It is included BECAUSE it is recommended: the question is what
  // an ordinary reading of the documentation produces, not what a careful reading avoids.
  const rows = useQuery({
    queryKey: ['positions', account],
    queryFn: () => transport.positions(account),
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
  })
  const exposure = useQuery({
    queryKey: ['exposure', account],
    queryFn: () => transport.exposure(account),
    ...(keepPrevious ? { placeholderData: keepPreviousData } : {}),
  })

  return <Surface positions={rows.data ?? []} exposure={exposure.data ?? null} />
}

export function Wired({
  wiring,
  transport,
  account,
  client,
}: {
  wiring: WiringName
  transport: Transport
  account: string
  client: QueryClient
}) {
  switch (wiring) {
    case 'effect-guarded':
    case 'effect-unguarded':
      return (
        <WithEffects transport={transport} account={account} guarded={wiring === 'effect-guarded'} />
      )
    case 'query-default':
    case 'query-keep-previous':
      return (
        <QueryClientProvider client={client}>
          <WithQuery
            transport={transport}
            account={account}
            keepPrevious={wiring === 'query-keep-previous'}
          />
        </QueryClientProvider>
      )
    default: {
      // A FIFTH NAME FAILS HERE, AT THE TYPE CHECKER, RATHER THAN RENDERING SILENTLY AS
      // TANSTACK QUERY. If `wiring` is not one of the four cases above, it is not `never`, and
      // the assignment below does not compile.
      const unreachable: never = wiring
      throw new Error(`unhandled wiring: ${String(unreachable)}`)
    }
  }
}

/** A client with retries off, because a retry is a second delivery and this varies deliveries. */
export function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
}
