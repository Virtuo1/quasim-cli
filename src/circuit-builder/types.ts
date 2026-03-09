import type { UnitaryGateKind } from "./constants";

export interface ClassicalRegister {
  id: number;
  name: string;
}

/**
 * Expression types
 * Mirrors the Rust enum shape:
 * Expr::Val(Value) | Expr::Reg(String) | Expr::Not(Box<Expr>) | ...
 */

export type ExprValue =
  | { Int: number }
  | { Float: number }
  | { Bool: boolean };

export type BinaryExpr =
  | { And: [Expr, Expr] }
  | { Or: [Expr, Expr] }
  | { Xor: [Expr, Expr] }
  | { Add: [Expr, Expr] }
  | { Sub: [Expr, Expr] }
  | { Mul: [Expr, Expr] }
  | { Div: [Expr, Expr] }
  | { Rem: [Expr, Expr] }
  | { Eq: [Expr, Expr] }
  | { Lt: [Expr, Expr] };

export type Expr =
  | { Val: ExprValue }
  | { Reg: string }
  | { Not: Expr }
  | BinaryExpr;

export type ExprKind =
  | "int"
  | "float"
  | "bool"
  | "reg"
  | "not"
  | "and"
  | "or"
  | "xor"
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "rem"
  | "eq"
  | "lt";

/**
 * Element types
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

export interface UnitaryGateElement extends BaseElement {
  type: "unitary";
  qubit: number;
  kind: UnitaryGateKind;
  params?: number[];
}

export interface MeasurementElement extends BaseElement {
  type: "measurement";
  qubit: number;
  registerName: string | null;
  bitIndex: number | null;
}

export interface AssignElement extends BaseElement {
  type: "assign";
  qubit: number;
  registerName: string | null;
  expr: Expr;
}

export interface ResetElement extends BaseElement {
  type: "reset";
  qubit: number;
}

export interface JumpElement extends BaseElement {
  type: "jump";
  targetStep: number | null;
}

export interface CustomGateElement extends BaseElement {
  type: "custom";
  classifier: string;
  qubit: number;
}

export interface ClassicalControlElement extends BaseElement {
  type: "cctrl";
  cregIdx: number;
  condition: Expr;
}

export type GroupableElement =
  | ControlElement
  | SwapElement
  | UnitaryGateElement;

export type CircuitElement =
  | ControlElement
  | SwapElement
  | UnitaryGateElement
  | MeasurementElement
  | AssignElement
  | ResetElement
  | JumpElement
  | CustomGateElement;

export type RegisterElement =
  ClassicalControlElement;

export type CanvasElement =
  | CircuitElement
  | RegisterElement;

/**
 * Types for canvas drawing and analysis
 */

export interface QuantumConnectorLine {
  kind: "quantum";
  q1: number;
  q2: number;
  error: boolean;
}

export interface StepAnalysis {
  swaps: SwapElement[];
  ctrls: ControlElement[];
  unitaryGates: UnitaryGateElement[];
  measurements: MeasurementElement[];
  assigns: AssignElement[];
  resets: ResetElement[];
  jumps: JumpElement[];
  customs: CustomGateElement[];
  cctrl: ClassicalControlElement[];
  swapError: boolean;
  ctrlOrphan: boolean;
  ctrlOnClassicalOp: boolean;
  ctrlOnCustom: boolean;
  overlapError: boolean;
  overlapElementIds: number[];
  measurementBitConflict: boolean;
  measurementBitConflictIds: number[];
  registerWriteConflict: boolean;
  registerWriteConflictIds: number[];
  jumpMixedColumn: boolean;
  jumpWithoutTarget: boolean;
  cctrlOrphan: boolean;
  cctrlMultiple: boolean;
  conditionInvalid: boolean;
  measurementWithoutTarget: boolean;
  assignWithoutRegister: boolean;
  hasError: boolean;
}

export type StepAnalysisMap = Record<number, StepAnalysis>;

export type PaletteDragSpec =
  | { type: "ctrl" }
  | { type: "swap" }
  | { type: "unitary"; kind: UnitaryGateKind }
  | { type: "measurement" }
  | { type: "assign" }
  | { type: "reset" }
  | { type: "jump" }
  | { type: "custom"; classifier: string };

export type DragGhostState = PaletteDragSpec & {
  x: number;
  y: number;
};

export type DropPreview =
  | { zone: "qubit"; step: number; qubit: number; valid: boolean; insertAt?: number; qubitSpan?: number; fullColumn?: boolean }
  | { zone: "creg"; step: number; cregIdx: number; cregName: string; valid: boolean; insertAt?: number };

export type CanvasHit =
  | { zone: "qubit"; step: number; qubit: number; insertAt?: number }
  | { zone: "creg"; step: number; cregIdx: number; cregName: string; insertAt?: number };

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Modal states
 */

export interface ParameterModalState {
  id: number;
  values: number[];
}

export interface ClassicalRegisterModalState {
  elId: number;
}

export interface ConditionModalState {
  elId: number;
}

export interface AssignModalState {
  elId: number;
}

export interface JumpModalState {
  elId: number;
}

export interface CustomGateModalState {
  suggestedName?: string;
}

/**
 * Gate definition types
 */

export interface OperationDefinition {
  step: number;
  type: UnitaryGateKind | "SWAP" | "M" | "ASSIGN" | "RESET" | "JUMP" | "CUSTOM";
  qubit?: number;
  qubits?: number[];
  controls?: number[];
  params?: number[];
  creg?: string | null;
  cregBit?: number | null;
  classifier?: string;
  targetStep?: number | null;
  expr?: Expr;
}

export interface CustomGateDefinition {
  id: number;
  classifier: string;
  gates: OperationDefinition[];
  minQubit: number;
  maxQubit: number;
}

/**
 * Serialization types
 */

export interface SerializedCustomGateDefinition {
  classifier: string;
  gates: OperationDefinition[];
}

export interface SerializedCondition {
  step: number;
  expr: Expr;
}

export interface SerializedCircuit {
  qubits?: number;
  steps?: number;
  classicalRegisters?: string[];
  customGates?: SerializedCustomGateDefinition[];
  instructions?: OperationDefinition[];
  conditions?: SerializedCondition[];
}
