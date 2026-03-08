import { useEffect, useState } from "react";

import { UI_COLORS } from "../../constants";
import type { AssignElement, AssignModalState, ClassicalRegister, Expr } from "../../types";
import { describeExpr, validateExpression } from "../../utils/conditions";
import { ExpressionEditorModal } from "./ExpressionEditorModal";

interface AssignModalProps {
  modal: AssignModalState | null;
  element: AssignElement | null;
  classicalRegs: ClassicalRegister[];
  onCancel: () => void;
  onApply: (registerName: string | null, expr: Expr) => void;
}

export function AssignModal({
  modal,
  element,
  classicalRegs,
  onCancel,
  onApply,
}: AssignModalProps) {
  const [selectedReg, setSelectedReg] = useState("");

  useEffect(() => {
    if (!modal || !element) {
      return;
    }

    setSelectedReg(element.registerName ?? classicalRegs[0]?.name ?? "");
  }, [classicalRegs, element, modal]);

  const expr = element?.expr ?? null;

  return (
    <ExpressionEditorModal
      isOpen={!!modal && !!element}
      expr={expr}
      classicalRegs={classicalRegs}
      summaryItems={(currentExpr) => [
        { title: "Assigned Expression", value: (selectedReg || "Unassigned") + " = " + describeExpr(currentExpr) },
      ]}
      validateExpr={validateExpression}
      applyDisabled={!selectedReg}
      onCancel={onCancel}
      onApply={(nextExpr) => onApply(selectedReg || null, nextExpr)}
      renderInspectorExtras={() => (
        <div style={fieldBlockStyle}>
          <div style={fieldLabelStyle}>Target register</div>
          {classicalRegs.length > 0 ? (
            <select value={selectedReg} onChange={(event) => setSelectedReg(event.target.value)} style={controlStyle}>
              <option value="">Select register</option>
              {classicalRegs.map((register) => (
                <option key={register.id} value={register.name}>
                  {register.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={warningStyle}>Create a classical register in the palette first.</div>
          )}
        </div>
      )}
    />
  );
}

const fieldBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: UI_COLORS.slate500,
  letterSpacing: 0.2,
};

const controlStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  border: `1px solid ${UI_COLORS.borderMid}`,
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: 12,
  background: UI_COLORS.white,
  boxSizing: "border-box",
};

const warningStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: UI_COLORS.yellow50,
  border: `1px solid ${UI_COLORS.yellow200}`,
  color: UI_COLORS.yellow800,
  fontSize: 11,
  borderRadius: 4,
};
