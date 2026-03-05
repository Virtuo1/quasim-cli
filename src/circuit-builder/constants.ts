export interface GateDefinition {
  l: string;
  c: string;
  desc: string;
  p?: boolean;
}

export const UI_COLORS = {
  white: "#fff",
  appBg: "#f1f5f9",
  panelBg: "#f8fafc",
  borderLight: "#e2e8f0",
  borderMid: "#cbd5e1",
  slate400: "#94a3b8",
  slate500: "#64748b",
  slate600: "#475569",
  slate700: "#334155",
  slate800: "#1e293b",
  slate900: "#0f172a",
  blue50: "#eff6ff",
  blue600: "#2563EB",
  blue700: "#1d4ed8",
  amber500: "#F59E0B",
  amber700: "#B45309",
  red100: "#fecaca",
  red300: "#fca5a5",
  red400: "#f87171",
  red600: "#dc2626",
  rose50: "#fff1f2",
  yellow50: "#fffbeb",
  yellow200: "#fde68a",
  yellow400: "#fbbf24",
  yellow800: "#92400e",
  yellow900: "#78350f",
  green300: "#86efac",
  green600: "#16a34a",
  violet600: "#7c3aed",
} as const;

export const ERROR_COLORS = {
  primary: UI_COLORS.red600,
  muted: UI_COLORS.red300,
  label: UI_COLORS.red400,
  previewFill: "rgba(239,68,68,.10)",
} as const;

export const CW = 64;
export const CH = 52;
export const LW = 90;
export const PX = 16;
export const PY = 36;
export const GB = 36;
export const CREG_GAP = 28;
export const CRH = 44;
export const MIN_STEPS = 5;

export const COND_OPS = ["==", "!=", "<", "<=", ">", ">="] as const;

export const GATE_DEFS = {
  H: { l: "H", c: "#2563EB", desc: "Hadamard" },
  X: { l: "X", c: "#DC2626", desc: "Pauli-X" },
  Y: { l: "Y", c: "#D97706", desc: "Pauli-Y" },
  Z: { l: "Z", c: "#7C3AED", desc: "Pauli-Z" },
  S: { l: "S", c: "#059669", desc: "S (√Z)" },
  T: { l: "T", c: "#0891B2", desc: "T (π/8)" },
  SDG: { l: "S†", c: "#047857", desc: "S-dagger" },
  TDG: { l: "T†", c: "#0369A1", desc: "T-dagger" },
  SX: { l: "√X", c: "#9D174D", desc: "√X gate" },
  RX: { l: "Rx", c: "#9F1239", desc: "Rx(θ)", p: true },
  RY: { l: "Ry", c: "#C2410C", desc: "Ry(θ)", p: true },
  RZ: { l: "Rz", c: "#6D28D9", desc: "Rz(θ)", p: true },
  P: { l: "P", c: "#0D9488", desc: "Phase(λ)", p: true },
  U: { l: "U", c: "#475569", desc: "Unitary (U)" },
  RESET: { l: "|0⟩", c: "#374151", desc: "Reset to |0⟩" },
  M: { l: "M", c: "#1e293b", desc: "Measure" },
} as const satisfies Record<string, GateDefinition>;

export type GateType = keyof typeof GATE_DEFS;

export const gateSupportsParam = (gateType: GateType) => {
  const def = GATE_DEFS[gateType];
  return "p" in def && Boolean(def.p);
};

export const CONNECTOR_BLACK = "#000000";

export const PALETTE_GROUPS = [
  { group: "Single-Qubit", keys: ["H", "X", "Y", "Z", "S", "T", "SDG", "TDG", "SX"] },
  { group: "Rotation", keys: ["RX", "RY", "RZ", "P", "U"] },
  { group: "Init / Meas", keys: ["RESET", "M"] },
] as const;
