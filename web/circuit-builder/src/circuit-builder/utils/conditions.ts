import type { Expr, ExprKind } from "../types";

export type ExprValueType = "int" | "float" | "bool" | "numeric" | "unknown";
export type ComparisonBuilderOperator = "==" | "!=" | "<" | "<=" | ">" | ">=";
export type BinaryExprKind = Exclude<ExprKind, "int" | "float" | "bool" | "reg" | "not">;

const BINARY_EXPR_KEYS = {
  and: "And",
  or: "Or",
  xor: "Xor",
  add: "Add",
  sub: "Sub",
  mul: "Mul",
  div: "Div",
  rem: "Rem",
  eq: "Eq",
  lt: "Lt",
} as const satisfies Record<BinaryExprKind, string>;

const BINARY_EXPR_SYMBOLS = {
  and: "&",
  or: "|",
  xor: "^",
  add: "+",
  sub: "-",
  mul: "*",
  div: "/",
  rem: "%",
  eq: "==",
  lt: "<",
} as const satisfies Record<BinaryExprKind, string>;

const BINARY_KINDS = Object.keys(BINARY_EXPR_KEYS) as BinaryExprKind[];

export function intExpr(value = 0): Expr {
  return { Val: { Int: value } };
}

export function floatExpr(value = 0): Expr {
  return { Val: { Float: value } };
}

export function boolExpr(value = false): Expr {
  return { Val: { Bool: value } };
}

export function registerExpr(name: string): Expr {
  return { Reg: name };
}

export function notExpr(expr: Expr): Expr {
  return { Not: expr };
}

export function binaryExpr(kind: BinaryExprKind, left: Expr, right: Expr): Expr {
  return { [BINARY_EXPR_KEYS[kind]]: [left, right] } as Expr;
}

export function getExprKind(expr: Expr): ExprKind {
  if ("Val" in expr) {
    if ("Int" in expr.Val) {
      return "int";
    }
    if ("Float" in expr.Val) {
      return "float";
    }
    return "bool";
  }
  if ("Reg" in expr) {
    return "reg";
  }
  if ("Not" in expr) {
    return "not";
  }
  for (const kind of BINARY_KINDS) {
    if (BINARY_EXPR_KEYS[kind] in expr) {
      return kind;
    }
  }
  return "lt";
}

export function getNotOperand(expr: Expr): Expr | null {
  return "Not" in expr ? expr.Not : null;
}

export function getBinaryOperands(expr: Expr): [Expr, Expr] | null {
  const key = getBinaryExprKey(expr);
  return key ? (expr as Record<string, [Expr, Expr]>)[key] : null;
}

export function isLeafExpr(expr: Expr) {
  const kind = getExprKind(expr);
  return kind === "reg" || kind === "int" || kind === "float" || kind === "bool";
}

export function createDefaultConditionExpression(registerName: string): Expr {
  return comparisonExpr("==", registerExpr(registerName), intExpr(0));
}

export function comparisonExpr(operator: ComparisonBuilderOperator, left: Expr, right: Expr): Expr {
  switch (operator) {
    case "==":
      return binaryExpr("eq", left, right);
    case "!=":
      return notExpr(binaryExpr("eq", left, right));
    case "<":
      return binaryExpr("lt", left, right);
    case "<=":
      return notExpr(binaryExpr("lt", right, left));
    case ">":
      return binaryExpr("lt", right, left);
    case ">=":
      return notExpr(binaryExpr("lt", left, right));
  }
}

export function describeExpr(expr: Expr): string {
  const kind = getExprKind(expr);
  switch (kind) {
    case "int":
    case "float":
      return String(getNumberValue(expr));
    case "bool":
      return getBoolValue(expr) ? "true" : "false";
    case "reg":
      return getRegisterName(expr);
    case "not":
      return `!${wrapExpr(getNotOperand(expr)!)}`;
    default: {
      const [left, right] = getBinaryOperands(expr)!;
      return `${wrapExpr(left)} ${BINARY_EXPR_SYMBOLS[kind as BinaryExprKind]} ${wrapExpr(right)}`;
    }
  }
}

export function describeExprCompact(expr: Expr, maxLength = 16): string {
  const raw = describeExpr(expr);
  return raw.length <= maxLength ? raw : `${raw.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function exprRegisters(expr: Expr): string[] {
  const registers = new Set<string>();
  collectExprRegisters(expr, registers);
  return [...registers];
}

export function rebindConditionAnchor(expr: Expr, fromRegister: string, toRegister: string): Expr {
  const referencedRegisters = exprRegisters(expr);
  if (referencedRegisters.length === 1 && referencedRegisters[0] === fromRegister) {
    return replaceRegisterRefs(expr, fromRegister, toRegister);
  }
  return expr;
}

export function defaultExprForKind(kind: ExprKind): Expr {
  switch (kind) {
    case "int":
      return intExpr(0);
    case "float":
      return floatExpr(0);
    case "bool":
      return boolExpr(false);
    case "reg":
      return registerExpr("");
    case "not":
      return notExpr(boolExpr(false));
    case "and":
    case "or":
    case "xor":
      return binaryExpr(kind, boolExpr(false), boolExpr(false));
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "rem":
      return binaryExpr(kind, intExpr(0), intExpr(0));
    case "eq":
    case "lt":
      return binaryExpr(kind, registerExpr(""), intExpr(0));
  }
}

export function replaceExprKind(expr: Expr, nextKind: ExprKind, fallbackRegister: string | null): Expr {
  const next = defaultExprForKind(nextKind);
  if (nextKind === "reg") {
    return registerExpr(fallbackRegister ?? "");
  }

  if (getExprKind(expr) === "not" && nextKind === "not") {
    return expr;
  }

  const currentOperands = getBinaryOperands(expr);
  const nextOperands = getBinaryOperands(next);
  if (currentOperands && nextOperands) {
    return binaryExpr(nextKind as BinaryExprKind, currentOperands[0], currentOperands[1]);
  }

  if (getExprKind(expr) === "not" && nextKind === "not") {
    return notExpr(getNotOperand(expr)!);
  }

  return next;
}

export function getExprAtPath(root: Expr, path: string): Expr | null {
  const segments = parseExprPath(path);
  let current: Expr = root;

  for (const segment of segments) {
    if (segment === "expr") {
      const inner = getNotOperand(current);
      if (!inner) {
        return null;
      }
      current = inner;
      continue;
    }

    if (segment === "left" || segment === "right") {
      const operands = getBinaryOperands(current);
      if (!operands) {
        return null;
      }
      current = operands[segment === "left" ? 0 : 1];
      continue;
    }

    return null;
  }

  return current;
}

export function updateExprAtPath(root: Expr, path: string, updater: (expr: Expr) => Expr): Expr {
  const segments = parseExprPath(path);
  if (segments.length === 0) {
    return updater(root);
  }

  return updateExprBySegments(root, segments, updater);
}

export function validateConditionExpression(expr: Expr): string[] {
  const rootType = inferExprType(expr);
  const issues = validateExpression(expr);
  if (rootType !== "bool" && rootType !== "unknown") {
    issues.push("Condition root must evaluate to a boolean value.");
  }
  return issues;
}

export function validateExpression(expr: Expr): string[] {
  return validateExpr(expr);
}

export function inferExprType(expr: Expr): ExprValueType {
  const kind = getExprKind(expr);
  switch (kind) {
    case "int":
      return "int";
    case "float":
      return "float";
    case "bool":
      return "bool";
    case "reg":
      return "unknown";
    case "not": {
      const innerType = inferExprType(getNotOperand(expr)!);
      if (innerType === "bool" || innerType === "int") {
        return innerType;
      }
      return "unknown";
    }
    case "and":
    case "or":
    case "xor": {
      const [left, right] = getBinaryOperands(expr)!;
      const leftType = inferExprType(left);
      const rightType = inferExprType(right);
      if (leftType === "bool" && rightType === "bool") {
        return "bool";
      }
      if (leftType === "int" && rightType === "int") {
        return "int";
      }
      if (
        (isDefinitelyIntegerLike(leftType) && rightType === "unknown") ||
        (leftType === "unknown" && isDefinitelyIntegerLike(rightType))
      ) {
        return "numeric";
      }
      if (leftType === "unknown" && (rightType === "bool" || rightType === "int" || rightType === "unknown")) {
        return rightType;
      }
      if (rightType === "unknown" && (leftType === "bool" || leftType === "int" || leftType === "unknown")) {
        return leftType;
      }
      return "unknown";
    }
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "rem": {
      const [left, right] = getBinaryOperands(expr)!;
      return inferNumericResultType(left, right);
    }
    case "eq":
    case "lt":
      return "bool";
  }
}

function validateExpr(expr: Expr): string[] {
  const issues: string[] = [];
  const kind = getExprKind(expr);

  switch (kind) {
    case "reg":
      if (!getRegisterName(expr).trim()) {
        issues.push("Register references must select a register.");
      }
      break;
    case "not": {
      const inner = getNotOperand(expr)!;
      const innerType = inferExprType(inner);
      if (innerType !== "bool" && innerType !== "int" && innerType !== "unknown") {
        issues.push("NOT only supports boolean or integer expressions.");
      }
      issues.push(...validateExpr(inner));
      break;
    }
    case "and":
    case "or":
    case "xor": {
      const [left, right] = getBinaryOperands(expr)!;
      const leftType = inferExprType(left);
      const rightType = inferExprType(right);
      const validBitwiseOrBoolean =
        (leftType === "bool" && rightType === "bool") ||
        (leftType === "int" && rightType === "int") ||
        (leftType === "unknown" && (rightType === "bool" || rightType === "int" || rightType === "unknown")) ||
        (rightType === "unknown" && (leftType === "bool" || leftType === "int" || leftType === "unknown"));
      if (!validBitwiseOrBoolean) {
        issues.push(`${kind.toUpperCase()} requires matching boolean or integer operands.`);
      }
      issues.push(...validateExpr(left), ...validateExpr(right));
      break;
    }
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "rem":
    case "lt": {
      const [left, right] = getBinaryOperands(expr)!;
      const leftType = inferExprType(left);
      const rightType = inferExprType(right);
      if (leftType === "bool" || rightType === "bool") {
        issues.push(`${kind.toUpperCase()} only supports numeric operands.`);
      }
      issues.push(...validateExpr(left), ...validateExpr(right));
      break;
    }
    case "eq": {
      const [left, right] = getBinaryOperands(expr)!;
      issues.push(...validateExpr(left), ...validateExpr(right));
      break;
    }
    default:
      break;
  }

  return [...new Set(issues)];
}

function inferNumericResultType(left: Expr, right: Expr): ExprValueType {
  const leftType = inferExprType(left);
  const rightType = inferExprType(right);

  if (leftType === "bool" || rightType === "bool") {
    return "unknown";
  }
  if (leftType === "float" || rightType === "float") {
    return "float";
  }
  if (leftType === "int" && rightType === "int") {
    return "int";
  }
  if (
    leftType === "numeric" ||
    rightType === "numeric" ||
    leftType === "unknown" ||
    rightType === "unknown"
  ) {
    return "numeric";
  }
  return "unknown";
}

function isDefinitelyIntegerLike(type: ExprValueType) {
  return type === "int" || type === "numeric";
}

function collectExprRegisters(expr: Expr, acc: Set<string>) {
  const kind = getExprKind(expr);
  switch (kind) {
    case "reg":
      if (getRegisterName(expr).trim()) {
        acc.add(getRegisterName(expr));
      }
      return;
    case "not":
      collectExprRegisters(getNotOperand(expr)!, acc);
      return;
    case "and":
    case "or":
    case "xor":
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "rem":
    case "eq":
    case "lt": {
      const [left, right] = getBinaryOperands(expr)!;
      collectExprRegisters(left, acc);
      collectExprRegisters(right, acc);
      return;
    }
    default:
      return;
  }
}

function parseExprPath(path: string): string[] {
  return path
    .split(".")
    .filter((segment) => segment.length > 0 && segment !== "root");
}

function updateExprBySegments(root: Expr, segments: string[], updater: (expr: Expr) => Expr): Expr {
  const [head, ...tail] = segments;

  if (head === "expr") {
    const inner = getNotOperand(root);
    if (!inner) {
      return root;
    }
    return notExpr(tail.length === 0 ? updater(inner) : updateExprBySegments(inner, tail, updater));
  }

  if (head === "left" || head === "right") {
    const operands = getBinaryOperands(root);
    if (!operands) {
      return root;
    }
    const [left, right] = operands;
    return rebuildBinaryExpr(root, [
      head === "left"
        ? (tail.length === 0 ? updater(left) : updateExprBySegments(left, tail, updater))
        : left,
      head === "right"
        ? (tail.length === 0 ? updater(right) : updateExprBySegments(right, tail, updater))
        : right,
    ]);
  }

  return root;
}

function replaceRegisterRefs(expr: Expr, fromRegister: string, toRegister: string): Expr {
  const kind = getExprKind(expr);
  switch (kind) {
    case "reg":
      return getRegisterName(expr) === fromRegister ? registerExpr(toRegister) : expr;
    case "not":
      return notExpr(replaceRegisterRefs(getNotOperand(expr)!, fromRegister, toRegister));
    case "and":
    case "or":
    case "xor":
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "rem":
    case "eq":
    case "lt": {
      const [left, right] = getBinaryOperands(expr)!;
      return rebuildBinaryExpr(expr, [
        replaceRegisterRefs(left, fromRegister, toRegister),
        replaceRegisterRefs(right, fromRegister, toRegister),
      ]);
    }
    default:
      return expr;
  }
}

function rebuildBinaryExpr(template: Expr, operands: [Expr, Expr]): Expr {
  const kind = getExprKind(template);
  return binaryExpr(kind as BinaryExprKind, operands[0], operands[1]);
}

function wrapExpr(expr: Expr): string {
  return isLeafExpr(expr) ? describeExpr(expr) : `(${describeExpr(expr)})`;
}

function getRegisterName(expr: Expr): string {
  return "Reg" in expr ? expr.Reg : "";
}

function getNumberValue(expr: Expr): number {
  if (!("Val" in expr)) {
    return 0;
  }
  if ("Int" in expr.Val) {
    return expr.Val.Int;
  }
  if ("Float" in expr.Val) {
    return expr.Val.Float;
  }
  return 0;
}

function getBoolValue(expr: Expr): boolean {
  return "Val" in expr && "Bool" in expr.Val ? expr.Val.Bool : false;
}

function getBinaryExprKey(expr: Expr): string | null {
  for (const kind of BINARY_KINDS) {
    const key = BINARY_EXPR_KEYS[kind];
    if (key in expr) {
      return key;
    }
  }
  return null;
}
