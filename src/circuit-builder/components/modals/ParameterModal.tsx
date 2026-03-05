import { useEffect, useState } from "react";

import { GATE_DEFS, UI_COLORS } from "../../constants";
import type { GateElement, ParameterModalState } from "../../types";
import { ModalFrame } from "./ModalFrame";

interface ParameterModalProps {
  modal: ParameterModalState | null;
  element: GateElement | null;
  onCancel: () => void;
  onChange: (value: number) => void;
  onApply: () => void;
}

export function ParameterModal({ modal, element, onCancel, onChange, onApply }: ParameterModalProps) {
  const [localValue, setLocalValue] = useState(modal?.val ?? 0);

  useEffect(() => {
    setLocalValue(modal?.val ?? 0);
  }, [modal]);

  if (!modal || !element) {
    return null;
  }

  const def = GATE_DEFS[element.gateType];
  const presets = [
    ["π/8", Math.PI / 8],
    ["π/4", Math.PI / 4],
    ["π/2", Math.PI / 2],
    ["π", Math.PI],
    ["3π/2", (3 * Math.PI) / 2],
    ["2π", Math.PI * 2],
  ] as const;

  return (
    <ModalFrame width={340}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{def.desc} — θ</div>
      <div style={{ fontSize: 12, color: UI_COLORS.slate500, marginBottom: 14 }}>Angle in radians</div>
      <input
        type="number"
        step={0.001}
        value={localValue}
        autoFocus
        onChange={(event) => {
          const next = Number.parseFloat(event.target.value) || 0;
          setLocalValue(next);
          onChange(next);
        }}
        style={{
          width: "100%",
          padding: "7px 9px",
          border: `1px solid ${UI_COLORS.borderMid}`,
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 13,
          boxSizing: "border-box",
          marginBottom: 8,
        }}
      />
      <div style={{ fontSize: 11, color: UI_COLORS.slate400, marginBottom: 12 }}>
        = {(localValue / Math.PI).toFixed(5)} π ≈ {((localValue * 180) / Math.PI).toFixed(3)}°
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
        {presets.map(([label, value]) => (
          <button
            key={label}
            onClick={() => {
              setLocalValue(value);
              onChange(value);
            }}
            style={{
              padding: "3px 8px",
              fontSize: 11,
              fontFamily: "monospace",
              border: `1px solid ${UI_COLORS.borderMid}`,
              borderRadius: 3,
              cursor: "pointer",
              background: Math.abs(localValue - value) < 1e-9 ? UI_COLORS.blue600 : UI_COLORS.white,
              color: Math.abs(localValue - value) < 1e-9 ? UI_COLORS.white : "#374151",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
        <button onClick={onApply} style={primaryButtonStyle(UI_COLORS.blue600)}>
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

const primaryButtonStyle = (background: string): React.CSSProperties => ({
  padding: "6px 16px",
  border: "none",
  borderRadius: 4,
  background,
  color: UI_COLORS.white,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
});
