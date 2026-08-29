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
        test: { name: 'dom', environment: 'happy-dom', include: ['test/**/*.test.tsx'] },
      },
    ],
  },
})
