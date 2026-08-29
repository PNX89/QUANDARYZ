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

export type WiringName = 'effect-guarded' | 'effect-unguarded' | 'query-keep-previous' | 'query-default'

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
  if (wiring === 'effect-guarded' || wiring === 'effect-unguarded') {
    return (
      <WithEffects transport={transport} account={account} guarded={wiring === 'effect-guarded'} />
    )
  }
  return (
    <QueryClientProvider client={client}>
      <WithQuery
        transport={transport}
        account={account}
        keepPrevious={wiring === 'query-keep-previous'}
      />
    </QueryClientProvider>
  )
}

/** A client with retries off, because a retry is a second delivery and this varies deliveries. */
export function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
}
