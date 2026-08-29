import { playwright } from '@vitest/browser-playwright'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// ONE SUITE, TWO ENVIRONMENTS, AND NO SECOND TEST RUNNER. `npm test` runs the subjects in
// happy-dom, installs no browser and reaches nothing outside npm. The browser project runs the
// same files in real Chromium and is a separate CI job, because a repository that can only
// demonstrate its claim in a simulated DOM has demonstrated it about the simulation.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // NO FAKE TIMERS ANYWHERE. A fake clock would supply the single input this repository exists
    // to vary: the order things arrive in. Controlling it in the harness would make every
    // measurement a statement about the harness.
    fakeTimers: { toFake: [] },
    projects: [
      {
        extends: true,
        test: { name: 'dom', environment: 'happy-dom', include: ['test/**/*.test.ts?(x)'] },
      },
      {
        extends: true,
        // The demo, run through the same runner as everything else so that what a reader sees
        // is what CI runs rather than a second code path that happens to print something.
        test: { name: 'demo', environment: 'happy-dom', include: ['examples/**/*.test.tsx'] },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          // THE SAME SUBJECTS, IN A REAL BROWSER. A repository whose claim is about what a
          // browser does has demonstrated it about a simulation until it runs in one. happy-dom
          // is a faithful enough DOM for these fingerprints and it is still somebody's
          // implementation of a specification, which is exactly the kind of thing this
          // repository is otherwise careful not to trust.
          //
          // CHROMIUM ONLY, and the headless shell rather than the full browser: 82 MB against
          // the several hundred the default set pulls. One engine is enough to answer whether
          // the result survives leaving the simulation; three would be answering a different
          // question about engine differences that nothing here investigates.
          include: ['test/browser/**/*.test.tsx'],
          browser: {
            enabled: true,
            // A FACTORY, NOT A STRING. Vitest 4 changed this and the string form fails at
            // startup with a message naming the package to import, which is the good kind of
            // breaking change: it tells you what to do rather than misbehaving quietly.
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
