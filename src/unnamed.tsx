/** A deliberately unmeasurable subject, so the precondition can be watched refusing one. */
export function Unnamed({ open }: { open: boolean }) {
  return (
    <section aria-label="Unnamed">
      {/* No text, no aria-label, no title. Two different states of this screen produce the same
          accessible tree, so a fingerprint over it cannot tell them apart. */}
      <button type="button" />
      <p>{open ? 'A' : 'B'}</p>
    </section>
  )
}
