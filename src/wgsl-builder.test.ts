import { describe, expect, it } from "vitest";
import * as wb from "./wgsl-builder";

// #region Helpers

const compileTo = (roots: Parameters<typeof wb.compile>[0], expected: string) =>
  expect(wb.compile(roots)).toBe(expected);

const compileContains = (
  roots: Parameters<typeof wb.compile>[0],
  substring: string,
) => expect(wb.compile(roots)).toContain(substring);

const compileNoThrow = (roots: Parameters<typeof wb.compile>[0]) =>
  expect(() => wb.compile(roots)).not.toThrow();

const compileThrows = (
  roots: Parameters<typeof wb.compile>[0],
  errorClass: new (...args: never[]) => Error,
) => expect(() => wb.compile(roots)).toThrow(errorClass);

const deepBinary = (depth: number): wb.ExpressionNode => {
  let expression: wb.ExpressionNode = wb.literal("1");
  for (let i = 0; i < depth; i++) {
    expression = wb.binary("+", expression, wb.literal("1"));
  }
  return expression;
};

// #endregion

describe("WGSL Builder", () => {
  // #region Basic Functionality

  it("compiles an empty function", () => {
    compileTo([wb.fn([], [], { name: "empty" })], "fn empty() {\n\n}");
  });

  it("returns empty string for type / builtin nodes in compileNode", () => {
    compileTo([wb.f32, wb.builtin("abs")], "");
  });

  // #endregion

  // #region Naming

  it("auto-generates names with kind prefix", () => {
    const f = wb.fn([], [], {});
    const v = wb.var_(wb.vec4f, undefined, { global: true });
    const out = wb.compile([f, v]);
    expect(out).toMatch(/fn f_\d+\(\)/);
    expect(out).toMatch(/var v_\d+: vec4f;/);
  });

  it("user-supplied names take priority, suffix appended on collision", () => {
    const f1 = wb.fn([], [], { name: "main" });
    const f2 = wb.fn([], [], { name: "main" });
    const out = wb.compile([f1, f2]);
    expect(out).toMatch("fn main()");
    expect(out).toMatch("fn main_0()");
  });

  it("built-in functions retain their exact name", () => {
    const c = wb.call(
      wb.dot,
      wb.identifier({ name: "a" }),
      wb.identifier({ name: "b" }),
    );
    compileContains(
      [wb.fn([], [wb.return_(c)], { name: "f", returnType: wb.f32 })],
      "dot(a, b)",
    );
  });

  // #endregion

  // #region Structs

  it("compiles struct from a list", () => {
    compileContains(
      [
        wb.struct_(
          [
            wb.member(wb.vec3f, { name: "pos" }),
            wb.member(wb.vec3f, { name: "norm" }),
          ],
          { name: "Vertex" },
        ),
      ],
      "struct Vertex {\n  pos: vec3f,\n  norm: vec3f,\n}",
    );
  });

  it("compiles struct from an object", () => {
    compileContains(
      [
        wb.structFromObject(
          { position: wb.vec3f, normal: wb.vec3f },
          { name: "Vertex" },
        ),
      ],
      "struct Vertex {\n  position: vec3f,\n  normal: vec3f,\n}",
    );
  });

  it("struct members support attributes", () => {
    const s = wb.struct_(
      [
        wb.member(wb.vec4f, {
          name: "pos",
          attributes: [wb.builtinAttr("position")],
        }),
      ],
      { name: "Output" },
    );
    compileContains([s], "  @builtin(position) pos: vec4f,");
  });

  it("struct type referenced from another struct", () => {
    const A = wb.structFromObject({ x: wb.f32 }, { name: "A" });
    const B = wb.struct_([wb.member(wb.structType(A), { name: "a" })], {
      name: "B",
    });
    compileContains([B], "a: A,");
    const out = wb.compile([B]);
    expect(out.indexOf("struct A") < out.indexOf("struct B")).toBe(true);
  });

  // #endregion

  // #region Functions

  it("compiles simple function with return", () => {
    compileContains(
      [
        wb.fn([], [wb.return_(wb.literal("0.0"))], {
          name: "main",
          returnType: wb.f32,
        }),
      ],
      "fn main() -> f32 {\n  return 0.0;\n}",
    );
  });

  it("function with parameters and return type attribute", () => {
    const v = wb.fn(
      [wb.parameter(wb.f32, { name: "x", attributes: [wb.location(0)] })],
      [wb.return_(wb.call(wb.vec4f, wb.literal("0.0")))],
      {
        name: "frag",
        attributes: [wb.stage("fragment")],
        returnType: wb.returnType(wb.vec4f, [wb.location(0)]),
      },
    );
    const out = wb.compile([v]);
    expect(out).toContain("@fragment fn frag(");
    expect(out).toContain("@location(0) x: f32) -> @location(0) vec4f {");
  });

  it("function with no return type", () => {
    compileContains(
      [wb.fn([], [wb.return_()], { name: "noRet" })],
      "fn noRet() {\n  return;\n}",
    );
  });

  // #endregion

  // #region Function Builder

  it("doFn yields parameters and statements in order", () => {
    const f = wb.doFn(
      function* () {
        const a = yield* wb.do_(wb.parameter(wb.f32, { name: "a" }));
        const b = yield* wb.do_(wb.parameter(wb.f32, { name: "b" }));
        const sum = yield* wb.do_(
          wb.let_(wb.f32, wb.binary("+", a, b), { name: "sum" }),
        );
        yield* wb.do_(wb.return_(sum));
      },
      { name: "add", returnType: wb.f32 },
    );

    const out = wb.compile([f]);
    expect(out).toContain("fn add(a: f32, b: f32) -> f32 {");
    expect(out).toContain("let sum: f32 = (a + b);");
    expect(out).toContain("return sum;");
  });

  it("doFn works with no parameters and expression statements", () => {
    const f = wb.doFn(
      function* () {
        yield wb.return_(wb.literal("0.0"));
      },
      { name: "test", returnType: wb.f32 },
    );

    const out = wb.compile([f]);
    expect(out).toContain("return 0.0;");
  });

  it("doFn composition with helper generator", () => {
    function* sampleTexture(
      tex: wb.VarNode,
      samp: wb.VarNode,
      uv: wb.ExpressionNode,
    ) {
      return yield* wb.do_(
        wb.let_(wb.vec4f, wb.call(wb.textureSample, tex, samp, uv), {
          name: "color",
        }),
      );
    }

    const tex = wb.var_(wb.textureType("2d", "f32"), undefined, {
      name: "tex",
      global: true,
    });
    const samp = wb.var_(wb.samplerType(), undefined, {
      name: "samp",
      global: true,
    });

    const frag = wb.doFn(
      function* () {
        const sprite = yield* wb.do_(
          wb.parameter(
            wb.structFromObject({ uv: wb.vec2f }, { name: "Input" }),
            {
              name: "in",
            },
          ),
        );
        const col = yield* sampleTexture(tex, samp, wb.access(sprite, "uv"));
        yield* wb.do_(wb.return_(col));
      },
      {
        name: "frag",
        attributes: [wb.stage("fragment")],
        returnType: wb.returnType(wb.vec4f, [wb.location(0)]),
      },
    );

    const out = wb.compile([tex, samp, frag]);
    expect(out).toContain("fn frag(in: Input) -> @location(0) vec4f {");
    expect(out).toContain(
      "let color: vec4f = textureSample(tex, samp, in.uv);",
    );
    expect(out).toContain("return color;");
  });

  // #endregion

  // #region Statements

  it("compiles var statement with type and initialiser", () => {
    compileContains(
      [
        wb.fn([], [wb.var_(wb.f32, wb.literal("42.0"), { name: "v" })], {
          name: "main",
        }),
      ],
      "var v: f32 = 42.0;",
    );
  });

  it("compiles const statement with type inference", () => {
    compileContains(
      [
        wb.fn([], [wb.const_(wb.literal("3.0"), undefined, { name: "pi" })], {
          name: "main",
        }),
      ],
      "const pi = 3.0;",
    );
  });

  it("compiles const statement with explicit type", () => {
    compileContains(
      [
        wb.fn([], [wb.const_(wb.literal("3.0"), wb.f32, { name: "pi" })], {
          name: "main",
        }),
      ],
      "const pi: f32 = 3.0;",
    );
  });

  it("compiles let statement", () => {
    compileContains(
      [
        wb.fn([], [wb.let_(wb.f32, wb.literal("2.0"), { name: "x" })], {
          name: "main",
        }),
      ],
      "let x: f32 = 2.0;",
    );
  });

  it("compiles assign statement", () => {
    const y = wb.var_(wb.f32, undefined, { name: "y" });
    const assignStmt: wb.StatementNode = {
      kind: "assign",
      target: y,
      value: wb.literal("5.0"),
    };
    compileContains(
      [
        wb.fn([wb.parameter(wb.f32, { name: "x" })], [y, assignStmt], {
          name: "test",
        }),
      ],
      "y = 5.0;",
    );
  });

  it("compiles expression statement", () => {
    const stmt: wb.StatementNode = {
      kind: "expression-statement",
      expression: wb.call(wb.builtin("abs"), wb.literal("-1.0")),
    };
    compileContains([wb.fn([], [stmt], { name: "main" })], "abs(-1.0);");
  });

  // #endregion

  // #region Expressions

  it("compiles arithmetic expressions", () => {
    const f = wb.fn(
      [],
      [wb.return_(wb.binary("+", wb.literal("1.0"), wb.literal("2.0")))],
      {
        name: "add",
        returnType: wb.f32,
      },
    );
    compileContains([f], "return (1.0 + 2.0);");
  });

  it("compiles nested binary with correct parentheses", () => {
    const inner = wb.binary("*", wb.literal("a"), wb.literal("b"));
    const outer = wb.binary("+", inner, wb.literal("c"));
    compileContains(
      [wb.fn([], [wb.return_(outer)], { name: "expr" })],
      "return ((a * b) + c);",
    );
  });

  it("compiles call to builtin dot", () => {
    const c = wb.call(
      wb.dot,
      wb.identifier({ name: "a" }),
      wb.identifier({ name: "b" }),
    );
    compileContains(
      [
        wb.fn([], [wb.return_(c)], {
          name: "dotest",
          returnType: wb.f32,
        }),
      ],
      "dot(a, b)",
    );
  });

  it("compiles type constructor calls", () => {
    const c = wb.call(
      wb.vec3f,
      wb.literal("1.0"),
      wb.literal("2.0"),
      wb.literal("3.0"),
    );
    compileContains(
      [
        wb.fn([], [wb.return_(c)], {
          name: "vec3",
          returnType: wb.vec3f,
        }),
      ],
      "vec3f(1.0, 2.0, 3.0)",
    );
  });

  it("compiles struct constructor", () => {
    const Point = wb.structFromObject(
      { x: wb.f32, y: wb.f32 },
      { name: "Point" },
    );
    const c = wb.call(
      wb.structType(Point),
      wb.literal("1.0"),
      wb.literal("2.0"),
    );
    compileContains(
      [
        wb.fn([], [wb.return_(c)], {
          name: "makePoint",
          returnType: wb.structType(Point),
        }),
      ],
      "Point(1.0, 2.0)",
    );
  });

  it("compiles access and index", () => {
    const vec = wb.identifier({ name: "v" });
    const acc = wb.access(vec, "x");
    const idx = wb.index(vec, wb.literal("0"));
    const f = wb.fn(
      [],
      [
        wb.let_(undefined, acc, { name: "a" }),
        wb.let_(undefined, idx, { name: "b" }),
        wb.return_(wb.literal("0.0")),
      ],
      { name: "test", returnType: wb.f32 },
    );
    const out = wb.compile([f]);
    expect(out).toContain("v.x");
    expect(out).toContain("v[0]");
  });

  it("zero-argument call", () => {
    compileContains(
      [
        wb.fn([], [wb.return_(wb.call(wb.vec4f))], {
          name: "main",
          returnType: wb.vec4f,
        }),
      ],
      "vec4f()",
    );
  });

  // #endregion

  // #region Types

  it("all scalar types", () => {
    compileTo(
      [wb.var_(wb.bool, undefined, { name: "b", global: true })],
      "var b: bool;",
    );
    compileTo(
      [wb.var_(wb.f32, undefined, { name: "f", global: true })],
      "var f: f32;",
    );
    compileTo(
      [wb.var_(wb.i32, undefined, { name: "i", global: true })],
      "var i: i32;",
    );
    compileTo(
      [wb.var_(wb.u32, undefined, { name: "u", global: true })],
      "var u: u32;",
    );
  });

  it("vector and matrix types", () => {
    compileTo(
      [wb.var_(wb.vec2f, undefined, { name: "v2", global: true })],
      "var v2: vec2f;",
    );
    compileTo(
      [wb.var_(wb.vec3f, undefined, { name: "v3", global: true })],
      "var v3: vec3f;",
    );
    compileTo(
      [wb.var_(wb.vec4f, undefined, { name: "v4", global: true })],
      "var v4: vec4f;",
    );
    compileTo(
      [wb.var_(wb.mat3x3f, undefined, { name: "m", global: true })],
      "var m: mat3x3f;",
    );
  });

  it("array type with and without count", () => {
    compileTo(
      [
        wb.var_(wb.arrayType(wb.f32, 4), undefined, {
          name: "a",
          global: true,
        }),
      ],
      "var a: array<f32, 4>;",
    );
    compileTo(
      [
        wb.var_(wb.arrayType(wb.f32), undefined, {
          name: "b",
          global: true,
        }),
      ],
      "var b: array<f32>;",
    );
  });

  it("texture and sampler types", () => {
    compileTo(
      [
        wb.var_(wb.textureType("2d", "f32"), undefined, {
          name: "tex",
          global: true,
        }),
      ],
      "var tex: texture_2d<f32>;",
    );
    compileTo(
      [wb.var_(wb.samplerType(), undefined, { name: "smp", global: true })],
      "var smp: sampler;",
    );
  });

  // #endregion

  // #region Attributes

  it("all attribute kinds", () => {
    const vert = wb.fn(
      [
        wb.parameter(wb.u32, {
          name: "i",
          attributes: [
            wb.builtinAttr("vertex_index"),
            wb.group(0),
            wb.binding(0),
          ],
        }),
      ],
      [wb.return_()],
      { name: "v", attributes: [wb.stage("vertex")] },
    );
    const out = wb.compile([vert]);
    expect(out).toContain("@vertex fn v(");
    expect(out).toContain(
      "@builtin(vertex_index) @group(0) @binding(0) i: u32",
    );
  });

  it("global var with multiple attributes", () => {
    compileTo(
      [
        wb.var_(wb.textureType("2d", "f32"), undefined, {
          name: "t",
          global: true,
          attributes: [wb.group(0), wb.binding(1)],
        }),
      ],
      "@group(0) @binding(1) var t: texture_2d<f32>;",
    );
  });

  // #endregion

  // #region Error Cases

  it("throws when global var lacks a type", () => {
    compileThrows(
      [wb.var_(undefined, undefined, { global: true })],
      wb.NotImplementedError,
    );
  });

  it("detects cyclic struct dependencies", () => {
    const A = wb.structFromObject({ b: wb.f32 }, { name: "A" });
    A.members[0].type.struct = A;
    try {
      compileThrows([A], wb.CircularDependencyError);
    } finally {
      A.members[0].type.struct = undefined;
    }
  });

  it("unsupported top-level node kind is silently ignored", () => {
    const badNode = { kind: "unknown-kind" } as unknown as wb.ExpressionNode;
    expect(wb.compile([badNode])).toBe("");
  });

  // This should never happen if the switch is exhaustive, but we can force it by casting.
  it("throws UnreachableCodeError for impossible expression kind", () => {
    const fakeExpr = { kind: "non-existent" } as unknown as wb.ExpressionNode;
    expect(() =>
      wb.compile([wb.fn([], [wb.return_(fakeExpr)], { name: "bad" })]),
    ).toThrow(wb.UnreachableCodeError);
  });

  // #endregion

  // #region Edge Cases & Robustness

  it("handles deeply nested binary without stack overflow", () => {
    const expr = deepBinary(10000);
    compileNoThrow([wb.fn([], [wb.return_(expr)], { name: "deep" })]);
  });

  it("handles very long argument lists", () => {
    const args = Array.from({ length: 2000 }, (_, i) => wb.literal(`${i}.0`));
    compileNoThrow([
      wb.fn([], [wb.return_(wb.call(wb.vec4f, ...args))], {
        name: "manyArgs",
      }),
    ]);
  });

  it("unique names for many anonymous nodes", () => {
    const funcs = Array.from({ length: 100 }, () => wb.fn([], [], {}));
    const out = wb.compile(funcs);
    const names = out.match(/fn f_\d+/g);
    expect(new Set(names).size).toBe(100);
  });

  it("global const", () => {
    compileTo(
      [
        wb.const_(wb.literal("1.0"), wb.f32, {
          global: true,
          name: "ONE",
        }),
      ],
      "const ONE: f32 = 1.0;",
    );
  });

  it("global const without type", () => {
    compileTo(
      [
        wb.const_(wb.literal("1.0"), undefined, {
          global: true,
          name: "TWO",
        }),
      ],
      "const TWO = 1.0;",
    );
  });

  // #endregion

  // #region Built-in Functions Exports

  it("exports all major built-in functions", () => {
    expect(wb.builtin("abs")).toBeDefined();
    expect(wb.dot).toBeDefined();
    expect(wb.mix).toBeDefined();
    expect(wb.pow).toBeDefined();
    expect(wb.select).toBeDefined();
    expect(wb.textureSample).toBeDefined();
  });

  // #endregion

  // #region Fuzzing

  it("fuzz: random programs compile without unexpected errors", () => {
    const randomScalar = (): "f32" | "i32" | "u32" | "bool" =>
      (["f32", "i32", "u32", "bool"] as const)[Math.floor(Math.random() * 4)];

    const randomType = (depth: number = 2): wb.TypeNode => {
      const r = Math.random();
      if (depth <= 0 || r < 0.3) {
        return wb.scalarType(randomScalar());
      }
      if (r < 0.6) {
        return wb.vectorType(Math.floor(Math.random() * 4) + 2, "f32");
      }
      if (r < 0.8) {
        return wb.matrixType(
          Math.floor(Math.random() * 4) + 2,
          Math.floor(Math.random() * 4) + 2,
          "f32",
        );
      }
      return wb.arrayType(randomType(depth - 1));
    };

    const randomExpr = (depth: number = 3): wb.ExpressionNode => {
      if (depth <= 0) {
        return wb.literal(`${(Math.random() * 10).toFixed(2)}`);
      }
      const r = Math.random();
      if (r < 0.2) {
        return wb.identifier({ name: "v" });
      }
      if (r < 0.4) {
        return wb.binary(
          ["+", "-", "*", "/"][Math.floor(Math.random() * 4)],
          randomExpr(depth - 1),
          randomExpr(depth - 1),
        );
      }
      if (r < 0.6) {
        return wb.call(
          [wb.dot, wb.mix, wb.abs, wb.pow][Math.floor(Math.random() * 4)],
          randomExpr(depth - 1),
          randomExpr(depth - 1),
        );
      }
      if (r < 0.8) {
        return wb.access(randomExpr(depth - 1), "x");
      }
      return wb.index(randomExpr(depth - 1), wb.literal("0"));
    };

    const randomStmt = (depth: number = 2): wb.StatementNode => {
      const r = Math.random();
      if (r < 0.3) {
        return wb.var_(randomType(), randomExpr(depth - 1), {
          name: `v${crypto.randomUUID().replaceAll("-", "")}`,
        });
      }
      if (r < 0.6) {
        return wb.return_(randomExpr(depth - 1));
      }
      return {
        kind: "expression-statement",
        expression: randomExpr(depth - 1),
      };
    };

    for (let i = 0; i < 500; i++) {
      const body = Array.from(
        { length: 1 + Math.floor(Math.random() * 5) },
        () =>
          Math.random() < 0.9
            ? randomStmt(2)
            : {
                kind: "assign",
                target: wb.identifier({ name: "x" }),
                value: randomExpr(1),
              },
      );
      const func = wb.fn([], body as never, {
        name: `fuzz${i}`,
        returnType: Math.random() < 0.5 ? wb.f32 : undefined,
      });
      try {
        wb.compile([func]);
      } catch (e) {
        if (
          !(e instanceof wb.NotImplementedError) &&
          !(e instanceof wb.CircularDependencyError)
        ) {
          throw e;
        }
      }
    }
  });

  // #endregion
});
