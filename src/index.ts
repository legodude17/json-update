import Parser, { Nodes, stringify } from "./parser.js";
import fs from "node:fs/promises";

interface StyleInfo {
  indent: string;
  newline: string;
  colon: string;
}

export class Updater {
  #data: string;
  #parser: Parser;
  #ast: Nodes.Object;
  static delete = Symbol.for("delete");
  static add = Symbol.for("add");
  #style: StyleInfo = { indent: "", newline: "", colon: "" };
  constructor(data: string) {
    this.#data = data;
    this.#parser = new Parser(this.#data);
    this.#ast = this.#parser.parse();
    this.#calcStyle();
  }

  get style() {
    return Object.assign({}, this.#style);
  }

  get data(): object {
    return JSON.parse(this.toString()) as object;
  }

  toString() {
    return (this.#data = stringify(this.#ast));
  }

  add(obj: object) {
    function walk(object: object) {
      for (const value of Object.values(object)) {
        if (Array.isArray(value)) value.unshift(Updater.add);
        if (value && typeof value === "object") walk(value as object);
      }
    }
    walk(obj);
    this.update(obj);
  }

  remove(keys: string[]) {
    const obj: { [k: string]: symbol } = {};
    for (const key of keys) obj[key] = Updater.delete;
    this.update(obj);
  }

  update(obj: object) {
    this.#updateInternal(obj, this.#ast, 1);
  }

  #updateInternal(obj: object, ast: Nodes.Object, depth: number) {
    for (const [key, value] of Object.entries(obj)) {
      const index = ast.properties.findIndex(n => n.key.value === key);
      const del = value === Updater.delete;
      if (index === -1)
        if (del) throw new Error("Cannot delete missing property");
        else {
          const node = ast.properties[ast.properties.length - 1];
          let after = "";
          if (node?.value) {
            after = stringify(node.value.after);
            node.value.after = [];
          }
          ast.properties.push(
            this.#makeNode<Nodes.Property>(
              "property",
              {
                key: this.#makeNode<Nodes.String>("string", { value: key }),
                value: this.#nodeFor(value)
              },
              this.#style.newline + this.#style.indent.repeat(depth),
              after
            )
          );
        }
      else if (del) ast.properties.splice(index, 1);
      else {
        const node = ast.properties[index];
        if (this.#isNodeFor(value, node?.value)) continue;
        if (node?.value.type === "array" && Array.isArray(value)) {
          if (value[0] === Updater.add) {
            for (const val of value.slice(1)) {
              node.value.elements.push(
                this.#makeNode<Nodes.Element>("element", {
                  value: this.#nodeFor(val)
                })
              );
            }
          } else if (value[0] === Updater.delete) {
            for (const val of value.slice(1)) {
              const idx = node.value.elements.findIndex(elm =>
                this.#isNodeFor(val, elm.value)
              );
              if (idx > 0) node.value.elements.splice(idx, 1);
            }
          } else {
            for (const [i, element] of value.entries()) {
              if (this.#isNodeFor(element, node.value.elements[i]?.value))
                continue;
              node.value.elements[i] = this.#makeNode<Nodes.Element>(
                "element",
                {
                  value: this.#nodeFor(element)
                }
              );
            }
          }
        } else if (node?.value.type === "object" && typeof value === "object") {
          this.#updateInternal(value as object, node?.value, depth + 1);
        } else if (
          (node?.value.type === "boolean" ||
            node?.value.type === "string" ||
            node?.value.type === "number") &&
          node?.value.type === typeof value
        ) {
          node.value.value = value as boolean | number | string;
        } else if (node) {
          node.value = this.#nodeFor(value);
        }
      }
    }
  }

  #nodeFor(value: unknown): Nodes.AnyNode {
    if (value == undefined) {
      return this.#makeNode("null", { value: null }, this.#style.colon);
    }
    if (Array.isArray(value)) {
      return this.#makeNode("array", {
        elements: value.map(val =>
          this.#makeNode<Nodes.Element>("element", {
            value: this.#nodeFor(val)
          })
        )
      });
    }
    switch (typeof value) {
      case "string": {
        return this.#makeNode("string", { value }, this.#style.colon);
      }
      case "number": {
        return this.#makeNode(
          "number",
          { value, raw: value.toLocaleString() },
          this.#style.colon
        );
      }
      case "boolean": {
        return this.#makeNode("boolean", { value }, this.#style.colon);
      }
      case "object": {
        return this.#makeNode("object", {
          properties: Object.entries(value).map(([key, value]) =>
            this.#makeNode<Nodes.Property>("property", {
              key: this.#makeNode<Nodes.String>("string", { value: key }),
              value: this.#nodeFor(value)
            })
          )
        });
      }
      default: {
        throw new TypeError(`Cannot convert ${typeof value} to JSON`);
      }
    }
  }

  #isNodeFor(value: unknown, node: Nodes.AnyNode | undefined) {
    if (!node) return false;
    if (node.type === "null" && value == undefined) return true;
    if (node.type === "boolean" && typeof value === "boolean") {
      return node.value === value;
    }
    if (node.type === "number" && typeof value === "number") {
      return node.value === value;
    }
    if (node.type === "string" && typeof value === "string") {
      return node.value === value;
    }
    if (node.type === "array" && Array.isArray(value)) {
      if (node.elements.length !== value.length) return false;
      for (const [i, element] of value.entries()) {
        if (!this.#isNodeFor(element, node.elements[i]?.value)) return false;
      }
      return true;
    }
    if (node.type === "object" && typeof value === "object" && value) {
      for (const [key, val] of Object.entries(value)) {
        const prop = node.properties.find(p => p.key.value === key);
        if (!prop) return false;
        if (!this.#isNodeFor(val, prop.value)) return false;
      }
      const keys = new Set(Object.keys(value));
      for (const key of node.properties.map(p => p.key.value)) {
        if (!keys.has(key)) return false;
      }
      return true;
    }
    return false;
  }

  #makeNode<T extends Nodes.AnyNode>(
    type: T["type"],
    obj: Partial<T>,
    before = "",
    after = ""
  ): T {
    return Object.assign({}, obj, {
      type,
      before: [
        {
          type: "whitespace",
          value: before,
          before: [],
          after: []
        } as Nodes.Whitespace
      ],
      after: [
        {
          type: "whitespace",
          value: after,
          before: [],
          after: []
        } as Nodes.Whitespace
      ]
    }) as T;
  }

  #calcStyle() {
    const style = this.#ast.properties
      .map(n => {
        const index = n.before.findIndex(p => p.type === "comment");
        const str = stringify(n.before.slice(index + 1));
        if (!str) return false;
        const newline = str.replace(/ /g, "");
        const indent = str.replace(newline, "");
        const index2 = n.value.before.findIndex(p => p.type === "comment");
        const colon = stringify(n.value.before.slice(index2 + 1));
        return newline && indent ? { newline, indent, colon } : false;
      })
      .find(Boolean);
    if (style) this.#style = style;
  }
}

export class FileUpdater extends Updater {
  file: string;
  constructor(data: string, path: string) {
    super(data);
    this.file = path;
  }
  static async load<T extends FileUpdater>(
    this: { new (data: string, path: string): T },
    path: string
  ): Promise<T> {
    return new this(await fs.readFile(path, "utf8"), path);
  }

  save() {
    return fs.writeFile(this.file, this.toString(), "utf8");
  }
}

export default FileUpdater.load.bind(FileUpdater);

export const add = Updater.add;
export const del = Updater.delete;
