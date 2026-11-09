import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import { transform } from "esbuild";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.paultyng.agentsd.sdPlugin";

/** @type {import('rollup').RollupOptions} */
const config = {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    sourcemap: isWatching,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
      return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
    },
  },
  plugins: [
    {
      name: "watch-externals",
      buildStart() {
        this.addWatchFile(`${sdPlugin}/manifest.json`);
      },
    },
    {
      // TypeScript 7 は JS API を持たず @rollup/plugin-typescript が使えない。型検査は tsc --noEmit が担う。
      // esbuild は ES2022 を target にすると標準 decorator を lower する。
      name: "esbuild-typescript",
      async transform(code, id) {
        if (!id.endsWith(".ts")) return null;
        const result = await transform(code, {
          loader: "ts",
          target: "es2022",
          sourcefile: id,
          sourcemap: true,
        });
        return { code: result.code, map: result.map };
      },
    },
    nodeResolve({
      extensions: [".ts", ".mjs", ".js", ".json"],
      browser: false,
      exportConditions: ["node"],
      preferBuiltins: true,
    }),
    commonjs(),
    {
      name: "emit-module-package-file",
      generateBundle() {
        this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
      },
    },
  ],
};

export default config;
