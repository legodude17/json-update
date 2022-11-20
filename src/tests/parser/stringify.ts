import testFn from "ava";
import Parser, { stringify } from "../../parser.js";
import { VALID } from "./_cases.js";
for (const { test, name } of VALID) {
  testFn(name, t => {
    t.assert(test === stringify(new Parser(test).parse()));
  });
}

testFn("Invalid AST", t => {
  t.throws(
    () => {
      /* @ts-expect-error Need to provide invalid data to test */
      stringify({ type: "blep", before: [], after: [] });
    },
    {
      instanceOf: TypeError,
      message: "Invalid node type: blep"
    }
  );
});
