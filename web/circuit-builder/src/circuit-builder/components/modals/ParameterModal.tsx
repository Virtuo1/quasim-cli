import { useEffect, useState } from "react";

import { UI_COLORS, UNITARY_OP_DEFS, unitaryGateExpectedParameters } from "../../constants";
import { buttonStyle } from "../../ui/styles";
import type { ParameterModalState, UnitaryGateElement } from "../../types";
import { ModalFrame } from "./ModalFrame";
import {
  modalActionsStyle,
  modalFieldLabelStyle,
  modalInputStyle,
  modalPrimaryButtonStyle,
  modalSecondaryButtonStyle,
  modalSubtitleStyle,
  modalTitleStyle,
} from "./modalStyles";

interface ParameterModalProps {
  modal: ParameterModalState | null;
  element: UnitaryGateElement | null;
  onCancel: () => void;
  onChange: (values: number[]) => void;
  onApply: () => void;
}

export function ParameterModal({ modal, element, onCancel, onChange, onApply }: ParameterModalProps) {
  const [localValues, setLocalValues] = useState(modal?.values ?? []);

  useEffect(() => {
    setLocalValues(modal?.values ?? []);
  }, [modal]);

  if (!modal || !element) {
    return null;
  }

  const def = UNITARY_OP_DEFS[element.kind];
  const parameterLabels = unitaryGateExpectedParameters(element.kind) ?? ["value"];
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
      <div style={modalTitleStyle}>{def.description}</div>
      <div style={{ ...modalSubtitleStyle, marginBottom: 14 }}>Angle in radians</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {parameterLabels.map((parameterLabel, index) => {
          const localValue = localValues[index] ?? 0;
          return (
            <div key={parameterLabel}>
              <div style={modalFieldLabelStyle}>{parameterLabel}</div>
              <input
                type="number"
                step={0.001}
                value={localValue}
                autoFocus={index === 0}
                onChange={(event) => {
                  const next = Number.parseFloat(event.target.value) || 0;
                  const nextValues = parameterLabels.map((_, parameterIndex) =>
                    parameterIndex === index ? next : (localValues[parameterIndex] ?? 0),
                  );
                  setLocalValues(nextValues);
                  onChange(nextValues);
                }}
                style={{
                  ...modalInputStyle,
                  fontSize: 13,
                  marginBottom: 6,
                }}
              />
              <div style={{ fontSize: 11, color: UI_COLORS.slate400 }}>
                = {(localValue / Math.PI).toFixed(5)} π ≈ {((localValue * 180) / Math.PI).toFixed(3)}°
              </div>
            </div>
          );
        })}
      </div>
      {parameterLabels.length === 1 ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
          {presets.map(([label, value]) => (
            <button
              key={label}
              onClick={() => {
                setLocalValues([value]);
                onChange([value]);
              }}
              style={{
                ...buttonStyle({ variant: "soft" }),
                padding: "3px 8px",
                fontSize: 11,
                fontFamily: "monospace",
                background: Math.abs((localValues[0] ?? 0) - value) < 1e-9 ? UI_COLORS.blue600 : UI_COLORS.white,
                color: Math.abs((localValues[0] ?? 0) - value) < 1e-9 ? UI_COLORS.white : "#374151",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <div style={modalActionsStyle}>
        <button onClick={onCancel} style={modalSecondaryButtonStyle}>
          Cancel
        </button>
        <button onClick={onApply} style={modalPrimaryButtonStyle}>
          Apply
        </button>
      </div>
    </ModalFrame>
  );
}
