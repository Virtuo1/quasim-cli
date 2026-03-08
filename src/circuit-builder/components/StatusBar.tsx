import { ERROR_COLORS, CLASSICAL_OP_DEFS, UI_COLORS, UNITARY_OP_DEFS } from "../constants";
import type { CircuitElement, DropPreview } from "../types";
import { describeExpr } from "../utils/conditions";
import { fmt } from "../utils/layout";

interface StatusBarProps {
  selectedElement: CircuitElement | null;
  selectedCount: number;
  dropPreview: DropPreview | null;
  errorSteps: number;
}

export function StatusBar({ selectedElement, selectedCount, dropPreview, errorSteps }: StatusBarProps) {
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
    </div>
  );
}

function selectedMessage(element: CircuitElement) {
  if (element.type === "cctrl") {
    return `Classical condition · ${describeExpr(element.condition)} · col ${element.step}`;
  }

  const label =
    element.type === "ctrl"
      ? "Control"
      : element.type === "swap"
        ? "SWAP"
        : element.type === "custom"
          ? `Custom gate ${element.classifier}`
          : element.type === "jump"
            ? CLASSICAL_OP_DEFS.jump.description
          : element.type === "measurement"
            ? CLASSICAL_OP_DEFS.measurement.description
            : element.type === "reset"
              ? CLASSICAL_OP_DEFS.reset.description
              : UNITARY_OP_DEFS[element.kind].description;
  const angle =
    element.type === "unitary" && element.params && element.params.length > 0
      ? ` · params=${element.params.map((value) => fmt(value)).join(", ")}`
      : "";
  const measurement =
    element.type === "measurement"
      ? ` · ${element.registerName ? `→ ${element.registerName}` : "⚠ no reg"}`
      : "";
  const jump = element.type === "jump" ? ` · → col ${element.targetStep ?? "?"}` : "";
  const location = element.type === "jump" ? `col ${element.step}` : `qubit ${element.qubit} · col ${element.step}`;
  return `${label} · ${location}${angle}${measurement}${jump}`;
}

function dropMessage(dropPreview: DropPreview) {
  if (dropPreview.zone === "creg") {
    return `${dropPreview.valid ? "✓ Classical condition on" : "✗ Already has condition on"} ${dropPreview.cregName} · col ${dropPreview.step}`;
  }
  return `${dropPreview.valid ? "✓ Valid drop" : "✗ Cell occupied"} — col ${dropPreview.step}, qubit ${dropPreview.qubit}`;
}
