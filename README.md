# WGSL Builder

A library for constructing WGSL shaders using a typed AST, intended as a safer alternative to string concatenation. It compiles the AST to a valid WGSL source string.

## What it is

WGSL Builder provides TypeScript types for every WGSL construct and a set of builder functions to create them. The compiler then emits WGSL, handling deduplication, naming, and topological ordering of dependencies automatically.

The goal is to reduce errors when assembling shaders from reusable pieces: there is no risk of redefining a helper function or struct, and dependencies always appear in the correct order.

## Usage

````ts
import * as wb from "./src/wgsl-builder.ts";

const add = wb.doFn(
  function* () {
    const a = yield* wb.do_(wb.parameter(wb.f32));
    const b = yield* wb.do_(wb.parameter(wb.f32));
    const c = yield* wb.do_(wb.let_(wb.f32, wb.binary("+", a, b)));
    yield* wb.do_(wb.return_(c));
  },
  { returnType: wb.f32 },
);

/**
 * ```wgsl
 * fn f_0(p_0: f32, p_1: f32) -> f32 {
 *   let l_0: f32 = (p_0 + p_1);
 *   return l_0;
 * }
 * ```
 */
const wgsl = wb.compile([add]);
````

## Features

- **Automatic deduplication.** A struct or function referenced from multiple shaders is emitted only once per compilation, avoiding redefinition errors.
- **Topological ordering.** Dependencies between global declarations are resolved so that structs are always emitted before they are used.
- **Typed AST with TypeScript.** Every WGSL construct is a typed node, giving you editor support and catching mistakes at build time rather than at shader creation.
- **Generator‑based function builder.** `doFn` lets you write shader bodies in a procedural style, reusing the object returned by `yield* do_()` directly in later expressions.

## Limitations and TODO

The library is not complete. Notable missing WGSL features include:

- Control flow statements: `if`/`else`, `switch`, `loop`, `for`, `while`, `break`, `continue`.
- `discard` statement.
- Pointers and pointer types.
- Atomic types and atomic built‑in functions.
- `enable`, `requires`, and diagnostic directives.
- External textures (`texture_external`).
- Interpolation attributes (`@interpolate`, `@invariant`).
- Some built‑in functions (e.g., `quantizeToF16`, `pack`/`unpack` functions).
- Predeclared enumerants (e.g., for texel format or interpolation type).

Error handling is minimal and some edge cases may throw generic errors. The library has only been tested with the included Vitest suite and a few hand‑written examples.

## Status

This is a personal experiment and not production‑ready. It may be abandoned or rewritten without notice.
