/**
 * A position blotter, wired the way a real one is: three independently guarded requests.
 *
 * THE SUBJECT, AND IT IS DELIBERATELY ORDINARY. Rows come from one endpoint, the mark column
 * from a second, and the net exposure in the header from a third, because a blotter takes its
 * exposure from the risk service rather than multiplying in the browser. Each request guards
 * itself against its own predecessor with the flag react.dev documents, which is correct and is
 * not enough: nothing guards the three against EACH OTHER.
 *
 * Narrow the account filter and the screen can settle with the new rows under the old header.
 * Both numbers were computed and sent by the server, so nothing is stale in the sense anybody
 * checks for, and there is no spinner, no error and no badge.
 */
import { useEffect, useState } from 'react'

export interface Position {
  readonly id: string
  readonly symbol: string
  readonly quantity: number
}

export interface Exposure {
  readonly positions: number
  readonly net: number
}

export interface Transport {
  positions(account: string): Promise<readonly Position[]>
  exposure(account: string): Promise<Exposure>
}

/**
 * The wiring, declared by the caller, because the whole question is what a wiring buys.
 *
 * `guarded` applies the flag react.dev documents three times over. `unguarded` is the same
 * component without it, which is the case the framework's own documentation is about.
 */
export type Wiring = 'guarded' | 'unguarded'

export function Blotter({
  transport,
  account,
  wiring,
}: {
  transport: Transport
  account: string
  wiring: Wiring
}) {
  const [positions, setPositions] = useState<readonly Position[]>([])
  const [exposure, setExposure] = useState<Exposure | null>(null)

  useEffect(() => {
    // The react.dev remedy, applied correctly. It protects this request from an EARLIER
    // request for positions, and it has nothing to say about the exposure request beside it.
    let ignore = false
    void transport.positions(account).then((rows) => {
      if (!ignore || wiring === 'unguarded') setPositions(rows)
    })
    return () => {
      ignore = true
    }
  }, [transport, account, wiring])

  useEffect(() => {
    let ignore = false
    void transport.exposure(account).then((found) => {
      if (!ignore || wiring === 'unguarded') setExposure(found)
    })
    return () => {
      ignore = true
    }
  }, [transport, account, wiring])

  return (
    <section aria-label="Blotter">
      <h2>
        {exposure === null
          ? 'Loading exposure'
          : `${exposure.positions} positions, ${(exposure.net / 1_000_000).toFixed(2)}m net`}
      </h2>
      <table aria-label="Positions">
        <tbody>
          {positions.map((position) => (
            <tr key={position.id}>
              <td>{position.symbol}</td>
              <td>{position.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
