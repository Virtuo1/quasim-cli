import type { ClassicalCondition, ConditionOperator } from "../types";

export function createComparisonCondition(
  registerName: string,
  operator: ConditionOperator = "==",
  value = 0,
): ClassicalCondition {
  return {
    kind: "comparison",
    registerName,
    operator,
    value,
  };
}

export function describeCondition(condition: ClassicalCondition) {
  return `${condition.registerName} ${condition.operator} ${condition.value}`;
}

export function rebindConditionRegister(
  condition: ClassicalCondition,
  registerName: string,
): ClassicalCondition {
  return {
    ...condition,
    registerName,
  };
}

export function updateComparisonCondition(
  condition: ClassicalCondition,
  operator: ConditionOperator,
  value: number,
): ClassicalCondition {
  return {
    ...condition,
    operator,
    value,
  };
}
