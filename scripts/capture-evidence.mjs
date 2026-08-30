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

/**
 * THE DEMO WRITES ITS OWN TRANSCRIPT and this only runs it and reads the file back.
 *
 * The first version parsed the test runner's output to recover what the demo had printed. That
 * worked on a terminal and produced nothing on CI, where the reporter formats differently
 * without a TTY, so the capture failed on a demo that had run perfectly. Parsing another
 * program's presentation layer is reading something nobody promised to keep stable.
 */
function demoOutput() {
  execFileSync('npx', ['vitest', 'run', '--project', 'demo'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return readFileSync('docs/evidence/demo.txt', 'utf8').trim()
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

/**
 * The Node version, read from the workflow rather than typed here a second time.
 *
 * `node: '24'` used to be a literal beside fields that are all measured, so it read as captured
 * when it was not: nothing tied it to what CI actually runs, and bumping ci.yml's node-version
 * would leave this file, and the card built from it, still saying the old one. Both jobs in
 * ci.yml pin a version, so the two are read and checked against each other rather than trusting
 * either alone.
 */
function nodeVersionFromWorkflow() {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
  const pins = [...workflow.matchAll(/node-version:\s*'([^']+)'/g)].map((match) => match[1])
  if (pins.length === 0) {
    throw new Error('ci.yml names no node-version, so there is no fact to capture')
  }
  const distinct = new Set(pins)
  if (distinct.size > 1) {
    throw new Error(`ci.yml's jobs disagree about node-version: ${[...distinct].join(', ')}`)
  }
  return pins[0]
}

const output = demoOutput()
if (output.length < 200) {
  console.error('the demo printed almost nothing, so there is no card to build')
  process.exit(1)
}

mkdirSync('docs/evidence', { recursive: true })

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
  node: nodeVersionFromWorkflow(),
  release,
  captured: new Date().toISOString().slice(0, 10),
  runUrl: process.env.GITHUB_RUN_ID
    ? `https://github.com/${process.env.GITHUB_REPOSITORY ?? 'PNX89/QUANDARYZ'}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null,
}
writeFileSync('docs/evidence/facts.json', `${JSON.stringify(facts, null, 2)}\n`)
console.log(`wrote docs/evidence/demo.txt (${output.split('\n').length} lines)`)
console.log(`wrote docs/evidence/facts.json ${JSON.stringify(facts)}`)
