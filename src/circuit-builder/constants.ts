export interface UnitaryGateDefinition {
  label: string;
  color: string;
  description: string;
  supportsParameter?: boolean;
}

export interface SpecialQubitInstructionDefinition {
  label: string;
  color: string;
  description: string;
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

export const UNITARY_GATE_DEFS = {
  H: { label: "H", color: "#2563EB", description: "Hadamard" },
  X: { label: "X", color: "#DC2626", description: "Pauli-X" },
  Y: { label: "Y", color: "#D97706", description: "Pauli-Y" },
  Z: { label: "Z", color: "#7C3AED", description: "Pauli-Z" },
  S: { label: "S", color: "#059669", description: "S (sqrt(Z))" },
  T: { label: "T", color: "#0891B2", description: "T (pi/8)" },
  SDG: { label: "S†", color: "#047857", description: "S-dagger" },
  TDG: { label: "T†", color: "#0369A1", description: "T-dagger" },
  SX: { label: "sqrt(X)", color: "#9D174D", description: "sqrt(X) gate" },
  RX: { label: "Rx", color: "#9F1239", description: "Rx(theta)", supportsParameter: true },
  RY: { label: "Ry", color: "#C2410C", description: "Ry(theta)", supportsParameter: true },
  RZ: { label: "Rz", color: "#6D28D9", description: "Rz(theta)", supportsParameter: true },
  P: { label: "P", color: "#0D9488", description: "Phase(lambda)", supportsParameter: true },
  U: { label: "U", color: "#475569", description: "Unitary (U)" },
} as const satisfies Record<string, UnitaryGateDefinition>;

export type UnitaryGateKind = keyof typeof UNITARY_GATE_DEFS;

export const SPECIAL_QUBIT_INSTRUCTION_DEFS = {
  measurement: { label: "M", color: "#1e293b", description: "Measure" },
  reset: { label: "|0⟩", color: "#374151", description: "Reset to |0⟩" },
} as const satisfies Record<string, SpecialQubitInstructionDefinition>;

export const unitaryGateSupportsParam = (kind: UnitaryGateKind) => {
  const definition = UNITARY_GATE_DEFS[kind];
  return "supportsParameter" in definition && Boolean(definition.supportsParameter);
};

export const CONNECTOR_BLACK = "#000000";

export const PALETTE_SECTIONS = [
  { group: "Single-Qubit", items: [
    { type: "unitary", kind: "H" },
    { type: "unitary", kind: "X" },
    { type: "unitary", kind: "Y" },
    { type: "unitary", kind: "Z" },
    { type: "unitary", kind: "S" },
    { type: "unitary", kind: "T" },
    { type: "unitary", kind: "SDG" },
    { type: "unitary", kind: "TDG" },
    { type: "unitary", kind: "SX" },
  ] },
  { group: "Rotation", items: [
    { type: "unitary", kind: "RX" },
    { type: "unitary", kind: "RY" },
    { type: "unitary", kind: "RZ" },
    { type: "unitary", kind: "P" },
    { type: "unitary", kind: "U" },
  ] },
  { group: "Init / Meas", items: [
    { type: "reset" },
    { type: "measurement" },
  ] },
] as const;
