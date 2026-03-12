import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from "react";

import type {
  AssignModalState,
  CanvasElement,
  ClassicalRegister,
  ClassicalRegisterModalState,
  DebuggerState,
  ConditionModalState,
  CustomGateDefinition,
  CustomGateModalState,
  DragGhostState,
  DropPreview,
  JumpModalState,
  PaletteDragSpec,
  ParameterModalState,
  SelectionBox,
  StepAnalysisMap,
} from "../types";

export interface UseCircuitEditorArgs {
  svgRef: RefObject<SVGSVGElement | null>;
  contRef: RefObject<HTMLDivElement | null>;
}

export type ElementUpdater = CanvasElement[] | ((prev: CanvasElement[]) => CanvasElement[]);

export interface CircuitDocumentState {
  nQ: number;
  nS: number;
  elements: CanvasElement[];
  classicalRegs: ClassicalRegister[];
  customGateDefinitions: CustomGateDefinition[];
  newRegName: string;
  debugger: DebuggerState;
}

export interface CircuitUiState {
  selectedIds: number[];
  parameterModal: ParameterModalState | null;
  classicalRegisterModal: ClassicalRegisterModalState | null;
  conditionModal: ConditionModalState | null;
  assignModal: AssignModalState | null;
  jumpModal: JumpModalState | null;
  hoveredJumpTargetStep: number | null;
  customGateModal: CustomGateModalState | null;
  dragGhost: DragGhostState | null;
  dropPreview: DropPreview | null;
  draggingId: number | null;
  selectionBox: SelectionBox | null;
  debugViewMode: "state" | "sorted";
}

export interface CustomGateCreationState {
  selectedElements: CanvasElement[];
  valid: boolean;
  reason: string | null;
}

export interface CircuitEditorDerivedState {
  selectedCount: number;
  selectedElement: CanvasElement | null;
  parameterModalElement: Extract<CanvasElement, { type: "unitary" }> | null;
  classicalRegisterModalElement: Extract<CanvasElement, { type: "measurement" }> | null;
  conditionModalElement: Extract<CanvasElement, { type: "cctrl" }> | null;
  assignModalElement: Extract<CanvasElement, { type: "assign" }> | null;
  jumpModalElement: Extract<CanvasElement, { type: "jump" }> | null;
  customGateCreation: CustomGateCreationState;
  stepAnalysis: StepAnalysisMap;
  errorSteps: number;
}

export interface CircuitEditorState extends CircuitDocumentState, CircuitUiState, CircuitEditorDerivedState {}

export interface CircuitEditorRefs {
  elementsRef: RefObject<CanvasElement[]>;
  nQRef: RefObject<number>;
  nSRef: RefObject<number>;
  classicalRegsRef: RefObject<ClassicalRegister[]>;
  customGateDefinitionsRef: RefObject<CustomGateDefinition[]>;
  debuggerRef: RefObject<DebuggerState>;
}

export interface CircuitDocumentStore extends CircuitDocumentState, CircuitEditorRefs {
  setNQ: Dispatch<SetStateAction<number>>;
  setNS: Dispatch<SetStateAction<number>>;
  setElements: (updater: ElementUpdater) => void;
  setCregs: Dispatch<SetStateAction<ClassicalRegister[]>>;
  setCustomGateDefinitions: Dispatch<SetStateAction<CustomGateDefinition[]>>;
  setNewRegName: Dispatch<SetStateAction<string>>;
  setDebuggerState: Dispatch<SetStateAction<DebuggerState>>;
}

export interface CircuitUiStore extends CircuitUiState {
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
  setParameterModal: Dispatch<SetStateAction<ParameterModalState | null>>;
  setClassicalRegisterModal: Dispatch<SetStateAction<ClassicalRegisterModalState | null>>;
  setConditionModal: Dispatch<SetStateAction<ConditionModalState | null>>;
  setAssignModal: Dispatch<SetStateAction<AssignModalState | null>>;
  setJumpModal: Dispatch<SetStateAction<JumpModalState | null>>;
  setHoveredJumpTargetStep: Dispatch<SetStateAction<number | null>>;
  setCustomGateModal: Dispatch<SetStateAction<CustomGateModalState | null>>;
  setDragGhost: Dispatch<SetStateAction<DragGhostState | null>>;
  setDropPreview: Dispatch<SetStateAction<DropPreview | null>>;
  setDraggingId: Dispatch<SetStateAction<number | null>>;
  setSelectionBox: Dispatch<SetStateAction<SelectionBox | null>>;
  setDebugViewMode: Dispatch<SetStateAction<"state" | "sorted">>;
}

export interface CircuitEditorStores {
  document: CircuitDocumentStore;
  ui: CircuitUiStore;
}

export interface CircuitEditorActions {
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
  clearSelection: () => void;
  setParameterModal: Dispatch<SetStateAction<ParameterModalState | null>>;
  setClassicalRegisterModal: Dispatch<SetStateAction<ClassicalRegisterModalState | null>>;
  setConditionModal: Dispatch<SetStateAction<ConditionModalState | null>>;
  setAssignModal: Dispatch<SetStateAction<AssignModalState | null>>;
  setJumpModal: Dispatch<SetStateAction<JumpModalState | null>>;
  setHoveredJumpTargetStep: Dispatch<SetStateAction<number | null>>;
  setCustomGateModal: Dispatch<SetStateAction<CustomGateModalState | null>>;
  setNewRegName: Dispatch<SetStateAction<string>>;
  setDebugViewMode: Dispatch<SetStateAction<"state" | "sorted">>;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  startCanvasSelection: (event: ReactPointerEvent<SVGSVGElement>) => void;
  startPaletteDrag: (event: ReactPointerEvent, spec: PaletteDragSpec) => void;
  startElementDrag: (event: ReactPointerEvent, id: number) => void;
  openConditionEditor: (elId: number) => void;
  openJumpTargetEditor: (elId: number, suggestedStep?: number | null) => void;
  addRegister: () => void;
  deleteRegister: (id: number) => void;
  addQubit: () => void;
  removeQubit: () => void;
  exportJSON: () => void;
  importJSON: () => void;
  clearCircuit: () => void;
  assignMeasurementRegister: (registerName: string, bitIndex: number) => void;
  createRegisterAndAssign: (name: string, bitIndex: number) => void;
  applyCondition: (condition: Extract<CanvasElement, { type: "cctrl" }>["condition"]) => void;
  applyAssign: (registerName: string | null, expr: Extract<CanvasElement, { type: "assign" }>["expr"]) => void;
  applyParameter: () => void;
  applyJumpTarget: (targetStep: number) => void;
  createCustomGate: (name: string) => void;
  deleteSelected: (id: number) => void;
  deleteSelectedSet: () => void;
  buildDebugSession: () => Promise<void>;
  stepDebugSession: () => Promise<void>;
  continueDebugSession: () => Promise<void>;
  refreshDebugSession: () => Promise<void>;
  changeDebugViewMode: (mode: "state" | "sorted") => void;
  loadTrackedBasisAmplitude: (basis: number) => Promise<void>;
}

export interface UseCircuitEditorResult {
  state: CircuitEditorState;
  actions: CircuitEditorActions;
}
