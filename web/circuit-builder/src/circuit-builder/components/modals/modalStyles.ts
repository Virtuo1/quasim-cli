import type { CSSProperties } from "react";

import { UI_COLORS } from "../../constants";
import { buttonStyle, controlStyle, panelCardStyle, subtleTextStyle } from "../../ui/styles";

export const modalSurfaceStyle = {
  ...panelCardStyle(),
  padding: 20,
  width: "100%",
  maxHeight: "calc(100vh - 32px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
} satisfies CSSProperties;

export const modalTitleStyle = {
  fontWeight: 700,
  fontSize: 15,
  color: UI_COLORS.slate900,
  marginBottom: 4,
} satisfies CSSProperties;

export const modalSubtitleStyle = {
  ...subtleTextStyle,
  fontSize: 12,
  marginBottom: 16,
} satisfies CSSProperties;

export const modalFieldLabelStyle = {
  fontSize: 10,
  fontWeight: 700,
  color: UI_COLORS.slate500,
  letterSpacing: 0.2,
  marginBottom: 6,
} satisfies CSSProperties;

export const modalInputStyle = {
  ...controlStyle(),
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "monospace",
  fontSize: 12,
} satisfies CSSProperties;

export const modalActionsStyle = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
} satisfies CSSProperties;

export const modalSecondaryButtonStyle = {
  ...buttonStyle({ variant: "outline" }),
  fontSize: 13,
  padding: "6px 16px",
} satisfies CSSProperties;

export const modalPrimaryButtonStyle = {
  ...buttonStyle({ tone: "primary", variant: "solid" }),
  fontSize: 13,
  padding: "6px 16px",
} satisfies CSSProperties;

export const modalDangerPanelStyle = {
  ...panelCardStyle(),
  padding: "10px 12px",
  background: UI_COLORS.rose50,
  borderColor: UI_COLORS.red100,
  color: UI_COLORS.red600,
  fontSize: 12,
  marginBottom: 16,
} satisfies CSSProperties;

export const modalWarningPanelStyle = {
  ...panelCardStyle(),
  padding: "10px 12px",
  background: UI_COLORS.yellow50,
  borderColor: UI_COLORS.yellow200,
  color: UI_COLORS.yellow800,
  fontSize: 11,
} satisfies CSSProperties;
