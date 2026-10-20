/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  // "npm run build:portable" genera portable/index.html: la app completa en un archivo que abre con doble clic.
  const portable = mode === "portable";
  return {
    base: "./",
    plugins: portable ? [react(), viteSingleFile()] : [react()],
    build: portable ? { outDir: "portable", emptyOutDir: true, copyPublicDir: false } : undefined,
    test: {
      environment: "jsdom",
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.{ts,tsx}"],
    },
  };
});
