import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"], // dist/index.mjs + dist/index.cjs
  dts: true, // dist/index.d.ts
  sourcemap: true,
  clean: true,
  outDir: "dist",
  treeshake: true,
  minify: false,
  external: ["react", "react-dom"], // keep peer deps external
});
