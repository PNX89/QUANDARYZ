/**
 * Capture what the portfolio card shows: the demo's own output, and the facts beside it.
 *
 *     node scripts/capture-evidence.mjs
 *
 * The demo runs through Vitest because it needs a DOM and React's `act`, and Vitest's reporter
 * interleaves its own markers with the program's output. This strips those markers and keeps the
 * lines the demo actually printed, so the committed transcript is the demo's words rather than
 * the runner's.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const MARKER = /^stdout \| /

function demoOutput() {
  const raw = execFileSync('npx', ['vitest', 'run', '--project', 'demo', '--reporter=verbose'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const lines = []
  let inside = false
  for (const line of raw.split('\n')) {
    if (MARKER.test(line)) {
      inside = true
      continue
    }
    // The reporter's own summary starts once the test is ticked off.
    if (/^\s*[\u2713\u00d7]/.test(line) || /^\s*Test Files/.test(line)) inside = false
    if (inside) lines.push(line.replace(/\s+$/, ''))
  }
  // Collapse the blank runs the reporter's grouping leaves behind, so the transcript reads the
  // way the demo would if it had a terminal to itself.
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function testTotal() {
  const raw = execFileSync('npx', ['vitest', 'run', '--project', 'dom', '--reporter=json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
  })
  const start = raw.indexOf('{')
  const report = JSON.parse(raw.slice(start))
  return report.numTotalTests
}

const output = demoOutput()
if (output.length < 200) {
  console.error('the demo printed almost nothing, so there is no card to build')
  process.exit(1)
}

mkdirSync('docs/evidence', { recursive: true })
writeFileSync('docs/evidence/demo.txt', `${output}\n`)

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const tags = execFileSync('git', ['tag', '--sort=-v:refname'], { encoding: 'utf8' })
  .split(/\s+/)
  .filter(Boolean)
const release = tags.length === 0 ? `v${pkg.version} (untagged)` : tags[0]
if (tags.length > 0 && tags[0] !== `v${pkg.version}`) {
  console.error(`package.json says ${pkg.version} and the newest tag is ${tags[0]}`)
  process.exit(1)
}

const facts = {
  tests: testTotal(),
  node: '24',
  release,
  captured: new Date().toISOString().slice(0, 10),
  runUrl: process.env.GITHUB_RUN_ID
    ? `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'PNX89/QUANDARYZ'}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
}
writeFileSync('docs/evidence/facts.json', `${JSON.stringify(facts, null, 2)}\n`)
console.log(`wrote docs/evidence/demo.txt (${output.split('\n').length} lines)`)
console.log(`wrote docs/evidence/facts.json ${JSON.stringify(facts)}`)
