import { CONNECTOR_BLACK, CLASSICAL_OP_DEFS, UNITARY_OP_DEFS } from "../constants";
import type { CustomGateDefinition } from "../types";
import type { DragGhostState } from "../types";

interface DragGhostProps {
  ghost: DragGhostState | null;
  customGateDefinitions?: CustomGateDefinition[];
}

export function DragGhost({ ghost, customGateDefinitions = [] }: DragGhostProps) {
  if (!ghost) {
    return null;
  }

  const label =
    ghost.type === "ctrl"
      ? "●"
      : ghost.type === "swap"
        ? "×"
        : ghost.type === "custom"
          ? customGateDefinitions.find((definition) => definition.classifier === ghost.classifier)?.classifier ?? ghost.classifier
          : ghost.type === "measurement"
            ? CLASSICAL_OP_DEFS.measurement.label
            : ghost.type === "assign"
              ? CLASSICAL_OP_DEFS.assign.label
            : ghost.type === "reset"
              ? CLASSICAL_OP_DEFS.reset.label
              : ghost.type === "jump"
                ? CLASSICAL_OP_DEFS.jump.label
              : UNITARY_OP_DEFS[ghost.kind].label;
  const color =
    ghost.type === "ctrl"
      ? CONNECTOR_BLACK
      : ghost.type === "swap"
        ? CONNECTOR_BLACK
        : ghost.type === "custom"
          ? CONNECTOR_BLACK
          : ghost.type === "measurement"
            ? CLASSICAL_OP_DEFS.measurement.color
            : ghost.type === "assign"
              ? CLASSICAL_OP_DEFS.assign.color
            : ghost.type === "reset"
              ? CLASSICAL_OP_DEFS.reset.color
              : ghost.type === "jump"
                ? CLASSICAL_OP_DEFS.jump.color
              : UNITARY_OP_DEFS[ghost.kind].color;
  const jumpGhost = ghost.type === "jump";

  return (
    <div
      style={{
        position: "fixed",
        left: ghost.x,
        top: ghost.y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9999,
        background: jumpGhost ? "#fff" : color,
        color: jumpGhost ? CONNECTOR_BLACK : "#fff",
        border: jumpGhost ? `2px solid ${CONNECTOR_BLACK}` : "none",
        padding: "4px 11px",
        borderRadius: 3,
        fontFamily: "monospace",
        fontWeight: 700,
        fontSize: 13,
        opacity: 0.9,
        boxShadow: "0 4px 14px rgba(0,0,0,.3)",
      }}
    >
      {label}
    </div>
  );
}
