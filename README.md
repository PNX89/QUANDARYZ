# QUANDARYZ

**How many different screens can one component settle into, when the responses it asked for
arrive in a different order? For a blotter whose rows and whose header come from two endpoints,
the answer is 4, and every figure on every one of them was computed and sent by the server.**

[![CI](https://github.com/PNX89/QUANDARYZ/actions/workflows/ci.yml/badge.svg)](https://github.com/PNX89/QUANDARYZ/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-24-blue)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

<!-- quoted from docs/evidence/demo.txt -->
```text
  guarded     1 distinct screen across 40 orderings

  unguarded   4 distinct screens across 40 orderings
```

**fast-check** does the exploring. Its `fc.scheduler` already permutes delivery orders and
already shrinks a counterexample, and none of that is reimplemented here: it is somebody else's
maintained library. What this adds is the part it does not ship. `fc.assert` answers *is there an
ordering that breaks this* and stops at the first one; the question here is *how many distinct
screens can a user be shown*, which needs every ordering explored and each settled screen
fingerprinted and counted.

One file to start with: [`src/explore.ts`](src/explore.ts).

## What a settled screen is

The unit of comparison is the **accessible tree**: role, accessible name and value, for every
element that carries one. Never `innerHTML`, never a screenshot, never a test id.

Comparing markup makes a refactor look like a defect and a defect look like a refactor. Change a
`div` to a `section` and the fingerprint moves although nobody's screen did. Comparing what a
screen reader would announce is comparing what the user is told. Role and name resolution comes
from `dom-accessibility-api`, which Testing Library already depends on, rather than from a
hand-rolled walker guessing at a specification.

**A screen whose elements have no accessible names cannot be described by that fingerprint**, so
two genuinely different states would look identical, the count would come back as 1, and this
repository would report a component deterministic when its instrument had gone blind. That is
checked before either property runs, with four axe-core rules and no others, and it has been
watched refusing a subject written to fail it.

## Two properties, and four subjects to prove they are two

| subject | determinacy | attribution |
|---|---|---|
| order book | passes | passes |
| position blotter | **fires** | passes |
| risk panel | passes | **fires** |
| fill feed | **fires** | **fires** |

**DETERMINACY** counts the distinct screens reachable by permuting delivery order. **ATTRIBUTION**
asks, of every node the component declares consequential, whether its text is a delivered value
or one of six published derivations of one.

The order book is the control, and it is also the case react.dev documents three times over. It
ships as the control rather than as the headline, because a repository whose only exhibit is the
case the framework already covers has found nothing. Without an arrangement that returns 1 and
finds nothing, every other number here would be unfalsifiable.

The risk panel is the sharpest. It renders `Within limits` over a response about only the limits
it was asked about. Every ordering settles identically, so determinacy has nothing to say, and
the sentence is about all limits while the answer was about two. A trader reads it as a statement
about their risk; it is a statement about a query.

**ATTRIBUTION is containment over annotated nodes, not discovery.** A node nobody marked is
invisible to it. Inferring which nodes matter by matching text against response bodies finds
coincidences, and a number that happens to appear in a payload is not one that came from it.

## Four idiomatic wirings, and the two this harness cannot fully see

The same subject, fetched four ways:

| wiring | distinct settled screens |
|---|---|
| `effect-guarded`, the react.dev flag on both requests | 1 |
| `effect-unguarded` | 4 |
| `query-default` | not committed |
| `query-keep-previous` | not committed |

The last two are the honest part. The explorer enumerates orderings by handing every promise to
the scheduler, which is complete for a component whose only async steps are its two requests. A
library that schedules its own work does things the harness **does not control**, so what comes
back is a lower bound on a subset. Measured across repeats it moved between runs, so no figure
for those two is committed: an evidence file carrying a number that changes is one people delete.

What can be said is that both TanStack Query configurations settled into more than one screen on
some runs, including with `placeholderData: keepPreviousData`, which is that library's own
documented recommendation for filtered views.

## In a real browser

The same counterexample is reproduced in Chromium, and the control is checked there too. If the
tear were an artefact of the simulated DOM this is where it would fail to appear, and if the
control returned more than one there, the number that makes every other result believable would
itself be an artefact. Chromium only, headless shell, because one engine answers whether the
result survives leaving the simulation and three would answer a question about engine differences
that nothing here investigates.

## Run it

```text
npm ci
npm test
npm run demo
```

The browser leg installs a browser, so it is separate and has its own CI job:

```text
npm run test:browser
```

## What this does not do

It does not ship a running trading surface. The components here are subjects: small, ordinary,
and written to be measured.

It does not reconstruct an order book, and there is no matching engine, no exchange mechanics and
no latency figure anywhere.

It cannot see an ordering it does not schedule. That is stated in the table above rather than
left for a reader to discover, and it is the limit that decides what the numbers mean.

## Development

```text
npm run typecheck
```

<!-- toolset:start -->
<!-- toolset:end -->

## Licence

MIT.
