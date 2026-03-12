import type { ReactNode } from "react";
import { UI_COLORS } from "../constants";
import { buttonStyle } from "../ui/styles";

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
        ...buttonStyle({
          tone: danger ? "danger" : accent ? "primary" : "neutral",
          variant: accent || danger ? "soft" : "outline",
          disabled,
        }),
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

export function HeaderSeparator() {
  return <div style={{ width: 1, height: 18, background: UI_COLORS.borderLight, flexShrink: 0 }} />;
}
