import { UI_COLORS } from "../../constants";
import { panelCardStyle } from "../../ui/styles";
import type { JumpElement, JumpModalState } from "../../types";
import { modalSecondaryButtonStyle, modalSubtitleStyle, modalTitleStyle } from "./modalStyles";

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
          ...panelCardStyle(),
          boxShadow: "0 18px 45px rgba(0,0,0,.22)",
          padding: "14px 16px",
          minWidth: 320,
          pointerEvents: "auto",
        }}
      >
        <div style={modalTitleStyle}>Select Jump Target</div>
        <div style={{ ...modalSubtitleStyle, marginBottom: 10 }}>
          Click the destination column on the circuit. The source column is disabled, and hovering highlights valid targets.
        </div>
        <div style={{ fontSize: 11, color: UI_COLORS.slate700, marginBottom: 12 }}>
          Source: <b>col {element.step}</b>
          {" · "}
          Target: <b>{hoveredStep ?? element.targetStep ?? "?"}</b>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={modalSecondaryButtonStyle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
