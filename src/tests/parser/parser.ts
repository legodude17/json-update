import test from "ava";
import Parser from "../../parser.js";

const STRING = `{"test":true}`;

test("Create Parser", t => {
  new Parser(STRING);
  t.pass();
});
