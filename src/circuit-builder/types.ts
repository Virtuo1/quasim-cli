import type { COND_OPS, GateType } from "./constants";

export type ConditionOperator = (typeof COND_OPS)[number];

export interface ClassicalRegister {
  id: number;
  name: string;
}

/**
 * Circuit elements
 */

export interface BaseElement {
  id: number;
  step: number;
}

export interface ControlElement extends BaseElement {
  type: "ctrl";
  qubit: number;
}

export interface SwapElement extends BaseElement {
  type: "swap";
  qubit: number;
}

export interface GateElement extends BaseElement {
  type: "gate";
  gateType: GateType;
  qubit: number;
  param?: number;
  creg?: string | null;
}

export interface CustomGateElement extends BaseElement {
  type: "custom";
  classifier: string;
  qubit: number;
}

export interface ClassicalControlElement extends BaseElement {
  type: "cctrl";
  cregIdx: number;
  cregName: string;
  op: ConditionOperator;
  val: number;
}

export type GroupableElement = ControlElement | SwapElement | GateElement;

export type CircuitElement =
  | ControlElement
  | SwapElement
  | GateElement
  | CustomGateElement
  | ClassicalControlElement;

export interface QuantumConnectorLine {
  kind: "quantum";
  q1: number;
  q2: number;
  error: boolean;
}

export interface StepAnalysis {
  swaps: SwapElement[];
  ctrls: ControlElement[];
  gates: GateElement[];
  customs: CustomGateElement[];
  cctrl: ClassicalControlElement[];
  swapError: boolean;
  ctrlOrphan: boolean;
  ctrlOnMeas: boolean;
  cctrlOrphan: boolean;
  cctrlMultiple: boolean;
  measNoReg: boolean;
  hasError: boolean;
}

export type StepAnalysisMap = Record<number, StepAnalysis>;

export type PaletteDragSpec =
  | { type: "ctrl" }
  | { type: "swap" }
  | { type: "gate"; gateType: GateType }
  | { type: "custom"; classifier: string };

export type DragGhostState = PaletteDragSpec & {
  x: number;
  y: number;
};

export type DropPreview =
  | { zone: "qubit"; step: number; qubit: number; valid: boolean; insertAt?: number; qubitSpan?: number }
  | { zone: "creg"; step: number; cregIdx: number; cregName: string; valid: boolean; insertAt?: number };

export type CanvasHit =
  | { zone: "qubit"; step: number; qubit: number; insertAt?: number }
  | { zone: "creg"; step: number; cregIdx: number; cregName: string; insertAt?: number };

export interface ParameterModalState {
  id: number;
  val: number;
}

export interface ClassicalRegisterModalState {
  elId: number;
}

export interface ConditionModalState {
  elId: number;
}

export interface CustomGateModalState {
  suggestedName?: string;
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SerializedGate {
  step: number;
  type: GateType | "SWAP" | "CUSTOM";
  qubit?: number;
  qubits?: number[];
  controls?: number[];
  param?: number;
  creg?: string | null;
  classifier?: string;
  condition?: {
    reg: string;
    op: ConditionOperator;
    val: number;
  } | null;
}

export interface SerializedCustomGateElement {
  type: GateType | "SWAP" | "CTRL";
  qubit?: number;
  qubits?: number[];
  param?: number;
}

export interface SerializedCustomGateDefinition {
  classifier: string;
  label: string;
  elements: SerializedCustomGateElement[];
}

export interface SerializedCircuit {
  qubits?: number;
  steps?: number;
  classicalRegisters?: string[];
  customGates?: SerializedCustomGateDefinition[];
  gates?: SerializedGate[];
}

export interface CustomGateDefinition {
  id: number;
  classifier: string;
  label: string;
  elements: GroupableElement[];
  minQubit: number;
  maxQubit: number;
}
