import esbuild from "esbuild";
import child_process from "child_process";
import ts from "typescript";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import prettier from "prettier";

const fileName = process.argv[2];

console.log(`Running expect-test on file: ${fileName}`);

const fileNameParsed = path.parse(path.resolve(fileName));
const whiteSpacePreservedFile = path.join(
  fileNameParsed.dir,
  "expect_test_temp" + fileNameParsed.ext
);
const outFile = path.join(fileNameParsed.dir, "out.js");

async function cleanup() {
  return fs
    .unlink(whiteSpacePreservedFile)
    .then(() => fs.unlink(outFile))
    .then(() => fs.unlink(outFile + ".map"));
}

try {
  go();
} catch {
  cleanup();
}

async function go() {
  await fs.writeFile(
    whiteSpacePreservedFile,
    preserveWhitespace(await fs.readFile(fileName, "utf-8"))
  );

  const res = await esbuild.build({
    entryPoints: [whiteSpacePreservedFile],
    bundle: true,
    sourcemap: true,
    platform: "node" as const,
    outfile: outFile,
    mainFields: ["module", "main"],
  });
  if (res.errors.length !== 0) {
    console.error(`Failed to build`);
    res.errors.forEach((e) => console.error(e));
    process.exit(1);
  }

  const proc = child_process.spawn(
    `node`,
    // ["--inspect-brk", "--enable-source-maps", "./out.js"],
    ["--enable-source-maps", outFile],
    { env: { ...process.env, EXPECT_TEST: "true" } }
  );

  const stdout: string[] = [];
  const marker2Regex = /ExpectTestMarker2:([^:]*):(\d+):(\d+)/;
  proc.stdout.on("data", function (data: Buffer) {
    data
      .toString()
      .split("\n")
      .forEach((str) => stdout.push(str));
    // console.log("stdout: " + data.toString());
  });

  proc.stderr.on("data", function (data) {
    console.error("stderr: " + data.toString());
  });

  proc.on("exit", async function (code) {
    const parsedPath = path.parse(whiteSpacePreservedFile);
    const origSource = await fs.readFile(whiteSpacePreservedFile, "utf8");
    const oldSourceFile = ts.createSourceFile(
      parsedPath.name + parsedPath.ext,
      origSource,
      ts.ScriptTarget.Latest // langugeVersion
    );
    let currentSourcefile: null | ts.SourceFile = null;

    let previousMarkerTwoIndex = null;
    let markerOneIndex = null;
    if (code === 0) {
      for (let i = 0; i < stdout.length; i++) {
        debugger;
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
              .slice(previousMarkerTwoIndex || 0, markerOneIndex)
              .join("\n")
              .trim();
            const expected = stdout
              .slice(markerOneIndex + 1, i)
              .join("\n")
              .trim();
            if (
              actual !== expected &&
              path.resolve(whiteSpacePreservedFile) ===
                path.resolve(callLocation.file)
            ) {
              const positionOfExpectCall = ts.getPositionOfLineAndCharacter(
                oldSourceFile,
                callLocation.lineNumber - 1,
                callLocation.columnNumber
              );

              const res = ts.transform(
                oldSourceFile,
                [
                  (context) => {
                    const visit: ts.Visitor = (node) => {
                      debugger;
                      if (
                        node.pos <= positionOfExpectCall &&
                        positionOfExpectCall <= node.end &&
                        node.kind === ts.SyntaxKind.CallExpression
                      ) {
                        debugger;
                        return context.factory.createCallExpression(
                          context.factory.createIdentifier("expect"),
                          undefined,
                          [context.factory.createStringLiteral(actual)]
                        );
                      }
                      return ts.visitEachChild(
                        node,
                        (child) => visit(child),
                        context
                      );
                    };

                    return (node) => ts.visitNode(node, visit);
                  },
                ],
                {}
              );
              currentSourcefile = res.transformed[0];
            }
            previousMarkerTwoIndex = i;
          }
        }
      }

      if (currentSourcefile !== null) {
        const printer = ts.createPrinter({
          newLine: ts.NewLineKind.LineFeed,
        });

        const result = printer.printFile(currentSourcefile);
        const newFileName = path.resolve(fileName + ".new");
        await fs.writeFile(
          newFileName,
          prettier.format(restoreWhitespace(result), { parser: "typescript" })
        );

        console.log(`Wrote ${newFileName}`);
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

// https://github.com/microsoft/TypeScript/issues/843#issuecomment-625530359
function preserveWhitespace(content: string) {
  return content.replace(/\n\n/g, "\n/** THIS_IS_A_NEWLINE **/");
}
function restoreWhitespace(content: string) {
  return content.replace(/\/\*\* THIS_IS_A_NEWLINE \*\*\//g, "\n");
}
