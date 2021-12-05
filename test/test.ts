import { ExpectTest } from "../src/expecttest";

const adder = (a: number, b: number) => a + b;

@ExpectTest
class Bleb {
  constructor(expect: any) {
    console.log(adder(5, 6).toString());
    expect("113");
  }
}
