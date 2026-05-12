import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      exclude: ["**/*.test.ts"],
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: "./src/wgsl-builder.ts",
      fileName: "wgsl-builder",
      formats: ["es"],
    },
  },
});
