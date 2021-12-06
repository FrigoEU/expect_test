import { ExpectTest } from "../src/expecttest";

const adder = (a: number, b: number) => a + b;

@ExpectTest
class Bleb {
  constructor(expect: any) {
    console.log(adder(5, 6).toString());
    expect("1123");
  }
}

@ExpectTest
class Bleb2 {
  constructor(expect: any) {
    console.log(adder(5, 7).toString());
    expect("1243");
  }
}
