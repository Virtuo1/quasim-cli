export interface UnitaryOpDef {
  label: string;
  color: string;
  description: string;
  expectedParameters?: string[];
}

export interface ClassicalOpDef {
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
  green50: "#ecfdf5",
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
export const CREG_BIT_WIDTH = 32;
export const MAX_CREG_BIT_INDEX = CREG_BIT_WIDTH - 1;
export const MAX_FULL_STATEVECTOR_QUBITS = 8;
export const SORTED_STATEVECTOR_TOP_N = 32;

export const COND_OPS = ["==", "!=", "<", "<=", ">", ">="] as const;

export const UNITARY_OP_DEFS = {
  H: { label: "H", color: "#2563EB", description: "Hadamard" },
  X: { label: "X", color: "#DC2626", description: "Pauli-X" },
  Y: { label: "Y", color: "#D97706", description: "Pauli-Y" },
  Z: { label: "Z", color: "#7C3AED", description: "Pauli-Z" },
  S: { label: "S", color: "#059669", description: "S (sqrt(Z))" },
  RX: { label: "Rx", color: "#9F1239", description: "Rx(θ)", expectedParameters: ["θ"] },
  RY: { label: "Ry", color: "#C2410C", description: "Ry(θ)", expectedParameters: ["θ"] },
  RZ: { label: "Rz", color: "#6D28D9", description: "Rz(θ)", expectedParameters: ["θ"] },
  P: { label: "P", color: "#0D9488", description: "Phase(λ)", expectedParameters: ["λ"] },
  U: { label: "U", color: "#475569", description: "U(θ,ϕ,λ)", expectedParameters: ["θ", "ϕ", "λ"] },
  I: { label: "I", color: "#17191b", description: "Identity" },
} as const satisfies Record<string, UnitaryOpDef>;

export type UnitaryGateKind = keyof typeof UNITARY_OP_DEFS;

export const CLASSICAL_OP_DEFS = {
  measurement: { label: "Measure", color: "#1e293b", description: "Measure" },
  assign: { label: "Assign", color: "#0f766e", description: "Assign value" },
  reset: { label: "|0⟩", color: "#374151", description: "Reset to |0⟩" },
  jump: { label: "Jump", color: "#000000", description: "Jump to column" },
} as const satisfies Record<string, ClassicalOpDef>;

export const unitaryGateExpectedParameters = (kind: UnitaryGateKind) => {
  const definition = UNITARY_OP_DEFS[kind];
  return "expectedParameters" in definition ? definition.expectedParameters : undefined;
};

export const unitaryGateSupportsParam = (kind: UnitaryGateKind) => {
  const expectedParameters = unitaryGateExpectedParameters(kind);
  return Array.isArray(expectedParameters) && expectedParameters.length > 0;
};

export const CONNECTOR_BLACK = "#000";
export const UNITARY_GATE_KINDS = Object.keys(UNITARY_OP_DEFS) as UnitaryGateKind[];
export const CLASSICAL_OP_KINDS = Object.keys(CLASSICAL_OP_DEFS) as (keyof typeof CLASSICAL_OP_DEFS)[];
