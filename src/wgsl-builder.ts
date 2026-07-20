// #region Utility Functions

const joinWith =
  (separator: string) =>
  (previousValue: string, currentValue: string, currentIndex: number) => {
    if (currentIndex === 0) {
      return previousValue + currentValue;
    }
    return previousValue + separator + currentValue;
  };

const joinWithSpace = joinWith(" ");
const joinWithComma = joinWith(", ");
const joinWithNewline = joinWith("\n");
const joinWithDoubleNewline = joinWith("\n\n");

// #endregion

// #region Types

export type Stage = "vertex" | "fragment" | "compute";

export type Attribute =
  | { kind: "location"; value: number }
  | { kind: "builtin"; value: string }
  | { kind: "group"; value: number }
  | { kind: "binding"; value: number }
  | { kind: "stage"; value: Stage };

export type BaseNode = {
  attributes?: Attribute[];
  name?: string;
};

export type Node =
  | TypeNode
  | StructNode
  | StructMemberNode
  | VarNode
  | ConstNode
  | LetNode
  | FunctionNode
  | ParameterNode
  | ExpressionNode
  | StatementNode
  | BuiltinNode
  | ReturnTypeNode;

export type ScalarType = "bool" | "f32" | "i32" | "u32";

export type TextureDimensions =
  "1d" | "2d" | "2d_array" | "3d" | "cube" | "cube_array";

export type VectorType = {
  size: number;
  scalar: ScalarType;
};

export type MatrixType = {
  columns: number;
  rows: number;
  scalar: ScalarType;
};

export type ArrayType = {
  element: TypeNode;
  count?: number;
};

export type TextureType = {
  dimensions: TextureDimensions;
  format?: string;
};

export type TypeNode = BaseNode & {
  kind: "type";
  scalar?: ScalarType;
  vector?: VectorType;
  matrix?: MatrixType;
  array?: ArrayType;
  struct?: StructNode;
  texture?: TextureType;
  sampler?: boolean;
};

export type StructMemberNode = BaseNode & {
  kind: "member";
  type: TypeNode;
};

export type StructNode = BaseNode & {
  kind: "struct";
  members: StructMemberNode[];
};

export type ExpressionNode =
  | IdentifierNode
  | LiteralNode
  | BinaryNode
  | CallNode
  | AccessNode
  | IndexNode
  | VarNode
  | ConstNode
  | LetNode
  | ParameterNode;

export type IdentifierNode = BaseNode & {
  kind: "identifier";
};

export type LiteralNode = BaseNode & {
  kind: "literal";
  value: string;
};

export type BinaryNode = BaseNode & {
  kind: "binary";
  operator: string;
  left: ExpressionNode;
  right: ExpressionNode;
};

export type Callee = FunctionNode | BuiltinNode | TypeNode | StructNode;

export type CallNode = BaseNode & {
  kind: "call";
  callee: Callee;
  args: ExpressionNode[];
};

export type AccessNode = BaseNode & {
  kind: "access";
  object: ExpressionNode;
  member: string;
};

export type IndexNode = BaseNode & {
  kind: "index";
  object: ExpressionNode;
  index: ExpressionNode;
};

export type StatementNode =
  | VarNode
  | ConstNode
  | LetNode
  | ReturnNode
  | AssignNode
  | ExpressionStatementNode;

export type AddressSpace =
  "uniform" | "storage" | "workgroup" | "private" | "function";

export type VarNode = BaseNode & {
  kind: "var";
  type?: TypeNode | StructNode;
  value?: ExpressionNode;
  mutable?: boolean;
  global?: boolean;
  addressSpace?: AddressSpace;
};

export type ConstNode = BaseNode & {
  kind: "const";
  type?: TypeNode | StructNode;
  value: ExpressionNode;
  global?: boolean;
};

export type LetNode = BaseNode & {
  kind: "let";
  type?: TypeNode | StructNode;
  value?: ExpressionNode;
};

export type ReturnNode = BaseNode & {
  kind: "return";
  value?: ExpressionNode;
};

export type AssignNode = BaseNode & {
  kind: "assign";
  target: ExpressionNode;
  value: ExpressionNode;
};

export type ExpressionStatementNode = BaseNode & {
  kind: "expression-statement";
  expression: ExpressionNode;
};

export type ParameterNode = BaseNode & {
  kind: "parameter";
  type: TypeNode | StructNode;
};

export type ReturnTypeNode = BaseNode & {
  kind: "return-type";
  type: TypeNode | StructNode;
  attributes?: Attribute[];
};

export type FunctionNode = BaseNode & {
  kind: "fn";
  parameters: ParameterNode[];
  returnType?: TypeNode | StructNode | ReturnTypeNode;
  body: StatementNode[];
};

export type BuiltinNode = BaseNode & {
  kind: "builtin-fn";
};

// #endregion

// #region Error Classes

export class BaseError extends Error {
  static {
    this.prototype.name = "BaseError";
  }

  constructor(cause: unknown, message?: string) {
    super(message, { cause });
  }
}

const createErrorClass = (name: string) =>
  class extends BaseError {
    static {
      this.prototype.name = name;
    }
  };

export const NotImplementedError = createErrorClass("NotImplementedError");

export const UnreachableCodeError = createErrorClass("UnreachableCodeError");

export const CircularDependencyError = createErrorClass(
  "CircularDependencyError",
);

// #endregion

// #region Core Builders

export const scalarType = (scalar: ScalarType): TypeNode => ({
  kind: "type",
  scalar,
});

export const vectorType = (
  size: number,
  scalar: ScalarType = "f32",
): TypeNode => ({
  kind: "type",
  vector: { size, scalar },
});

export const matrixType = (
  columns: number,
  rows: number,
  scalar: ScalarType = "f32",
): TypeNode => ({
  kind: "type",
  matrix: { columns, rows, scalar },
});

export const arrayType = (element: TypeNode, count?: number): TypeNode => ({
  kind: "type",
  array: { element, count },
});

export const structType = (struct: StructNode): TypeNode => ({
  kind: "type",
  struct,
});

export const textureType = (
  dim: TextureDimensions,
  format?: string,
): TypeNode => ({
  kind: "type",
  texture: { dimensions: dim, format },
});

export const samplerType = (): TypeNode => ({
  kind: "type",
  sampler: true,
});

export const struct_ = (
  members: StructMemberNode[],
  options?: Partial<BaseNode>,
): StructNode => ({
  kind: "struct",
  members,
  ...options,
});

export const structFromObject = (
  obj: Record<string, TypeNode>,
  options?: Partial<BaseNode>,
): StructNode => ({
  kind: "struct",
  members: Object.entries(obj).map(([key, type]) =>
    member(type, { name: key }),
  ),
  ...options,
});

export const member = (
  type: TypeNode,
  options?: Partial<BaseNode>,
): StructMemberNode => ({
  kind: "member",
  type,
  ...options,
});

export const identifier = (options?: Partial<BaseNode>): IdentifierNode => ({
  kind: "identifier",
  ...options,
});

export const literal = (value: string): LiteralNode => ({
  kind: "literal",
  value,
});

export const binary = (
  operator: string,
  left: ExpressionNode,
  right: ExpressionNode,
): BinaryNode => ({
  kind: "binary",
  operator,
  left,
  right,
});

export const call = (callee: Callee, ...args: ExpressionNode[]): CallNode => ({
  kind: "call",
  callee,
  args: args,
});

export const access = (object: ExpressionNode, member: string): AccessNode => ({
  kind: "access",
  object,
  member,
});

export const index = (
  object: ExpressionNode,
  index: ExpressionNode,
): IndexNode => ({
  kind: "index",
  object,
  index,
});

export const var_ = (
  type?: TypeNode | StructNode,
  value?: ExpressionNode,
  options?: Partial<VarNode>,
): VarNode => ({
  kind: "var",
  type,
  value,
  ...options,
});

export const const_ = (
  value: ExpressionNode,
  type?: TypeNode | StructNode,
  options?: Partial<ConstNode>,
): ConstNode => ({
  kind: "const",
  type,
  value,
  ...options,
});

export const let_ = (
  type?: TypeNode | StructNode,
  value?: ExpressionNode,
  options?: Partial<LetNode>,
): LetNode => ({
  kind: "let",
  type,
  value,
  ...options,
});

export const parameter = (
  type: TypeNode | StructNode,
  options?: Partial<BaseNode>,
): ParameterNode => ({
  kind: "parameter",
  type,
  ...options,
});

export const fn = (
  parameters: ParameterNode[],
  body: StatementNode[],
  options?: Partial<FunctionNode>,
): FunctionNode => ({
  kind: "fn",
  parameters,
  body,
  ...options,
});

export const return_ = (value?: ExpressionNode): ReturnNode => ({
  kind: "return",
  value,
});

export const returnType = (
  type: TypeNode | StructNode,
  attributes?: Attribute[],
): ReturnTypeNode => ({
  kind: "return-type",
  type,
  attributes,
});

export const builtin = (name: string): BuiltinNode => ({
  kind: "builtin-fn",
  name,
});

// #endregion

// #region Function Builder

export function* do_<T extends Node>(node: T): Generator<T, T, void> {
  yield node;
  return node;
}

export const doFn = (
  bodyGenerator: () => Generator<Node, void, void>,
  options?: Partial<Omit<FunctionNode, "parameters" | "body">>,
): FunctionNode => {
  const iterator = bodyGenerator();
  const parameters: ParameterNode[] = [];
  const body: StatementNode[] = [];

  for (const item of iterator) {
    if (item.kind === "parameter") {
      parameters.push(item);
    } else if (item.kind === "return") {
      body.push(item as ReturnNode);
    } else if ("kind" in item) {
      body.push(item as StatementNode);
    } else {
      body.push({
        kind: "expression-statement",
        expression: item as ExpressionNode,
      });
    }
  }

  return fn(parameters, body, options);
};

// #endregion

// #region Attribute Builders

export const location = (value: number): Attribute => ({
  kind: "location",
  value,
});

export const builtinAttr = (value: string): Attribute => ({
  kind: "builtin",
  value,
});

export const group = (value: number): Attribute => ({
  kind: "group",
  value,
});

export const binding = (value: number): Attribute => ({
  kind: "binding",
  value,
});

export const stage = (value: Stage): Attribute => ({
  kind: "stage",
  value,
});

// #endregion

// #region Compiler

type CompileContext = {
  names: WeakMap<object, string>;
  usedNames: Set<string>;
  emitted: WeakSet<object>;
};

const createContext = (): CompileContext => ({
  names: new WeakMap(),
  usedNames: new Set(),
  emitted: new WeakSet(),
});

const normalizeName = (name: string): string =>
  name
    .normalize("NFC")
    .replace(/^[^\p{L}_]/u, "_")
    .replace(/[^\p{L}_\p{N}]/gu, "_");

const baseName = (node: Node): string => {
  if (node.name) {
    return normalizeName(node.name);
  }
  switch (node.kind) {
    case "fn":
    case "var":
    case "let":
    case "const":
    case "struct":
    case "member":
    case "parameter":
      return node.kind[0];
  }
  throw new NotImplementedError(node);
};

const getName = (context: CompileContext, node: Node): string => {
  if (node.kind === "builtin-fn") {
    return node.name!;
  }

  const existing = context.names.get(node);

  if (existing) {
    return existing;
  }

  const base = baseName(node);
  let candidate: string;
  let i = 0;

  if (node.name) {
    candidate = base;
    while (context.usedNames.has(candidate)) {
      candidate = `${base}_${i++}`;
    }
  } else {
    candidate = `${base}_${i++}`;
    while (context.usedNames.has(candidate)) {
      candidate = `${base}_${i++}`;
    }
  }

  context.usedNames.add(candidate);
  context.names.set(node, candidate);

  return candidate;
};

const scalarSuffix: Record<ScalarType, string> = {
  f32: "f",
  i32: "i",
  u32: "u",
  bool: "",
};

const compileType = (
  context: CompileContext,
  type: TypeNode | StructNode,
): string => {
  if ("kind" in type && type.kind === "struct") {
    return getName(context, type);
  }

  const node = type;
  if (node.scalar) {
    return node.scalar;
  }
  if (node.vector) {
    return `vec${node.vector.size}${scalarSuffix[node.vector.scalar]}`;
  }
  if (node.matrix) {
    return `mat${node.matrix.columns}x${node.matrix.rows}${
      scalarSuffix[node.matrix.scalar]
    }`;
  }
  if (node.texture) {
    return `texture_${node.texture.dimensions}${
      node.texture.format ? `<${node.texture.format}>` : ""
    }`;
  }
  if (node.sampler) {
    return "sampler";
  }
  if (node.array) {
    const element = compileType(context, node.array.element);
    if (node.array.count !== undefined) {
      return `array<${element}, ${node.array.count}>`;
    }
    return `array<${element}>`;
  }
  if (node.struct) {
    return getName(context, node.struct);
  }

  throw new NotImplementedError(node);
};

type ExprFrame = {
  node: ExpressionNode;
  state: number;
  calleeStr?: string;
  args?: string[];
  argIndex?: number;
};

const compileExpression = (
  context: CompileContext,
  root: ExpressionNode,
): string => {
  const stack: ExprFrame[] = [{ node: root, state: 0 }];
  const result: string[] = [];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const { node } = frame;

    switch (node.kind) {
      case "identifier":
      case "var":
      case "let":
      case "const":
      case "parameter":
        result.push(getName(context, node));
        stack.pop();
        break;

      case "literal":
        result.push(node.value);
        stack.pop();
        break;

      case "binary":
        if (frame.state === 0) {
          frame.state = 1;
          stack.push({ node: node.left, state: 0 });
        } else if (frame.state === 1) {
          frame.state = 2;
          stack.push({ node: node.right, state: 0 });
        } else {
          const right = result.pop()!;
          const left = result.pop()!;
          stack.pop();
          result.push(`(${left} ${node.operator} ${right})`);
        }
        break;

      case "access":
        if (frame.state === 0) {
          frame.state = 1;
          stack.push({ node: node.object, state: 0 });
        } else {
          const object = result.pop()!;
          stack.pop();
          result.push(`${object}.${node.member}`);
        }
        break;

      case "index":
        if (frame.state === 0) {
          frame.state = 1;
          stack.push({ node: node.object, state: 0 });
        } else if (frame.state === 1) {
          frame.state = 2;
          stack.push({ node: node.index, state: 0 });
        } else {
          const index = result.pop()!;
          const object = result.pop()!;
          stack.pop();
          result.push(`${object}[${index}]`);
        }
        break;

      case "call":
        if (frame.state === 0) {
          const callee = node.callee;
          if (callee.kind === "type") {
            frame.calleeStr = compileType(context, callee);
          } else if (callee.kind === "struct") {
            frame.calleeStr = compileType(context, callee);
          } else {
            frame.calleeStr = getName(context, callee);
          }
          if (node.args.length === 0) {
            stack.pop();
            result.push(`${frame.calleeStr}()`);
          } else {
            frame.args = [];
            frame.argIndex = 0;
            frame.state = 1;
            stack.push({ node: node.args[0], state: 0 });
          }
        } else {
          frame.args!.push(result.pop()!);
          frame.argIndex!++;
          if (frame.argIndex! < node.args.length) {
            stack.push({ node: node.args[frame.argIndex!], state: 0 });
          } else {
            stack.pop();
            result.push(`${frame.calleeStr}(${frame.args!.join(", ")})`);
          }
        }
        break;

      default:
        throw new UnreachableCodeError(node);
    }
  }

  return result[0];
};

const compileAttribute = (attribute: Attribute): string => {
  switch (attribute.kind) {
    case "location":
      return `@location(${attribute.value})`;
    case "builtin":
      return `@builtin(${attribute.value})`;
    case "group":
      return `@group(${attribute.value})`;
    case "binding":
      return `@binding(${attribute.value})`;
    case "stage":
      return `@${attribute.value}`;
    default:
      throw new NotImplementedError(attribute);
  }
};

const compileAttributes = (attributes?: Attribute[]): string => {
  if (!attributes?.length) {
    return "";
  }

  return (
    attributes.values().map(compileAttribute).reduce(joinWithSpace, "") + " "
  );
};

const compileStatement = (
  context: CompileContext,
  statement: StatementNode,
): string => {
  switch (statement.kind) {
    case "var": {
      const typePart = statement.type
        ? `: ${compileType(context, statement.type)}`
        : "";
      const initPart = statement.value
        ? ` = ${compileExpression(context, statement.value)}`
        : "";
      return `var ${getName(context, statement)}${typePart}${initPart};`;
    }

    case "const": {
      const typePart = statement.type
        ? `: ${compileType(context, statement.type)}`
        : "";
      return `const ${getName(context, statement)}${typePart} = ${compileExpression(
        context,
        statement.value,
      )};`;
    }

    case "let": {
      const typePart = statement.type
        ? `: ${compileType(context, statement.type)}`
        : "";
      const initPart = statement.value
        ? ` = ${compileExpression(context, statement.value)}`
        : "";
      return `let ${getName(context, statement)}${typePart}${initPart};`;
    }

    case "return":
      return statement.value
        ? `return ${compileExpression(context, statement.value)};`
        : "return;";

    case "assign":
      return `${compileExpression(context, statement.target)} = ${compileExpression(
        context,
        statement.value,
      )};`;

    case "expression-statement":
      return `${compileExpression(context, statement.expression)};`;
  }
};

const compileNode = (context: CompileContext, node: Node): string => {
  if (context.emitted.has(node)) {
    return "";
  }

  context.emitted.add(node);

  switch (node.kind) {
    case "type":
    case "builtin-fn":
      return "";

    case "struct": {
      const membersStr = node.members
        .values()
        .map((member) => {
          const attributes = compileAttributes(member.attributes);
          return `  ${attributes}${getName(context, member)}: ${compileType(
            context,
            member.type,
          )},`;
        })
        .reduce(joinWithNewline, "");

      return `struct ${getName(context, node)} {\n${membersStr}\n};`;
    }

    case "var": {
      if (!node.global) {
        return "";
      }
      if (!node.type) {
        throw new NotImplementedError(node);
      }
      const addressSpace = node.addressSpace ? `<${node.addressSpace}>` : "";
      const attributes = compileAttributes(node.attributes);
      return `${attributes}var${addressSpace} ${getName(context, node)}: ${compileType(
        context,
        node.type,
      )};`;
    }

    case "const": {
      if (!node.global) {
        return "";
      }
      const attributes = compileAttributes(node.attributes);
      const typePart = node.type ? `: ${compileType(context, node.type)}` : "";
      return `${attributes}const ${getName(context, node)}${typePart} = ${compileExpression(
        context,
        node.value,
      )};`;
    }

    case "fn": {
      const parameters = node.parameters
        .values()
        .map((parameter) => {
          const attributes = compileAttributes(parameter.attributes);
          return `${attributes}${getName(context, parameter)}: ${compileType(
            context,
            parameter.type,
          )}`;
        })
        .reduce(joinWithComma, "");

      const returnPart = (() => {
        if (!node.returnType) {
          return "";
        }
        if (node.returnType.kind === "return-type") {
          const attributes = compileAttributes(node.returnType.attributes);
          return ` -> ${attributes}${compileType(
            context,
            node.returnType.type,
          )}`;
        }
        return ` -> ${compileType(context, node.returnType)}`;
      })();

      const bodyStr = node.body
        .values()
        .map((statement) => `  ${compileStatement(context, statement)}`)
        .reduce(joinWithNewline, "");

      const attributes = compileAttributes(node.attributes);
      return `${attributes}fn ${getName(
        context,
        node,
      )}(${parameters})${returnPart} {\n${bodyStr}\n}`;
    }

    default:
      throw new NotImplementedError(node);
  }
};

const collectDependencies = (
  root: Node,
  output: Set<Node> = new Set(),
): Set<Node> => {
  const stack: Node[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;

    if (output.has(node)) {
      continue;
    }

    output.add(node);

    const pushExpression = (expression?: ExpressionNode) => {
      if (expression) {
        stack.push(expression);
      }
    };

    const pushTypeOrReturn = (
      node?: TypeNode | StructNode | ReturnTypeNode,
    ) => {
      if (node) {
        if (node.kind === "return-type") {
          stack.push(node.type);
        } else {
          stack.push(node);
        }
      }
    };

    switch (node.kind) {
      case "struct":
        for (const member of node.members) {
          stack.push(member);
        }
        break;

      case "member":
        stack.push(node.type);
        break;

      case "type":
        if (node.array) {
          stack.push(node.array.element);
        }
        if (node.struct) {
          stack.push(node.struct);
        }
        break;

      case "fn":
        for (const parameter of node.parameters) {
          stack.push(parameter);
        }
        pushTypeOrReturn(node.returnType);
        for (const statement of node.body) {
          stack.push(statement);
        }
        break;

      case "parameter":
        stack.push(node.type);
        break;

      case "var":
      case "let":
      case "const":
        if (node.type) {
          stack.push(node.type);
        }
        if ("value" in node && node.value) {
          pushExpression(node.value);
        }
        break;

      case "call":
        stack.push(node.callee);
        for (const arg of node.args) {
          pushExpression(arg);
        }
        break;

      case "binary":
        pushExpression(node.left);
        pushExpression(node.right);
        break;

      case "access":
        pushExpression(node.object);
        break;

      case "index":
        pushExpression(node.object);
        pushExpression(node.index);
        break;

      case "return":
        if (node.value) {
          pushExpression(node.value);
        }
        break;

      case "assign":
        pushExpression(node.target);
        pushExpression(node.value);
        break;

      case "expression-statement":
        pushExpression(node.expression);
        break;
    }
  }

  return output;
};

const getImmediateTopDependencies = (node: Node): Node[] => {
  const dependencies: Node[] = [];

  const pushStruct = (node: TypeNode | StructNode) => {
    if (node.kind === "struct") {
      dependencies.push(node);
    } else if (node.kind === "type" && node.struct) {
      dependencies.push(node.struct);
    }
  };

  if (node.kind === "struct") {
    for (const member of node.members) {
      if (member.type.kind === "type" && member.type.struct) {
        dependencies.push(member.type.struct);
      }
    }
  } else if (node.kind === "fn") {
    for (const parameter of node.parameters) {
      pushStruct(parameter.type);
    }
    if (node.returnType) {
      if (node.returnType.kind === "return-type") {
        pushStruct(node.returnType.type);
      } else {
        pushStruct(node.returnType);
      }
    }
  } else if (
    (node.kind === "var" && node.global) ||
    (node.kind === "const" && node.global)
  ) {
    if (node.type) {
      pushStruct(node.type);
    }
  }

  return dependencies;
};

const isTopNode = (node: Node) =>
  node.kind === "struct" ||
  node.kind === "fn" ||
  (node.kind === "var" && node.global) ||
  (node.kind === "const" && node.global);

const priority = (node: Node): number => {
  if (node.kind === "struct") {
    return 0;
  }
  if (
    (node.kind === "var" && node.global) ||
    (node.kind === "const" && node.global)
  ) {
    return 1;
  }
  return 2;
};

const byPriority = (a: Node, b: Node): number => priority(a) - priority(b);

export const compile = (roots: Node[]): string => {
  const context = createContext();
  const allNodes = new Set<Node>();

  for (const root of roots) {
    collectDependencies(root, allNodes);
  }

  const topNodes = allNodes
    .values()
    .filter(isTopNode)
    .toArray()
    .sort(byPriority);

  const order: Node[] = [];
  const permanent = new Set<Node>();
  const temporary = new Set<Node>();

  for (const start of topNodes) {
    const stack: { node: Node; state: "enter" | "exit" }[] = [
      { node: start, state: "enter" },
    ];

    while (stack.length > 0) {
      const { node, state } = stack.pop()!;

      if (state === "exit") {
        order.push(node);
        permanent.add(node);
        temporary.delete(node);
        continue;
      }
      if (permanent.has(node)) {
        continue;
      }
      if (temporary.has(node)) {
        throw new CircularDependencyError(node);
      }

      temporary.add(node);
      stack.push({ node, state: "exit" });

      for (const dependency of getImmediateTopDependencies(node)) {
        if (!permanent.has(dependency)) {
          stack.push({ node: dependency, state: "enter" });
        }
      }
    }
  }

  return order
    .values()
    .map((node) => compileNode(context, node))
    .filter(Boolean)
    .reduce(joinWithDoubleNewline, "");
};

// #endregion

// #region Built-in Types (Convenience Exports)

export const bool = scalarType("bool");
export const f32 = scalarType("f32");
export const i32 = scalarType("i32");
export const u32 = scalarType("u32");

export const vec2f = vectorType(2, "f32");
export const vec2i = vectorType(2, "i32");
export const vec2u = vectorType(2, "u32");
export const vec3f = vectorType(3, "f32");
export const vec3i = vectorType(3, "i32");
export const vec3u = vectorType(3, "u32");
export const vec4f = vectorType(4, "f32");
export const vec4i = vectorType(4, "i32");
export const vec4u = vectorType(4, "u32");

export const mat2x2f = matrixType(2, 2, "f32");
export const mat2x3f = matrixType(2, 3, "f32");
export const mat2x4f = matrixType(2, 4, "f32");
export const mat3x2f = matrixType(3, 2, "f32");
export const mat3x3f = matrixType(3, 3, "f32");
export const mat3x4f = matrixType(3, 4, "f32");
export const mat4x2f = matrixType(4, 2, "f32");
export const mat4x3f = matrixType(4, 3, "f32");
export const mat4x4f = matrixType(4, 4, "f32");

// #endregion

// #region Built-in Functions (Convenience Exports)

export const abs = builtin("abs");
export const acos = builtin("acos");
export const arrayLength = builtin("arrayLength");
export const asin = builtin("asin");
export const atan = builtin("atan");
export const atan2 = builtin("atan2");
export const ceil = builtin("ceil");
export const clamp = builtin("clamp");
export const cos = builtin("cos");
export const cosh = builtin("cosh");
export const cross = builtin("cross");
export const degrees = builtin("degrees");
export const determinant = builtin("determinant");
export const distance = builtin("distance");
export const dot = builtin("dot");
export const exp = builtin("exp");
export const exp2 = builtin("exp2");
export const faceForward = builtin("faceForward");
export const floor = builtin("floor");
export const fma = builtin("fma");
export const fract = builtin("fract");
export const frexp = builtin("frexp");
export const inverseSqrt = builtin("inverseSqrt");
export const ldexp = builtin("ldexp");
export const length = builtin("length");
export const log = builtin("log");
export const log2 = builtin("log2");
export const max = builtin("max");
export const min = builtin("min");
export const mix = builtin("mix");
export const modf = builtin("modf");
export const normalize = builtin("normalize");
export const pow = builtin("pow");
export const radians = builtin("radians");
export const reflect = builtin("reflect");
export const refract = builtin("refract");
export const round = builtin("round");
export const saturate = builtin("saturate");
export const select = builtin("select");
export const sign = builtin("sign");
export const sin = builtin("sin");
export const sinh = builtin("sinh");
export const smoothstep = builtin("smoothstep");
export const sqrt = builtin("sqrt");
export const step = builtin("step");
export const storageBarrier = builtin("storageBarrier");
export const tan = builtin("tan");
export const tanh = builtin("tanh");
export const textureDimensions = builtin("textureDimensions");
export const textureLoad = builtin("textureLoad");
export const textureNumLayers = builtin("textureNumLayers");
export const textureNumLevels = builtin("textureNumLevels");
export const textureNumSamples = builtin("textureNumSamples");
export const textureSample = builtin("textureSample");
export const textureSampleBias = builtin("textureSampleBias");
export const textureSampleCompare = builtin("textureSampleCompare");
export const textureSampleGrad = builtin("textureSampleGrad");
export const textureSampleLevel = builtin("textureSampleLevel");
export const textureStore = builtin("textureStore");
export const transpose = builtin("transpose");
export const trunc = builtin("trunc");
export const workgroupBarrier = builtin("workgroupBarrier");

// #endregion
