import testFn from "ava";
import Parser, { Nodes, walk } from "../../parser.js";
import { VALID } from "./_cases.js";

for (const { test, name } of VALID) {
  testFn(name, t => {
    walk(new Parser(test).parse(), (node, parent, depth) => {
      t.assert(node && node.type, "node is a node");
      t.assert(!parent || parent.type, "parent is a node");
      if (parent) {
        switch (parent.type) {
          case "object": {
            t.is(node.type, "property", "node is a property");
            t.assert(
              parent.properties.includes(node as Nodes.Property),
              "node is in parent.properties"
            );

            break;
          }
          case "array": {
            t.is(node.type, "element", "node is an element");
            t.assert(
              parent.elements.includes(node as Nodes.Element),
              "node is in parent.elements"
            );

            break;
          }
          case "property": {
            t.assert(
              parent.key === node || parent.value === node,
              "node is key or value"
            );

            break;
          }
          case "element": {
            t.is(parent.value, node, "node is parent.value");

            break;
          }
          default: {
            t.fail("Parent is not a valid type");
          }
        }
      } else {
        t.is(depth, 0, "Depth must be 1 with no parent");
      }
      t.assert(typeof depth === "number" && depth >= 0, "depth is a number");
    });
  });
}

testFn("Invalid AST", t => {
  /* @ts-expect-error Need to provide invalid data to test */
  walk({ type: "blep" }, node => {
    /* @ts-expect-error Need to provide invalid data to test */
    t.is(node.type, "blep");
  });
});
