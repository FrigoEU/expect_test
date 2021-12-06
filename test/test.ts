import { registerExpectTest } from "../src/index";

const adder = (a: number, b: number) => a + b;

registerExpectTest(function (expect) {
  console.log(adder(5, 6).toString());
  expect("113");
});

const a = "kaa";

export function something() {
  // zkeljr zerlkj
}

registerExpectTest(function (e) {
  console.log(adder(5, 7).toString());
  console.log(adder(5, 7).toString());
  e("");
});
