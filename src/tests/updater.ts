/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import test from "ava";
import { FileUpdater, Updater } from "../index.js";
import fs from "node:fs/promises";
import path from "node:path";
const BASIC = `{"test":true}`;
const ARRAY = `{"test": [false, true]}`;

test("Create", t => {
  const updater = new Updater(BASIC);
  t.is(updater.toString(), BASIC);
});

test("Get data", t => {
  const updater = new Updater(BASIC);
  t.deepEqual(updater.data, { test: true });
});

test("Style", t => {
  const updater = new Updater(`{
    "test1": "hi!", // hi
    "test2": "goodbye" /*
    done
    */
  }`);
  const style = updater.style;
  t.truthy(style, "style exists");
  t.is(typeof style, "object", "style is an object");
  t.is(style.indent, "    ", "found correct indent");
  t.is(style.newline, "\n", "found correct newline");
  t.is(style.colon, " ", "found correct colon");
});

test("Add keys - Simple", t => {
  const updater = new Updater(BASIC);
  updater.add({ test2: "hi!" });
  const str = updater.toString();
  t.is(JSON.parse(str).test2, "hi!", "Added property");
  t.is(str.indexOf("\n"), -1, "Still one line");
  t.snapshot(str, "updated JSON");
});

test("Remove keys - Simple", t => {
  const updater = new Updater(BASIC);
  updater.remove(["test"]);
  const str = updater.toString();
  t.is(JSON.parse(str).test1, undefined, "Removed property");
  t.is(str, "{}", "Removed everything");
  t.snapshot(str, "updated JSON");
});

test("Complex merge", t => {
  const updater = new Updater(BASIC);
  updater.update({ test: false, test2: 6 });
  const str = updater.toString();
  t.is(JSON.parse(str).test, false, "Changed property");
  t.is(JSON.parse(str).test2, 6, "Added property");
  t.is(str.indexOf("\n"), -1, "Still one line");
  t.snapshot(str, "updated JSON");
});

test("Change type", t => {
  const updater = new Updater(BASIC);
  updater.update({ test: { test2: null } });
  const str = updater.toString();
  t.deepEqual(JSON.parse(str).test, { test2: null }, "Changed property");
  t.is(str.indexOf("\n"), -1, "Still one line");
  t.snapshot(str, "updated JSON");
});

test("Boolean and Array", t => {
  const updater = new Updater(BASIC);
  updater.update({ test: [false] });
  const str = updater.toString();
  t.deepEqual(JSON.parse(str).test, [false], "Changed property");
  t.is(str.indexOf("\n"), -1, "Still one line");
  t.snapshot(str, "updated JSON");
});

test("BigInt", t => {
  t.throws(
    () => {
      const updater = new Updater(BASIC);
      updater.update({ test: 100n });
    },
    {
      instanceOf: TypeError,
      message: `Cannot convert bigint to JSON`
    }
  );
});

test("Merge arrays - Replace", t => {
  const updater = new Updater(ARRAY);
  updater.update({ test: [true, false] });
  const str = updater.toString();
  t.deepEqual(JSON.parse(str).test, [true, false], "Changed property");
  t.is(str.indexOf("\n"), -1, "Still one line");
  t.snapshot(str, "updated JSON");
});

test("Merge arrays - Remove", t => {
  const updater = new Updater(ARRAY);
  updater.update({ test: [Updater.delete, true] });
  const str = updater.toString();
  t.deepEqual(JSON.parse(str).test, [false], "Changed property");
  t.is(str.indexOf("\n"), -1, "Still one line");
  t.snapshot(str, "updated JSON");
});

test("Merge arrays - Add", t => {
  const updater = new Updater(ARRAY);
  updater.add({ test: [false] });
  const str = updater.toString();
  t.deepEqual(JSON.parse(str).test, [false, true, false], "Changed property");
  t.is(str.indexOf("\n"), -1, "Still one line");
  t.snapshot(str, "updated JSON");
});

test("Delete missing", t => {
  t.throws(
    () => {
      const updater = new Updater(BASIC);
      updater.remove(["test2"]);
    },
    {
      instanceOf: Error,
      message: "Cannot delete missing property"
    }
  );
});

test("Data is updated", t => {
  const updater = new Updater(BASIC);
  updater.update({ test2: false });
  t.deepEqual(updater.data, { test: true, test2: false });
});

test("Complex Merge", t => {
  const updater = new Updater(`{
  "test": {
    "hello": true,
    "goodbye": false,
    "all": [1, 2, 3, 4]
  }
}
`);
  updater.update({
    test2: null,
    test: {
      goodbye: Updater.delete,
      hello: "YAY!",
      all: [1, 2, 3, 4]
    }
  });
  const str = updater.toString();
  const obj = JSON.parse(str) as { test: object };
  t.deepEqual(
    obj,
    {
      test: {
        hello: "YAY!",
        all: [1, 2, 3, 4]
      },
      test2: null
    },
    "Update successful"
  );
  t.false(Object.hasOwn(obj.test, "goodbye"), "Removed goodbye");
  t.snapshot(str, "updated JSON");
});

test("File Updater", async t => {
  const updater = await FileUpdater.load(path.resolve("tsconfig.json"));
  updater.update({
    extends: "No thanks",
    include: ["src/**/*.ts"],
    exclude: [Updater.add, "coverage"],
    compilerOptions: Updater.delete
  });
  updater.file = path.resolve("/dev/null");
  await updater.save();
  t.snapshot(await fs.readFile(updater.file, "utf8"));
});
