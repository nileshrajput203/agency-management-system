import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "artifacts/**/*.test.ts",
      "artifacts/**/*.test.tsx",
      "lib/**/*.test.ts"
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "artifacts/api-server/src/**/*.ts",
        "artifacts/agency-os/src/**/*.ts",
        "artifacts/agency-os/src/**/*.tsx",
        "lib/db/src/**/*.ts"
      ],
      exclude: [
        "**/*.d.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.ts",
        "**/*.test.tsx"
      ]
    }
  },
  esbuild: {
    jsx: "automatic"
  },
  resolve: {
    alias: {
      "drizzle-orm": path.resolve(__dirname, "./lib/db/node_modules/drizzle-orm"),
      "react": path.resolve(__dirname, "./artifacts/agency-os/node_modules/react"),
      "react-dom": path.resolve(__dirname, "./artifacts/agency-os/node_modules/react-dom"),
      "@workspace/db/schema": path.resolve(__dirname, "./lib/db/src/schema"),
      "@workspace/db": path.resolve(__dirname, "./lib/db/src"),
      "@workspace/api-zod": path.resolve(__dirname, "./lib/api-zod/src"),
      "@workspace/api-client-react": path.resolve(__dirname, "./lib/api-client-react/src"),
      "@": path.resolve(__dirname, "./artifacts/agency-os/src")
    }
  }
});

