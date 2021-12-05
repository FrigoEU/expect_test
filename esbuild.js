const esbuild = require("esbuild");

const buildOptions = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  sourcemap: true,
  platform: "node",
  outdir: "out",
  mainFields: ["module", "main"]
};

esbuild.build(buildOptions).catch(() => process.exit(1));