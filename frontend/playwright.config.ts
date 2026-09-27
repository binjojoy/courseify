import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  // These are real-browser tests that fetch the YouTube IFrame API and the
  // Google Fonts stylesheet, so a run on a loaded machine can spend most of the
  // default 30s budget waiting on the network rather than on the app.
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  webServer: {
    // Build first, then serve. `vite preview` reads `dist/`, so without the
    // build step a run silently tests whatever was last built — which is how a
    // green suite can be reporting on code that no longer exists. `tsc` is part
    // of `build`, so a type error fails the run here too.
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } }
  ]
});