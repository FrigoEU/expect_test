#!/usr/bin/env node

import child_process from "child_process";
import esbuild from "esbuild";
import fs from "fs/promises";
import path from "path";

const fileName = process.argv[2];

// console.log(`Running expect-test on file: ${fileName}`);

const fileNameParsed = path.parse(path.resolve(fileName));
const outFilePath = path.join(fileNameParsed.dir, "out.js");

async function cleanup() {
  return fs.unlink(outFilePath).then(() => fs.unlink(outFilePath + ".map"));
}

try {
  go();
} catch {
  cleanup();
}

async function go() {
  const res = await esbuild.build({
    entryPoints: [fileName],
    bundle: true,
    sourcemap: true,
    platform: "node" as const,
    outfile: outFilePath,
    mainFields: ["module", "main"],
  });
  if (res.errors.length !== 0) {
    console.error(`Failed to build`);
    res.errors.forEach((e) => console.error(e));
    process.exit(1);
  }

  const proc = child_process.spawn(
    `node`,
    // ["--inspect-brk", "--enable-source-maps", outFilePath],
    ["--enable-source-maps", outFilePath],
    { env: { ...process.env, EXPECT_TEST: "true" } }
  );

  const stdout: string[] = [];
  const marker2Regex = /ExpectTestMarker2:([^:]*):(\d+):(\d+)/;
  proc.stdout.on("data", function (data: Buffer) {
    debugger;
    data
      .toString()
      .trimEnd()
      .split("\n")
      .forEach((str) => stdout.push(str));
    // console.log("stdout: " + data.toString());
  });

  proc.stderr.on("data", function (data) {
    console.error("stderr: " + data.toString());
  });

  proc.on("exit", async function (code) {
    let previousMarkerTwoIndex = 0;
    let markerOneIndex = null;
    if (code === 0) {
      const changesToDo: {
        file: string;
        lineNumber: number;
        columnNumber: number;
        actual: string;
      }[] = [];
      for (let i = 0; i < stdout.length; i++) {
        const data = stdout[i];
        if (data === "ExpectTestMarker1") {
          markerOneIndex = i;
        } else {
          const matched = data.match(marker2Regex);
          if (matched) {
            if (markerOneIndex === null) {
              throw new Error("No markerOneIndex found");
            }
            const callLocation = {
              file: matched[1],
              lineNumber: parseInt(matched[2]),
              columnNumber: parseInt(matched[3]),
            };
            const actual = stdout
              .slice(previousMarkerTwoIndex, markerOneIndex)
              .join("\n")
              .trim();
            const expected = stdout
              .slice(markerOneIndex + 1, i)
              .join("\n")
              .trim();
            if (
              actual !== expected &&
              path.resolve(fileName) === path.resolve(callLocation.file)
            ) {
              const change = {
                ...callLocation,
                actual,
              };
              changesToDo.push(change);
            }
            previousMarkerTwoIndex = i + 1;
          }
        }
      }

      if (changesToDo.length !== 0) {
        const parsedPath = path.parse(fileName);
        const origSource = await fs.readFile(fileName, "utf8");

        const result: string = changesToDo.reduceRight(function (acc, change) {
          debugger;
          const allLines = acc.split("\n");
          const linesAtEnd = allLines.slice(change.lineNumber - 1);
          const last = [linesAtEnd[0].substr(change.columnNumber - 1)]
            .concat(linesAtEnd.slice(1))
            .join("\n");
          const replaced = last.replace(
            /\(["'`].*["'`]\)/,
            change.actual.includes("\n")
              ? "(`" + change.actual + "`)"
              : '("' + change.actual + '")'
          );
          return (
            allLines.slice(0, change.lineNumber - 1).join("\n") +
            "\n" +
            linesAtEnd[0].substr(0, change.columnNumber - 1) +
            replaced
          );
        }, origSource);

        const correctedFileName = path.resolve(fileName + ".corrected");
        await fs.writeFile(correctedFileName, result);

        console.log(`Found diff, wrote ${correctedFileName}`);
      }

      await cleanup();
      process.exit(0);
    } else {
      await cleanup();
      console.error("child process exited with code " + (code || 0).toString());
      process.exit(code || 0);
    }
  });
}
