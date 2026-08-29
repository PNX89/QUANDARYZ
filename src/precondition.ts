/**
 * Before either property is worth running: can this screen be told apart from another one?
 *
 * THE FINGERPRINT IS THE ACCESSIBLE TREE, so a screen whose elements have no accessible names is
 * a screen the fingerprint cannot describe. Two genuinely different states would produce the same
 * empty-name tree, the cardinality would come back as 1, and the repository would report that a
 * component is deterministic when in fact its instrument had gone blind.
 *
 * That failure is silent and it flatters the subject, which is the worst combination, so it is
 * a PRECONDITION rather than a finding: a subject that fails it is not measured at all.
 *
 * axe-core does the checking, because the accessible name computation has a specification and a
 * hand-rolled version of it would be a second implementation of the thing being relied upon.
 */
import axe from 'axe-core'

export interface Unnamed {
  readonly id: string
  readonly target: string
}

/**
 * Every interactive or labelled element on this screen that carries no accessible name.
 *
 * An empty result is the precondition holding. A non-empty one names the elements, because
 * "your screen is not measurable" is only actionable with a list attached.
 */
export async function unnamed(root: HTMLElement): Promise<readonly Unnamed[]> {
  const results = await axe.run(root, {
    // THE RULES THAT DECIDE WHETHER A TREE CAN BE COMPARED, and no others. Running the whole
    // suite would fail subjects for contrast or landmarks, which are real accessibility
    // findings and have nothing to do with whether two screens can be distinguished. Mixing
    // them would make this a compliance gate wearing a measurement's clothes.
    runOnly: {
      type: 'rule',
      values: ['button-name', 'link-name', 'input-button-name', 'aria-command-name'],
    },
  })
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      id: violation.id,
      target: node.target.join(' '),
    })),
  )
}
