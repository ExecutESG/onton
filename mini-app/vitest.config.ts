import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".next"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
