export const VALID = [
  { test: `{"test": true}`, name: "Basic" },
  { test: `{    "test": true}`, name: "Before Whitespace" },
  { test: `{"test": true     }`, name: "After Whitespace" },
  {
    test: `{
      "test": true
    }`,
    name: "Lines"
  },
  { test: `{"test": 7.9e2}`, name: "Number" },
  { test: `{"test": +1}`, name: "Positive Number" },
  { test: `{"test": -6.9e-2}`, name: "Negative Number" },
  { test: `{"testtttt": null}`, name: "Null" },
  { test: `{"test1":{"test2":false}}`, name: "Nested" },
  { test: `{"test4":[1, null, "hi!", 8942]}`, name: "Array" },
  { test: `{"test":"te\\"st"}`, name: "Escapes" },
  {
    test: `{"test": // comment!
4}`,
    name: "Line Comment"
  },
  { test: `{"test": /* comment 2! */ 6}`, name: "Inline Comment" },
  { test: `{"test":true}/* comment 3! */`, name: "Ending Comment" },
  {
    test: `{"test1":true,"test2":false,"test3":null}`,
    name: "Multiple Properties"
  }
];

export const INVALID = [
  { test: `{"test: true}`, name: "Missing End Quote" },
  { test: `{    test": true}`, name: "Missing Begin Quote" },
  { test: `{"test": ture     }`, name: "Misspelled true" },
  {
    test: `{
      "test": 0..1
    }`,
    name: "Invalid Number"
  },
  { test: `{"test":|}`, name: "Invalid Character" }
];
