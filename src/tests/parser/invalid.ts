import Parser from "../../parser.js";
import testFn from "ava";
import { INVALID } from "./_cases.js";

for (const { test, name } of INVALID) {
  testFn(name, t => {
    t.throws(
      () => {
        new Parser(test).parse();
      },
      { instanceOf: SyntaxError },
      "should throw SyntaxError on invalid input"
    );
  });
}
