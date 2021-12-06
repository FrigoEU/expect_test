const esbuild = require("esbuild");
const fs = require("fs/promises");

const buildOptions = {
  entryPoints: ["src/cli.ts"],
  bundle: true,
  sourcemap: true,
  platform: "node",
  outdir: "out",
  mainFields: ["module", "main"],
  external: ["esbuild"]
};

esbuild.build(buildOptions)
  .then(() => fs.copyFile("src/index.ts", "out/index.ts"))
  .catch(() => process.exit(1));
