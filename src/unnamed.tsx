/** A deliberately unmeasurable subject, so the precondition can be watched refusing one. */
export function Unnamed({ open }: { open: boolean }) {
  return (
    <section aria-label="Unnamed">
      {/* No text, no aria-label, no title. Two different states of this screen produce the same
          accessible tree, so a fingerprint over it cannot tell them apart.

          ONE ELEMENT PER RULE THE PRECONDITION RUNS. It carried only the button, so only
          `button-name` had ever been watched refusing anything and the other three names could
          be dropped from the rule list with every gate green. */}
      <button type="button" />
      <a href="/nowhere" />
      <input type="button" />
      <div role="menuitem" tabIndex={0} />
      <p>{open ? 'A' : 'B'}</p>
    </section>
  )
}
