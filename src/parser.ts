/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-namespace */
export type NodeType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "property"
  | "element"
  | "null"
  | "whitespace"
  | "comment";
const DIGITS = /^\d$/;
const WS = /[\t\n\r ]/;

export namespace Nodes {
  export interface Node {
    type: NodeType;
    before: Padding[];
    after: Padding[];
  }

  export type Padding = Comment | Whitespace;

  export interface Comment extends Node {
    type: "comment";
    raw: string;
    commentType: "line" | "inline";
    text: string;
  }

  export interface Whitespace extends Node {
    type: "whitespace";
    value: string;
  }

  export interface Object extends Node {
    type: "object";
    properties: Property[];
  }

  export interface Array extends Node {
    type: "array";
    elements: Element[];
  }

  export interface Property extends Node {
    type: "property";
    key: String;
    value: AnyNode;
  }

  export interface Element extends Node {
    type: "element";
    value: AnyNode;
  }

  export interface String extends Node {
    type: "string";
    value: string;
  }

  export interface Number extends Node {
    type: "number";
    value: number;
    raw: string;
  }

  export interface Bool extends Node {
    type: "boolean";
    value: boolean;
  }

  export interface Null extends Node {
    type: "null";
    value: null;
  }

  export type AnyNode =
    | Array
    | Object
    | Property
    | Element
    | String
    | Number
    | Bool
    | Null
    | Whitespace
    | Comment;
}

function lineAt(data: string, pos: number): [string, number] {
  const lines = data.split("\n");
  let i = 0;
  while (i < lines.length && pos > lines[i]!.length) {
    pos -= lines[i]!.length + 2;
    i++;
  }
  return [lines[i]!, pos];
}

export default class Parser {
  #data: string;
  #pos = 0;
  #padding: Nodes.Padding[] = [];
  constructor(data: string) {
    this.#data = data;
  }

  parse(): Nodes.Object {
    this.#consumeWhitespace();
    return this.#parseObject();
  }

  get #cur(): string {
    const c = this.#data[this.#pos];
    if (!c) this.#raise("Unexpected end of input");
    return c;
  }

  #peek(skip = 1): string {
    return this.#data[this.#pos + skip] ?? "";
  }

  #parseAny(): Nodes.AnyNode {
    this.#consumeWhitespace();
    const char = this.#cur;
    switch (char) {
      case "{": {
        return this.#parseObject();
      }
      case "[": {
        return this.#parseArray();
      }
      case '"': {
        return this.#parseString();
      }
      case "+":
      case "-": {
        return this.#parseNumber();
      }
      case "n": {
        return this.#parseLiteral<Nodes.Null>("null", "null", null);
      }
      case "t": {
        return this.#parseLiteral<Nodes.Bool>("true", "boolean", true);
      }
      case "f": {
        return this.#parseLiteral<Nodes.Bool>("false", "boolean", false);
      }
      default: {
        if (DIGITS.test(char)) return this.#parseNumber();
        this.#raise("Unexpected " + char);
      }
    }
  }

  #parseObject(): Nodes.Object {
    const node = this.#startNode<Nodes.Object>("object");
    this.#eat("{");
    node.properties = [];
    while (this.#cur !== "}") {
      this.#consumeWhitespace();
      const prop = this.#startNode<Nodes.Property>("property");
      this.#consumeWhitespace();
      prop.key = this.#parseString();
      this.#eat(":");
      prop.value = this.#parseAny();
      if (this.#cur !== "}") this.#eat(",");
      node.properties.push(this.#finishNode(prop));
    }
    this.#eat("}");
    return this.#finishNode(node);
  }

  #parseArray(): Nodes.Array {
    const node = this.#startNode<Nodes.Array>("array");
    this.#eat("[");
    node.elements = [];
    while (this.#cur !== "]") {
      this.#consumeWhitespace();
      const elm = this.#startNode<Nodes.Element>("element");
      elm.value = this.#parseAny();
      if (this.#cur !== "]") this.#eat(",");
      node.elements.push(this.#finishNode(elm));
    }
    this.#eat("]");
    return this.#finishNode(node);
  }

  #parseString(): Nodes.String {
    const node = this.#startNode<Nodes.String>("string");
    this.#eat('"');
    node.value = "";
    let esacpe = false;
    while (this.#cur !== '"' || esacpe) {
      esacpe = this.#cur === "\\" && !esacpe ? true : false;
      node.value += this.#next();
    }
    this.#eat('"');
    return this.#finishNode(node);
  }

  #parseNumber(): Nodes.Number {
    const node = this.#startNode<Nodes.Number>("number");
    const start = this.#pos;
    this.#skip("+-");
    this.#readDigits();
    if (this.#skip(".")) {
      this.#readDigits();
    }
    if (this.#skip("eE")) {
      this.#skip("+-");
      this.#readDigits();
    }
    node.raw = this.#data.slice(start, this.#pos);
    node.value = Number.parseFloat(node.raw);
    return this.#finishNode(node);
  }

  #parseLiteral<T extends Nodes.Bool | Nodes.Null>(
    string: string,
    type: T["type"] & ("boolean" | "null"),
    value: boolean | null
  ): T {
    const node = this.#startNode<T>(type);
    node.value = value;
    for (const c of string) this.#eat(c);
    return this.#finishNode(node);
  }

  #readDigits(): string {
    let val = "";
    while (DIGITS.test(this.#cur)) {
      val += this.#next();
    }
    return val;
  }

  #eat(char: string, expect = true): boolean {
    if (this.#cur !== char) {
      if (expect) {
        this.#raise(
          `Unexpected ${this.#cur} at position ${this.#pos} (expected ${char})`
        );
      } else {
        return false;
      }
    }
    this.#pos++;
    return true;
  }

  #skip(str: string): boolean {
    if (str.includes(this.#cur)) {
      this.#pos++;
      return true;
    }
    return false;
  }

  #next(): string {
    return this.#data[this.#pos++]!;
  }

  #format(message: string) {
    const [line, pos] = lineAt(this.#data, this.#pos);
    return `${line}
  ${" ".repeat(pos)}^ ${message}`;
  }

  #raise(message: string): never {
    throw new SyntaxError("JSON parsing failed\n" + this.#format(message));
  }

  #consumeWhitespace() {
    while (
      this.#pos < this.#data.length &&
      (WS.test(this.#cur) || this.#cur === "/")
    ) {
      if (WS.test(this.#cur)) {
        let ws = "";
        const node = this.#startNode<Nodes.Whitespace>("whitespace");
        while (this.#pos < this.#data.length && WS.test(this.#cur)) {
          ws += this.#cur;
          this.#pos++;
        }
        if (ws) {
          node.value = ws;
          this.#padding.push(this.#finishNode(node));
        }
      } else if (this.#eat("/")) {
        const node = this.#startNode<Nodes.Comment>("comment");
        if (this.#eat("/", false)) {
          node.commentType = "line";
          let str = "";
          while (this.#pos < this.#data.length && this.#cur !== "\n") {
            str += this.#next();
          }
          node.raw = "//" + str;
          node.text = str.trim();
          this.#padding.push(this.#finishNode(node));
        } else if (this.#eat("*")) {
          node.commentType = "inline";
          let str = "";
          while (this.#cur + this.#peek() !== "*/") {
            str += this.#next();
          }
          this.#eat("*");
          this.#eat("/");
          node.raw = `/*${str}*/`;
          node.text = str.trim();
          this.#padding.push(this.#finishNode(node));
        }
      }
    }
  }

  #startNode<T extends Nodes.AnyNode>(type: T["type"]): T {
    const before = [];
    if (type !== "whitespace" && type !== "comment") {
      before.push(...this.#padding);
      this.#padding = [];
    }
    return {
      before,
      after: [],
      type
    } as Nodes.Node as T;
  }

  #finishNode<T extends Nodes.Node>(node: T): T {
    if (node.type !== "whitespace" && node.type !== "comment") {
      this.#consumeWhitespace();
      node.after = [...this.#padding];
      this.#padding = [];
    }
    return node;
  }
}

export function stringify(
  node: Nodes.AnyNode | Nodes.AnyNode[],
  parent?: Nodes.AnyNode
): string {
  if (Array.isArray(node)) return node.map(n => stringify(n, parent)).join("");
  return (
    stringify(node.before) +
    stringifyInner(node, parent) +
    stringify(node.after)
  );
}

function stringifyInner(node: Nodes.AnyNode, parent?: Nodes.AnyNode): string {
  switch (node.type) {
    case "array": {
      return `[${stringify(node.elements, node)}]`;
    }
    case "object": {
      return `{${stringify(node.properties, node)}}`;
    }
    case "property": {
      return `${stringify(node.key)}:${stringify(node.value)}${
        parent?.type === "object" &&
        parent.properties.indexOf(node) === parent.properties.length - 1
          ? ""
          : ","
      }`;
    }
    case "element": {
      return `${stringify(node.value)}${
        parent?.type === "array" &&
        parent.elements.indexOf(node) === parent.elements.length - 1
          ? ""
          : ","
      }`;
    }
    case "string": {
      return `"${node.value}"`;
    }
    case "number": {
      return node.raw;
    }
    case "boolean": {
      return node.value ? "true" : "false";
    }
    case "null": {
      return "null";
    }
    case "whitespace": {
      return node.value;
    }
    case "comment": {
      return node.raw;
    }
    default: {
      throw new TypeError("Invalid node type: " + (node as Nodes.Node).type);
    }
  }
}

export function walk(
  node: Nodes.AnyNode,
  cb: (
    node: Nodes.AnyNode,
    parent: Nodes.AnyNode | undefined,
    depth: number
  ) => void,
  depth = 0,
  parent?: Nodes.AnyNode
) {
  cb(node, parent, depth);
  switch (node.type) {
    case "array": {
      for (const elm of node.elements) {
        walk(elm, cb, depth + 1, node);
      }
      break;
    }
    case "object": {
      for (const prop of node.properties) {
        walk(prop, cb, depth + 1, node);
      }
      break;
    }
    case "property": {
      walk(node.key, cb, depth + 1, node);
      walk(node.value, cb, depth + 1, node);
      break;
    }
    case "element": {
      walk(node.value, cb, depth + 1, node);
      break;
    }
  }
}
