import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.spec.ts', 'tests/int/**/*.int.spec.ts'],
    // Integration specs reset the shared plc_test database.
    fileParallelism: false,
    // payload-oauth2 publishes ESM with extensionless imports that Node cannot resolve.
    server: { deps: { inline: ['payload-oauth2'] } },
  },
})
