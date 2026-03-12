import type { CSSProperties } from "react";

import { UI_COLORS } from "../constants";

type ButtonTone = "neutral" | "primary" | "danger";
type ButtonVariant = "solid" | "soft" | "outline";

export function buttonStyle({
  tone = "neutral",
  variant = "outline",
  disabled = false,
  minWidth,
}: {
  tone?: ButtonTone;
  variant?: ButtonVariant;
  disabled?: boolean;
  minWidth?: number;
} = {}): CSSProperties {
  const palette = buttonPalette(tone, variant);

  return {
    minWidth,
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: disabled ? UI_COLORS.slate400 : palette.color,
    fontSize: 11,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

export function controlStyle(): CSSProperties {
  return {
    minWidth: 0,
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${UI_COLORS.borderMid}`,
    background: UI_COLORS.white,
    color: UI_COLORS.slate800,
    fontSize: 11,
  };
}

export function sectionTitleStyle(): CSSProperties {
  return {
    padding: "8px 12px 4px",
    fontSize: 10,
    fontWeight: 700,
    color: UI_COLORS.slate400,
    letterSpacing: 0.08,
    textTransform: "uppercase",
    borderBottom: `1px solid ${UI_COLORS.borderLight}`,
  };
}

export function sectionIntroStyle(): CSSProperties {
  return {
    padding: "10px 12px 6px",
    fontSize: 10,
    color: UI_COLORS.slate400,
    letterSpacing: 0.03,
    borderBottom: `1px solid ${UI_COLORS.borderLight}`,
  };
}

export function panelCardStyle(): CSSProperties {
  return {
    background: UI_COLORS.white,
    border: `1px solid ${UI_COLORS.borderLight}`,
    borderRadius: 10,
  };
}

export function splitHandleStyle(): CSSProperties {
  return {
    width: 8,
    cursor: "ew-resize",
    background: `linear-gradient(90deg, transparent 0, transparent 3px, ${UI_COLORS.borderLight} 3px, ${UI_COLORS.borderLight} 4px, transparent 4px, transparent 100%)`,
    flexShrink: 0,
  };
}

export function gateChipStyle({ minWidth = 35 }: { minWidth?: number } = {}): CSSProperties {
  return {
    minWidth,
    padding: "5px 8px",
    borderRadius: 4,
    fontFamily: "monospace",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: 1.1,
    width: "auto",
    flex: "0 0 auto",
    cursor: "grab",
  };
}

export const subtleTextStyle = {
  fontSize: 11,
  color: UI_COLORS.slate500,
} satisfies CSSProperties;

export const shellSurfaceStyle = {
  background: UI_COLORS.white,
  borderBottom: `1px solid ${UI_COLORS.borderLight}`,
} satisfies CSSProperties;

function buttonPalette(tone: ButtonTone, variant: ButtonVariant) {
  if (tone === "primary") {
    if (variant === "solid") {
      return { background: UI_COLORS.slate900, color: UI_COLORS.white, border: UI_COLORS.slate900 };
    }

    if (variant === "soft") {
      return { background: UI_COLORS.blue50, color: UI_COLORS.blue700, border: UI_COLORS.borderMid };
    }

    return { background: UI_COLORS.white, color: UI_COLORS.slate800, border: UI_COLORS.borderMid };
  }

  if (tone === "danger") {
    if (variant === "solid") {
      return { background: UI_COLORS.red600, color: UI_COLORS.white, border: UI_COLORS.red600 };
    }

    if (variant === "soft") {
      return { background: UI_COLORS.rose50, color: UI_COLORS.red600, border: UI_COLORS.red100 };
    }

    return { background: UI_COLORS.white, color: UI_COLORS.red600, border: UI_COLORS.red100 };
  }

  if (variant === "solid") {
    return { background: UI_COLORS.slate900, color: UI_COLORS.white, border: UI_COLORS.slate900 };
  }

  if (variant === "soft") {
    return { background: UI_COLORS.panelBg, color: UI_COLORS.slate700, border: UI_COLORS.borderLight };
  }

  return { background: UI_COLORS.white, color: UI_COLORS.slate700, border: UI_COLORS.borderMid };
}
