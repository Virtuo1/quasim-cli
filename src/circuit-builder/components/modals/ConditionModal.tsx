import { useEffect, useState } from "react";

import { UI_COLORS } from "../../constants";
import type { ClassicalControlElement, ConditionModalState, ConditionOperator } from "../../types";
import { ModalFrame } from "./ModalFrame";

interface ConditionModalProps {
  modal: ConditionModalState | null;
  element: ClassicalControlElement | null;
  operators: readonly ConditionOperator[];
  onCancel: () => void;
  onApply: (op: ConditionOperator, val: number) => void;
}

export function ConditionModal({ modal, element, operators, onCancel, onApply }: ConditionModalProps) {
  const [op, setOp] = useState<ConditionOperator>("==");
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!modal || !element) {
      setOp("==");
      setVal(0);
      return;
    }
    setOp(element.condition.operator);
    setVal(element.condition.value);
  }, [element, modal]);

  if (!modal || !element) {
    return null;
  }

  return (
    <ModalFrame width={340}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Classical Condition</div>
      <div style={{ fontSize: 12, color: UI_COLORS.slate500, marginBottom: 16 }}>
        Register{" "}
        <code
          style={{
            background: UI_COLORS.appBg,
            padding: "1px 5px",
            borderRadius: 3,
            fontFamily: "monospace",
          }}
        >
          {element.condition.registerName}
        </code>{" "}
        · step {element.step}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        Condition:{" "}
        <code style={{ fontFamily: "monospace", color: "#7c3aed" }}>
          {element.condition.registerName} {op} {val}
        </code>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: "0 0 auto" }}>
          <div style={{ fontSize: 10, color: UI_COLORS.slate500, marginBottom: 4 }}>Operator</div>
          <select
            value={op}
            onChange={(event) => setOp(event.target.value as ConditionOperator)}
            style={{
              padding: "6px 8px",
              border: `1px solid ${UI_COLORS.borderMid}`,
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: 13,
              background: UI_COLORS.white,
            }}
          >
            {operators.map((operator) => (
              <option key={operator} value={operator}>
                {operator}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: UI_COLORS.slate500, marginBottom: 4 }}>Integer value</div>
          <input
            type="number"
            step={1}
            value={val}
            onChange={(event) => setVal(Number.parseInt(event.target.value, 10) || 0)}
            style={{
              width: "100%",
              padding: "6px 9px",
              border: `1px solid ${UI_COLORS.borderMid}`,
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
        <button onClick={() => onApply(op, val)} style={primaryButtonStyle}>
          Apply
        </button>
      </div>
    </ModalFrame>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: "6px 16px",
  border: `1px solid ${UI_COLORS.borderMid}`,
  borderRadius: 4,
  background: UI_COLORS.white,
  cursor: "pointer",
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "6px 16px",
  border: "none",
  borderRadius: 4,
  background: UI_COLORS.slate900,
  color: UI_COLORS.white,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
