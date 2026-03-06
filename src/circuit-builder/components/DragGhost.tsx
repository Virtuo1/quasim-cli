import { CONNECTOR_BLACK, GATE_DEFS } from "../constants";
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
          ? customGateDefinitions.find((definition) => definition.classifier === ghost.classifier)?.label ?? ghost.classifier
          : GATE_DEFS[ghost.gateType].l;
  const color =
    ghost.type === "ctrl"
      ? CONNECTOR_BLACK
      : ghost.type === "swap"
        ? CONNECTOR_BLACK
        : ghost.type === "custom"
          ? CONNECTOR_BLACK
          : GATE_DEFS[ghost.gateType].c;

  return (
    <div
      style={{
        position: "fixed",
        left: ghost.x,
        top: ghost.y,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 9999,
        background: color,
        color: "#fff",
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
