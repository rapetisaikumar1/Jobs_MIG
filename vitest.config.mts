import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// TEST_DATABASE_URL may live in .env.test.local (git-ignored) so integration tests run with plain `npm test`.
const testEnv = loadEnv("test", process.cwd(), ["TEST_DATABASE_URL", "DATABASE_URL"]);

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: { "server-only": fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    env: testEnv,
    setupFiles: ["./tests/support/integration-env.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
