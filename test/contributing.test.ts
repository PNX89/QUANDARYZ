/**
 * The contributor guide, held to what this repository actually is.
 *
 * IT WAS A TEMPLATE FOR A PYTHON REPOSITORY AND NOBODY ADAPTED IT. There is no Python here, and
 * it opened by telling a reader to run a Python package manager, then to regenerate the evidence
 * with a Python script whose name and extension are both wrong. Neither command can succeed on
 * any machine. The quickstart also installed nothing, so the demo it promised "under a minute
 * from clone to output" failed on a clean clone with `vitest: command not found`.
 *
 * It is the second file a curious reviewer opens, and every claim in it was checkable by
 * running it. So it is checked here the way the front page is: commands against what CI runs,
 * paths against what exists, and the promise of an offline start against the order of the steps.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const GUIDE = readFileSync('CONTRIBUTING.md', 'utf8')
const WORKFLOW = readFileSync('.github/workflows/ci.yml', 'utf8')
const SCRIPTS: Record<string, string> = JSON.parse(readFileSync('package.json', 'utf8')).scripts

/** The tools a contributor is handed by cloning this repository and running the install step. */
const RUNNABLE = new Set(['git', 'cd', 'npm', 'npx', 'node'])

/** Every fenced block of shell, as its lines. */
function blocks(): string[][] {
  return [...GUIDE.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) =>
    match[1]!.split('\n').filter((line) => line.trim() !== ''),
  )
}

/** Every command in the guide, with a `&&` chain read as the several commands it is. */
function commands(): string[] {
  return blocks()
    .flat()
    .flatMap((line) => line.split('&&'))
    .map((command) => command.trim())
}

describe('the contributor guide', () => {
  it('offers only commands this repository can run', () => {
    expect(commands().length).toBeGreaterThan(0)
    for (const command of commands()) {
      const tool = command.split(' ')[0]!
      expect(RUNNABLE, `the guide asks a contributor to run \`${command}\``).toContain(tool)

      const script = command.match(/^npm run (\S+)/)
      if (script) expect(SCRIPTS, `there is no \`${script[1]}\` script`).toHaveProperty(script[1]!)

      const file = command.match(/^node (\S+)/)
      if (file) expect(existsSync(file[1]!), `\`${file[1]}\` does not exist`).toBe(true)

      // The guide says its command list is read out of CI, so it has to be true of every one.
      if (tool === 'npm' || tool === 'node') {
        expect(WORKFLOW, `the guide offers \`${command}\` and CI never runs it`).toContain(command)
      }
    }
  })

  it('installs before it runs anything, in the block a reader follows first', () => {
    // "Under a minute from clone to output, offline" was the sentence directly under a block
    // that cloned, ran a Python package manager and then called `npm run demo` with no
    // node_modules. On a clean clone the second command failed and the third could not have
    // worked either.
    const first = blocks()[0]!
    const install = first.findIndex((line) => /(^|&& )npm ci\b/.test(line))
    const run = first.findIndex((line) => /(^|&& )npm run\b/.test(line))
    expect(install, 'the quickstart never installs the dependencies it then uses').toBeGreaterThan(-1)
    expect(run, 'the quickstart never produces any output').toBeGreaterThan(-1)
    expect(install).toBeLessThan(run)
  })

  it('points a contributor only at paths that exist', () => {
    const named = [...GUIDE.matchAll(/`([A-Za-z0-9_./-]+\.(?:ts|tsx|mjs|json|md|yml|yaml|txt|svg))`/g)]
    const missing = [...new Set(named.map((match) => match[1]!))].filter((path) => !existsSync(path))
    expect(missing).toEqual([])
  })

  it('leaves no directive behind for a checker this repository does not run', () => {
    // The guide claimed formatting was a gate. There is no formatter and no linter in
    // package.json, and two source files still carried suppression comments for one, which is
    // furniture from the same template: a reader who tries to satisfy it finds nothing to run.
    //
    // The name is matched as a pattern rather than written out, because a check for a string
    // must not be the file that introduces it.
    const forbidden = /\/\/\s*es[l]int-|\/\*\s*es[l]int/
    const declared = readFileSync('package.json', 'utf8')
    for (const marker of ['es' + 'lint', 'prettier', 'biome']) {
      if (declared.includes(marker)) return
    }
    for (const path of sources()) {
      expect(readFileSync(path, 'utf8'), `${path} suppresses a checker nothing here runs`).not.toMatch(
        forbidden,
      )
    }
  })
})

/** Every file a contributor would edit, so a directive cannot hide in the one nobody opens. */
function sources(): string[] {
  const found: string[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(ts|tsx|mjs)$/.test(entry.name)) found.push(path)
    }
  }
  for (const directory of ['src', 'test', 'examples', 'scripts']) walk(directory)
  return found
}
