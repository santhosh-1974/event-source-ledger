import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
      setupFiles: ["tests/helpers/setup.ts"],
      env: {
      NODE_ENV: "test",
    },
    // Shared test DB cannot be truncated safely by parallel workers.
    fileParallelism: false,
    maxWorkers: 1,
    pool: "forks",
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
