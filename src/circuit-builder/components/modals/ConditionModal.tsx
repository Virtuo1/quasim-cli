import { useEffect, useState } from "react";

import { UI_COLORS } from "../../constants";
import type { ClassicalControlElement, ClassicalRegister, ConditionModalState, Expr } from "../../types";
import { describeExpr, replaceExprKind, validateConditionExpression } from "../../utils/conditions";
import { ModalFrame } from "./ModalFrame";

interface ConditionModalProps {
  modal: ConditionModalState | null;
  element: ClassicalControlElement | null;
  classicalRegs: ClassicalRegister[];
  onCancel: () => void;
  onApply: (condition: Expr) => void;
}

const EXPR_KIND_OPTIONS: Array<{ value: Expr["kind"]; label: string }> = [
  { value: "reg", label: "register" },
  { value: "int", label: "int" },
  { value: "float", label: "float" },
  { value: "bool", label: "bool" },
  { value: "not", label: "not" },
  { value: "and", label: "and" },
  { value: "or", label: "or" },
  { value: "xor", label: "xor" },
  { value: "add", label: "add" },
  { value: "sub", label: "sub" },
  { value: "mul", label: "mul" },
  { value: "div", label: "div" },
  { value: "rem", label: "rem" },
  { value: "eq", label: "eq" },
  { value: "lt", label: "lt" },
];

export function ConditionModal({
  modal,
  element,
  classicalRegs,
  onCancel,
  onApply,
}: ConditionModalProps) {
  const [localExpr, setLocalExpr] = useState<Expr | null>(element?.condition ?? null);

  useEffect(() => {
    setLocalExpr(element?.condition ?? null);
  }, [element, modal]);

  if (!modal || !element || !localExpr) {
    return null;
  }

  const issues = validateConditionExpression(localExpr);
  const fallbackRegister = classicalRegs[0]?.name ?? null;

  return (
    <ModalFrame width={620}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Classical Condition</div>
      <div style={{ fontSize: 12, color: UI_COLORS.slate500, marginBottom: 12 }}>
        Anchor lane {classicalRegs[element.cregIdx]?.name ?? `c${element.cregIdx}`} · step {element.step}
      </div>
      <div
        style={{
          padding: "8px 10px",
          marginBottom: 12,
          background: UI_COLORS.panelBg,
          border: `1px solid ${UI_COLORS.borderLight}`,
          fontSize: 12,
          fontFamily: "monospace",
          color: UI_COLORS.slate700,
        }}
      >
        {describeExpr(localExpr)}
      </div>
      {issues.length > 0 ? (
        <div
          style={{
            padding: "8px 10px",
            marginBottom: 12,
            background: UI_COLORS.rose50,
            border: `1px solid ${UI_COLORS.red100}`,
            color: UI_COLORS.red600,
            fontSize: 12,
          }}
        >
          {issues.join(" ")}
        </div>
      ) : null}
      <ExprEditor
        expr={localExpr}
        classicalRegs={classicalRegs}
        fallbackRegister={fallbackRegister}
        onChange={setLocalExpr}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
        <button
          onClick={() => onApply(localExpr)}
          disabled={issues.length > 0}
          style={{ ...primaryButtonStyle, opacity: issues.length > 0 ? 0.5 : 1 }}
        >
          Apply
        </button>
      </div>
    </ModalFrame>
  );
}

function ExprEditor({
  expr,
  classicalRegs,
  fallbackRegister,
  onChange,
}: {
  expr: Expr;
  classicalRegs: ClassicalRegister[];
  fallbackRegister: string | null;
  onChange: (expr: Expr) => void;
}) {
  return (
    <div
      style={{
        border: `1px solid ${UI_COLORS.borderMid}`,
        padding: 10,
        background: UI_COLORS.white,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: UI_COLORS.slate600 }}>Node</span>
        <select
          value={expr.kind}
          onChange={(event) => onChange(replaceExprKind(expr, event.target.value as Expr["kind"], fallbackRegister))}
          style={selectStyle}
        >
          {EXPR_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {expr.kind === "reg" ? (
        <select
          value={expr.name}
          onChange={(event) => onChange({ kind: "reg", name: event.target.value })}
          style={selectStyle}
        >
          <option value="">Select register</option>
          {classicalRegs.map((register) => (
            <option key={register.id} value={register.name}>
              {register.name}
            </option>
          ))}
        </select>
      ) : null}

      {expr.kind === "int" || expr.kind === "float" ? (
        <input
          type="number"
          step={expr.kind === "float" ? 0.001 : 1}
          value={expr.value}
          onChange={(event) =>
            onChange({
              kind: expr.kind,
              value:
                expr.kind === "float"
                  ? Number.parseFloat(event.target.value) || 0
                  : Number.parseInt(event.target.value, 10) || 0,
            })
          }
          style={inputStyle}
        />
      ) : null}

      {expr.kind === "bool" ? (
        <select
          value={expr.value ? "true" : "false"}
          onChange={(event) => onChange({ kind: "bool", value: event.target.value === "true" })}
          style={selectStyle}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : null}

      {expr.kind === "not" ? (
        <div style={childSectionStyle}>
          <div style={childLabelStyle}>Operand</div>
          <ExprEditor
            expr={expr.expr}
            classicalRegs={classicalRegs}
            fallbackRegister={fallbackRegister}
            onChange={(next) => onChange({ kind: "not", expr: next })}
          />
        </div>
      ) : null}

      {"left" in expr ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={childSectionStyle}>
            <div style={childLabelStyle}>Left</div>
            <ExprEditor
              expr={expr.left}
              classicalRegs={classicalRegs}
              fallbackRegister={fallbackRegister}
              onChange={(next) => onChange({ ...expr, left: next })}
            />
          </div>
          <div style={childSectionStyle}>
            <div style={childLabelStyle}>Right</div>
            <ExprEditor
              expr={expr.right}
              classicalRegs={classicalRegs}
              fallbackRegister={fallbackRegister}
              onChange={(next) => onChange({ ...expr, right: next })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: `1px solid ${UI_COLORS.borderMid}`,
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: 12,
  background: UI_COLORS.white,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: `1px solid ${UI_COLORS.borderMid}`,
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: 12,
  boxSizing: "border-box",
};

const childSectionStyle: React.CSSProperties = {
  marginTop: 8,
};

const childLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: UI_COLORS.slate500,
  marginBottom: 6,
};

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
