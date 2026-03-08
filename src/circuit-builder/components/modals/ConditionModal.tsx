import type { ClassicalControlElement, ClassicalRegister, ConditionModalState, Expr } from "../../types";
import { describeExpr, exprRegisters, validateConditionExpression } from "../../utils/conditions";
import { ExpressionEditorModal } from "./ExpressionEditorModal";

interface ConditionModalProps {
  modal: ConditionModalState | null;
  element: ClassicalControlElement | null;
  classicalRegs: ClassicalRegister[];
  onCancel: () => void;
  onApply: (condition: Expr) => void;
}

export function ConditionModal({
  modal,
  element,
  classicalRegs,
  onCancel,
  onApply,
}: ConditionModalProps) {
  const expr = element?.condition ?? null;
  return (
    <ExpressionEditorModal
      isOpen={!!modal && !!element}
      expr={expr}
      classicalRegs={classicalRegs}
      summaryItems={(currentExpr) => {
        const referencedRegisters = exprRegisters(currentExpr);
        return [
          { title: "Expression", value: describeExpr(currentExpr), mono: true },
          {
            title: "Referenced Registers",
            value: referencedRegisters.length > 0 ? referencedRegisters.join(", ") : "None",
          },
        ];
      }}
      validateExpr={validateConditionExpression}
      onCancel={onCancel}
      onApply={onApply}
    />
  );
}
