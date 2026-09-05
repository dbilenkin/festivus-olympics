/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://dbilenkin.github.io/festivus-olympics/ — every asset URL
// must carry that prefix, so `base` is not optional here.
export default defineConfig({
  base: "/festivus-olympics/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  test: {
    // happy-dom implements requestAnimationFrame, which the run clock depends on
    environment: "happy-dom",
    environmentMatchGlobs: [["**/*.node.test.ts", "node"]],
  },
});
