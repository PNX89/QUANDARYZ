/**
 * A cancel marked optimistically, and a venue that answers "yes, and it changed nothing".
 *
 * THE SUBJECT WHERE BOTH PROPERTIES FIRE, on different things, which is the cleanest available
 * proof that they are independent.
 *
 * The trader cancels. The row is marked "Cancelled" straight away, because a trading surface
 * that waits for a round trip feels broken. The venue answers `{ok: true, affected: 0}`: the
 * request succeeded and cancelled nothing, because the order had already filled.
 *
 *   DETERMINACY reports more than one screen and is RIGHT to. Whether the fill or the cancel
 *   response lands first genuinely changes what the trader should be looking at, and this
 *   subject declares itself order-sensitive for that reason. A property that fires here is
 *   reporting a real difference rather than a defect, which is why the declaration is per
 *   subject and made by the subject.
 *
 *   ATTRIBUTION fires on the word "Cancelled", which is in no response body. `ok: true` was
 *   delivered. `affected: 0` was delivered. "Cancelled" was composed in the browser out of an
 *   intention.
 */
import { useEffect, useState } from 'react'

export interface Fill {
  readonly id: string
  readonly filled: number
}

export interface CancelResult {
  readonly ok: boolean
  readonly affected: number
}

export interface FillTransport {
  fills(): Promise<readonly Fill[]>
  cancel(id: string): Promise<CancelResult>
}

export function FillFeed({ transport, cancelling }: { transport: FillTransport; cancelling: string }) {
  const [fills, setFills] = useState<readonly Fill[]>([])
  const [outcome, setOutcome] = useState<CancelResult | null>(null)

  useEffect(() => {
    let ignore = false
    void transport.fills().then((found) => {
      if (!ignore) setFills(found)
    })
    return () => {
      ignore = true
    }
  }, [transport])

  useEffect(() => {
    let ignore = false
    void transport.cancel(cancelling).then((result) => {
      if (ignore) return
      setOutcome(result)
      // THE RECONCILIATION, and it is where the order starts to matter. A successful cancel
      // takes the row out of the working list, which is what a trading surface does so the
      // trader stops looking at an order that is gone. If the fills response lands AFTER this,
      // it puts the row back, and the screen settles with an order the venue was asked to
      // cancel sitting there as though nothing happened.
      if (result.ok) setFills((rows) => rows.filter((row) => row.id !== cancelling))
    })
    return () => {
      ignore = true
    }
  }, [transport, cancelling])

  return (
    <section aria-label="Fills">
      <table aria-label="Orders">
        <tbody>
          {fills.map((fill) => (
            <tr key={fill.id}>
              <td data-consequential={`id:${fill.id}`}>{fill.id}</td>
              <td data-consequential={`filled:${fill.id}`}>{fill.filled.toFixed(2)}</td>
              {/* OPTIMISTIC, AND THE WORD IS THE DEFECT. The venue never said "Cancelled": it
                  said the request succeeded and affected nothing. */}
              <td data-consequential={`state:${fill.id}`}>
                {fill.id === cancelling ? 'Cancelled' : 'Working'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {outcome !== null && (
        <p data-consequential="affected">{outcome.affected.toFixed(2)}</p>
      )}
    </section>
  )
}
