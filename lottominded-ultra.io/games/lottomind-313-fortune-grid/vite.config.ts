import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(packageRoot, "app"),
  base: "./",
  publicDir: resolve(packageRoot, "app/public"),
  build: {
    outDir: resolve(packageRoot, "dist"),
    emptyOutDir: true,
    assetsDir: "assets/build",
    rollupOptions: { output: { manualChunks: { three: ["three"] } } }
  }
});
