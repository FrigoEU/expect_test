function expect(str: string) {
  // We're looking for the place in the source where THIS function was called
  // So we look in the stacktrace for THIS function, and then go one "up" the stack
  const stack = new Error().stack;
  const stackLines = (stack || "").split("\n");
  const myOwnIndex = stackLines.findIndex((sl) =>
    sl.includes("at null.expect")
  );
  if (myOwnIndex === undefined) {
    throw new Error("ExpectTest: Failed to parse stacktrace");
  } else {
    const lineToParse = stackLines[myOwnIndex + 1];
    //eg: at null.<className> (/home/simon/projects/expect-test/test/test.ts:11:5)
    const regex = /\(([^:]*):(\d+):(\d+)\)/;
    const matched = lineToParse.match(regex);
    if (!matched) {
      throw new Error("ExpectTest: Failed to parse stacktrace (2)");
    } else {
      const callLocation = {
        file: matched[1],
        lineNumber: matched[2],
        columnNumber: matched[3],
      };
      // logging the expected string
      // The testrunner process can only interact with this piece of code through stdout, so first the actual result will be logged, then the expected result, and then a marker with the line information
      console.log("ExpectTestMarker1");
      console.log(str);
      console.log(
        `ExpectTestMarker2:${callLocation.file}:${callLocation.lineNumber}:${callLocation.columnNumber}`
      );
    }
  }
}

export function ExpectTest(constructor: any) {
  if (process.env.EXPECT_TEST === "true") {
    new constructor(expect);
  }
}
