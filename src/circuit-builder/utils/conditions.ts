import type { BinaryExpr, Expr } from "../types";

export type ExprValueType = "int" | "float" | "bool" | "numeric" | "unknown";
export type ComparisonBuilderOperator = "==" | "!=" | "<" | "<=" | ">" | ">=";

export function intExpr(value = 0): Expr {
  return { kind: "int", value };
}

export function floatExpr(value = 0): Expr {
  return { kind: "float", value };
}

export function boolExpr(value = false): Expr {
  return { kind: "bool", value };
}

export function registerExpr(name: string): Expr {
  return { kind: "reg", name };
}

export function notExpr(expr: Expr): Expr {
  return { kind: "not", expr };
}

export function binaryExpr(kind: BinaryExpr["kind"], left: Expr, right: Expr): Expr {
  return { kind, left, right };
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
  switch (expr.kind) {
    case "int":
    case "float":
      return String(expr.value);
    case "bool":
      return expr.value ? "true" : "false";
    case "reg":
      return expr.name;
    case "not":
      return `!${wrapExpr(expr.expr)}`;
    case "and":
      return `${wrapExpr(expr.left)} & ${wrapExpr(expr.right)}`;
    case "or":
      return `${wrapExpr(expr.left)} | ${wrapExpr(expr.right)}`;
    case "xor":
      return `${wrapExpr(expr.left)} ^ ${wrapExpr(expr.right)}`;
    case "add":
      return `${wrapExpr(expr.left)} + ${wrapExpr(expr.right)}`;
    case "sub":
      return `${wrapExpr(expr.left)} - ${wrapExpr(expr.right)}`;
    case "mul":
      return `${wrapExpr(expr.left)} * ${wrapExpr(expr.right)}`;
    case "div":
      return `${wrapExpr(expr.left)} / ${wrapExpr(expr.right)}`;
    case "rem":
      return `${wrapExpr(expr.left)} % ${wrapExpr(expr.right)}`;
    case "eq":
      return `${wrapExpr(expr.left)} == ${wrapExpr(expr.right)}`;
    case "lt":
      return `${wrapExpr(expr.left)} < ${wrapExpr(expr.right)}`;
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

export function defaultExprForKind(kind: Expr["kind"]): Expr {
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

export function replaceExprKind(expr: Expr, nextKind: Expr["kind"], fallbackRegister: string | null): Expr {
  const next = defaultExprForKind(nextKind);
  if (next.kind === "reg") {
    return registerExpr(fallbackRegister ?? "");
  }

  if (expr.kind === "not" && next.kind === "not") {
    return expr;
  }

  if ("left" in expr && "left" in next) {
    return {
      ...next,
      left: expr.left,
      right: expr.right,
    };
  }

  if (expr.kind === "not" && next.kind === "not") {
    return { kind: "not", expr: expr.expr };
  }

  return next;
}

export function getExprAtPath(root: Expr, path: string): Expr | null {
  const segments = parseExprPath(path);
  let current: Expr = root;

  for (const segment of segments) {
    if (segment === "expr" && current.kind === "not") {
      current = current.expr;
      continue;
    }

    if ((segment === "left" || segment === "right") && "left" in current) {
      current = current[segment];
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
  switch (expr.kind) {
    case "int":
      return "int";
    case "float":
      return "float";
    case "bool":
      return "bool";
    case "reg":
      return "unknown";
    case "not": {
      const innerType = inferExprType(expr.expr);
      if (innerType === "bool" || innerType === "int") {
        return innerType;
      }
      return "unknown";
    }
    case "and":
    case "or":
    case "xor": {
      const leftType = inferExprType(expr.left);
      const rightType = inferExprType(expr.right);
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
    case "rem":
      return inferNumericResultType(expr.left, expr.right);
    case "eq":
    case "lt":
      return "bool";
  }
}

function validateExpr(expr: Expr): string[] {
  const issues: string[] = [];

  switch (expr.kind) {
    case "reg":
      if (!expr.name.trim()) {
        issues.push("Register references must select a register.");
      }
      break;
    case "not": {
      const innerType = inferExprType(expr.expr);
      if (innerType !== "bool" && innerType !== "int" && innerType !== "unknown") {
        issues.push("NOT only supports boolean or integer expressions.");
      }
      issues.push(...validateExpr(expr.expr));
      break;
    }
    case "and":
    case "or":
    case "xor": {
      const leftType = inferExprType(expr.left);
      const rightType = inferExprType(expr.right);
      const validBitwiseOrBoolean =
        (leftType === "bool" && rightType === "bool") ||
        (leftType === "int" && rightType === "int") ||
        (leftType === "unknown" && (rightType === "bool" || rightType === "int" || rightType === "unknown")) ||
        (rightType === "unknown" && (leftType === "bool" || leftType === "int" || leftType === "unknown"));
      if (!validBitwiseOrBoolean) {
        issues.push(`${expr.kind.toUpperCase()} requires matching boolean or integer operands.`);
      }
      issues.push(...validateExpr(expr.left), ...validateExpr(expr.right));
      break;
    }
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "rem":
    case "lt": {
      const leftType = inferExprType(expr.left);
      const rightType = inferExprType(expr.right);
      if (leftType === "bool" || rightType === "bool") {
        issues.push(`${expr.kind.toUpperCase()} only supports numeric operands.`);
      }
      issues.push(...validateExpr(expr.left), ...validateExpr(expr.right));
      break;
    }
    case "eq":
      issues.push(...validateExpr(expr.left), ...validateExpr(expr.right));
      break;
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
  switch (expr.kind) {
    case "reg":
      if (expr.name.trim()) {
        acc.add(expr.name);
      }
      return;
    case "not":
      collectExprRegisters(expr.expr, acc);
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
    case "lt":
      collectExprRegisters(expr.left, acc);
      collectExprRegisters(expr.right, acc);
      return;
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

  if (head === "expr" && root.kind === "not") {
    return {
      kind: "not",
      expr: tail.length === 0 ? updater(root.expr) : updateExprBySegments(root.expr, tail, updater),
    };
  }

  if ((head === "left" || head === "right") && "left" in root) {
    return {
      kind: root.kind,
      left:
        head === "left"
          ? (tail.length === 0 ? updater(root.left) : updateExprBySegments(root.left, tail, updater))
          : root.left,
      right:
        head === "right"
          ? (tail.length === 0 ? updater(root.right) : updateExprBySegments(root.right, tail, updater))
          : root.right,
    };
  }

  return root;
}

function replaceRegisterRefs(expr: Expr, fromRegister: string, toRegister: string): Expr {
  switch (expr.kind) {
    case "reg":
      return expr.name === fromRegister ? registerExpr(toRegister) : expr;
    case "not":
      return { kind: "not", expr: replaceRegisterRefs(expr.expr, fromRegister, toRegister) };
    case "and":
    case "or":
    case "xor":
    case "add":
    case "sub":
    case "mul":
    case "div":
    case "rem":
    case "eq":
    case "lt":
      return {
        kind: expr.kind,
        left: replaceRegisterRefs(expr.left, fromRegister, toRegister),
        right: replaceRegisterRefs(expr.right, fromRegister, toRegister),
      };
    default:
      return expr;
  }
}

function wrapExpr(expr: Expr): string {
  if (expr.kind === "int" || expr.kind === "float" || expr.kind === "bool" || expr.kind === "reg") {
    return describeExpr(expr);
  }
  return `(${describeExpr(expr)})`;
}
