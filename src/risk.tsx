/**
 * A risk panel that reads "Within limits" over an answer about only the limits it asked for.
 *
 * THE SHARPEST OF THE FOUR SUBJECTS, and it is sharp because it is perfectly deterministic. Ask
 * about two limits, get an answer about two limits, render "Within limits". Every ordering
 * settles the same way, so determinacy has nothing to say. What is wrong is that the sentence on
 * the screen is about ALL limits and the response was about the ones in the request.
 *
 * A trader reads "Within limits" as a statement about their risk. It is a statement about a
 * query. Attribution catches it because the phrase is not a delivered value nor a derivation of
 * one: it was composed in the browser out of the absence of a breach.
 */
import { useEffect, useState } from 'react'

export interface LimitCheck {
  readonly limit: string
  readonly breached: boolean
}

export interface RiskTransport {
  check(limits: readonly string[]): Promise<readonly LimitCheck[]>
}

export function RiskPanel({
  transport,
  limits,
}: {
  transport: RiskTransport
  limits: readonly string[]
}) {
  const [checks, setChecks] = useState<readonly LimitCheck[] | null>(null)

  useEffect(() => {
    let ignore = false
    void transport.check(limits).then((found) => {
      if (!ignore) setChecks(found)
    })
    return () => {
      ignore = true
    }
  }, [transport, limits])

  if (checks === null) return <section aria-label="Risk">Checking</section>

  const breached = checks.filter((check) => check.breached)
  return (
    <section aria-label="Risk">
      {/* DECLARED CONSEQUENTIAL, which is what puts it in front of the oracle. A component that
          did not declare this node would pass attribution by saying nothing about it. */}
      <p data-consequential="verdict">
        {breached.length === 0 ? 'Within limits' : `${breached.length} breached`}
      </p>
      <ul>
        {checks.map((check) => (
          <li key={check.limit} data-consequential={`limit:${check.limit}`}>
            {check.limit}
          </li>
        ))}
      </ul>
    </section>
  )
}
