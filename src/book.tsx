/**
 * The order book's symbol switch: the case React's own documentation is about.
 *
 * react.dev prints this remedy three times, in "Fetching data with Effects", in "Synchronizing
 * with Effects" and in "You Might Not Need an Effect". Type BTC, then BTCUSD, and the ladder for
 * the first symbol can land last. The flag fixes it, and this repository ships the fixed version
 * as its CONTROL rather than as its headline, because a repository whose only exhibit is the
 * case the framework already documents has found nothing.
 *
 * ONE QUERY, ONE DELIVERED SNAPSHOT, EVERY RENDERED VALUE FROM IT. Neither property fires here,
 * and this component is still not proved correct: what is proved is that the instrument can
 * return one and can find nothing, which is what makes every other number on the page mean
 * something.
 */
import { useEffect, useState } from 'react'

export interface Level {
  readonly price: number
  readonly size: number
}

export interface BookTransport {
  depth(symbol: string): Promise<readonly Level[]>
}

export function Book({ transport, symbol }: { transport: BookTransport; symbol: string }) {
  const [levels, setLevels] = useState<readonly Level[]>([])

  useEffect(() => {
    let ignore = false
    void transport.depth(symbol).then((found) => {
      if (!ignore) setLevels(found)
    })
    return () => {
      ignore = true
    }
  }, [transport, symbol])

  return (
    <section aria-label="Book">
      <table aria-label="Depth">
        <tbody>
          {levels.map((level) => (
            <tr key={level.price}>
              <td data-consequential={`price:${level.price}`}>{level.price.toFixed(2)}</td>
              <td data-consequential={`size:${level.price}`}>{level.size.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
