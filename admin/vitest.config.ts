import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    // lib/ is shared with the site and tested here, as this is the only runner
    include: ["src/**/*.{test,spec}.{ts,tsx}", "../lib/**/*.test.ts"],
    exclude: ["e2e/**", "**/node_modules/**"],
  },
  server: {
    fs: {
      // lib/ lives above the admin app, which is the vite root
      allow: [resolve(__dirname, "..")],
    },
  },
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../lib"),
    },
  },
});
