import { ERROR_COLORS, GATE_DEFS, UI_COLORS } from "../constants";
import type { CircuitElement, DropPreview } from "../types";
import { fmt } from "../utils/layout";

interface StatusBarProps {
  nQ: number;
  nS: number;
  elementCount: number;
  selectedElement: CircuitElement | null;
  selectedCount: number;
  dropPreview: DropPreview | null;
  errorSteps: number;
}

export function StatusBar({ nQ, nS, elementCount, selectedElement, selectedCount, dropPreview, errorSteps }: StatusBarProps) {
  return (
    <div
      style={{
        background: UI_COLORS.slate800,
        color: UI_COLORS.slate400,
        padding: "5px 14px",
        fontSize: 11,
        display: "flex",
        alignItems: "center",
        gap: 16,
        borderTop: `1px solid ${UI_COLORS.slate700}`,
        flexShrink: 0,
        minHeight: 26,
      }}
    >
      <span
        style={{
          color: selectedElement
            ? UI_COLORS.yellow400
            : selectedCount > 1
              ? UI_COLORS.yellow400
            : dropPreview
              ? dropPreview.valid
                ? UI_COLORS.green300
                : ERROR_COLORS.muted
              : UI_COLORS.slate400,
        }}
      >
        {selectedElement
          ? selectedMessage(selectedElement)
          : selectedCount > 1
            ? `${selectedCount} elements selected`
            : dropPreview
              ? dropMessage(dropPreview)
              : "Drag a gate or connector from the palette"}
      </span>
      {errorSteps > 0 ? (
        <span style={{ color: ERROR_COLORS.muted }}>⚠ {errorSteps} col{errorSteps !== 1 ? "s" : ""} with errors</span>
      ) : null}
      <div style={{ flex: 1 }} />
      <span style={{ color: UI_COLORS.slate600 }}>
        {nQ} qubits · {nS} cols · {elementCount} elements
      </span>
    </div>
  );
}

function selectedMessage(element: CircuitElement) {
  if (element.type === "cctrl") {
    return `Classical condition · ${element.cregName} ${element.op} ${element.val} · col ${element.step}`;
  }

  const label =
    element.type === "ctrl" ? "Control" : element.type === "swap" ? "SWAP" : GATE_DEFS[element.gateType].desc;
  const angle = element.type === "gate" && element.param != null ? ` · θ=${fmt(element.param)}` : "";
  const measurement =
    element.type === "gate" && element.gateType === "M"
      ? ` · ${element.creg ? `→ ${element.creg}` : "⚠ no reg"}`
      : "";
  return `${label} · qubit ${element.qubit} · col ${element.step}${angle}${measurement}`;
}

function dropMessage(dropPreview: DropPreview) {
  if (dropPreview.zone === "creg") {
    return `${dropPreview.valid ? "✓ Classical condition on" : "✗ Already has condition on"} ${dropPreview.cregName} · col ${dropPreview.step}`;
  }
  return `${dropPreview.valid ? "✓ Valid drop" : "✗ Cell occupied"} — col ${dropPreview.step}, qubit ${dropPreview.qubit}`;
}
