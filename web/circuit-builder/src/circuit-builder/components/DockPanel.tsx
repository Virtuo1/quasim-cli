import { useState } from "react";

import { CLASSICAL_OP_DEFS, UI_COLORS, UNITARY_OP_DEFS } from "../constants";
import type { CanvasElement } from "../types";
import { describeExpr } from "../utils/conditions";
import { fmt } from "../utils/layout";

interface DockPanelProps {
  nQ: number;
  nS: number;
  classicalRegisterCount: number;
  customGateCount: number;
  selectedElement: CanvasElement | null;
  selectedCount: number;
  errorSteps: number;
}

export function DockPanel({
  nQ,
  nS,
  classicalRegisterCount,
  customGateCount,
  selectedElement,
  selectedCount,
  errorSteps,
}: DockPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: `1px solid ${UI_COLORS.borderLight}`,
        background: UI_COLORS.white,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          background: UI_COLORS.panelBg,
          borderBottom: collapsed ? "none" : `1px solid ${UI_COLORS.borderLight}`,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: UI_COLORS.slate900 }}>Dock</div>
          <div style={{ fontSize: 11, color: UI_COLORS.slate500 }}>
            {collapsed ? "Collapsed bottom panel" : "Workspace summary and selection details"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: `1px solid ${UI_COLORS.borderMid}`,
            background: UI_COLORS.white,
            color: UI_COLORS.slate800,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {collapsed ? "Expand dock" : "Minimize dock"}
        </button>
      </div>

      {!collapsed ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            padding: 14,
          }}
        >
          <DockMetric label="Qubits" value={String(nQ)} />
          <DockMetric label="Columns" value={String(nS)} />
          <DockMetric label="Registers" value={String(classicalRegisterCount)} />
          <DockMetric label="Custom Gates" value={String(customGateCount)} />
          <DockMetric label="Errors" value={errorSteps === 0 ? "None" : `${errorSteps} column${errorSteps === 1 ? "" : "s"}`} />
          <DockMetric label="Selection" value={selectionSummary(selectedElement, selectedCount)} wide />
        </div>
      ) : null}
    </div>
  );
}

function DockMetric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${UI_COLORS.borderLight}`,
        background: UI_COLORS.white,
        minHeight: 72,
        gridColumn: wide ? "1 / -1" : undefined,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: UI_COLORS.slate400, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: UI_COLORS.slate800 }}>{value}</div>
    </div>
  );
}

function selectionSummary(selectedElement: CanvasElement | null, selectedCount: number) {
  if (selectedCount > 1) {
    return `${selectedCount} elements selected`;
  }

  if (!selectedElement) {
    return "Nothing selected";
  }

  if (selectedElement.type === "cctrl") {
    return `Condition on ${selectedElement.condition ? describeExpr(selectedElement.condition) : "register"} at col ${selectedElement.step}`;
  }

  const location = selectedElement.type === "jump" ? `col ${selectedElement.step}` : `q${selectedElement.qubit} at col ${selectedElement.step}`;

  switch (selectedElement.type) {
    case "ctrl":
      return `Control on ${location}`;
    case "swap":
      return `Swap node on ${location}`;
    case "custom":
      return `Custom gate ${selectedElement.classifier} on ${location}`;
    case "measurement":
      return `Measurement on ${location}${selectedElement.registerName ? ` -> ${selectedElement.registerName}[${selectedElement.bitIndex ?? "?"}]` : ""}`;
    case "assign":
      return `Assign on ${location}${selectedElement.registerName ? ` -> ${selectedElement.registerName}` : ""} = ${describeExpr(selectedElement.expr)}`;
    case "reset":
      return `${CLASSICAL_OP_DEFS.reset.description} on ${location}`;
    case "jump":
      return `Jump at ${location}${selectedElement.targetStep != null ? ` -> col ${selectedElement.targetStep}` : ""}`;
    case "unitary": {
      const params =
        selectedElement.params && selectedElement.params.length > 0
          ? ` (${selectedElement.params.map((value) => fmt(value)).join(", ")})`
          : "";
      return `${UNITARY_OP_DEFS[selectedElement.kind].description}${params} on ${location}`;
    }
  }
}
