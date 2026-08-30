import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not vitest tests — the two
    // test frameworks' `test`/`expect` globals collide if vitest tries to collect that folder too.
    exclude: ['**/node_modules/**', 'e2e/**']
  }
});
