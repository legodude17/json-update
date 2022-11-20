import testFn from "ava";
import Parser from "../../parser.js";
import { VALID } from "./_cases.js";

for (const { test, name } of VALID) {
  testFn(name, t => {
    t.snapshot(new Parser(test).parse(), "ast:" + name);
  });
}
