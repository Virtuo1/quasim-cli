import type { ReactNode } from "react";
import { UI_COLORS } from "../constants";

interface HeaderButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
}

export function HeaderButton({ children, onClick, disabled, accent, danger }: HeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 12,
        borderRadius: 3,
        fontFamily: "inherit",
        background: accent ? UI_COLORS.blue700 : danger ? "#7f1d1d" : UI_COLORS.slate800,
        color: disabled ? UI_COLORS.slate500 : UI_COLORS.white,
        border: `1px solid ${accent ? "#2563eb" : danger ? "#991b1b" : UI_COLORS.slate700}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function HeaderSeparator() {
  return <div style={{ width: 1, height: 18, background: UI_COLORS.slate700, flexShrink: 0 }} />;
}
