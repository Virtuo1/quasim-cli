import { UI_COLORS } from "../../constants";
import type { JumpElement, JumpModalState } from "../../types";

interface JumpModalProps {
  modal: JumpModalState | null;
  element: JumpElement | null;
  hoveredStep: number | null;
  onCancel: () => void;
}

export function JumpModal({ modal, element, hoveredStep, onCancel }: JumpModalProps) {
  if (!modal || !element) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 300,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 18,
          bottom: 18,
          background: UI_COLORS.white,
          border: `1px solid ${UI_COLORS.borderLight}`,
          borderRadius: 6,
          boxShadow: "0 18px 45px rgba(0,0,0,.22)",
          padding: "14px 16px",
          minWidth: 320,
          pointerEvents: "auto",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Select Jump Target</div>
        <div style={{ fontSize: 12, color: UI_COLORS.slate500, marginBottom: 10 }}>
          Click the destination column on the circuit. The source column is disabled, and hovering highlights valid targets.
        </div>
        <div style={{ fontSize: 11, color: UI_COLORS.slate700, marginBottom: 12 }}>
          Source: <b>col {element.step}</b>
          {" · "}
          Target: <b>{hoveredStep ?? element.targetStep ?? "?"}</b>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={secondaryButtonStyle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
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
