import { unitaryGateSupportsParam } from "../constants";
import type {
  CircuitElement,
  ClassicalControlElement,
  ClassicalCondition,
  DragGhostState,
  PaletteDragSpec,
} from "../types";
import { uid } from "../utils/layout";

export function createElementFromPalette(
  spec: PaletteDragSpec,
  step: number,
  qubit: number,
): CircuitElement {
  if (spec.type === "unitary") {
    return {
      id: uid(),
      type: "unitary",
      kind: spec.kind,
      step,
      qubit,
      param: unitaryGateSupportsParam(spec.kind) ? 0 : undefined,
    };
  }

  if (spec.type === "measurement") {
    return {
      id: uid(),
      type: "measurement",
      step,
      qubit,
      registerName: null,
    };
  }

  if (spec.type === "reset") {
    return {
      id: uid(),
      type: "reset",
      step,
      qubit,
    };
  }

  if (spec.type === "custom") {
    return {
      id: uid(),
      type: "custom",
      classifier: spec.classifier,
      step,
      qubit,
    };
  }

  return {
    id: uid(),
    type: spec.type,
    step,
    qubit,
  };
}

export function createClassicalControlElement(
  step: number,
  cregIdx: number,
  condition: ClassicalCondition,
): ClassicalControlElement {
  return {
    id: uid(),
    type: "cctrl",
    step,
    cregIdx,
    condition,
  };
}

export function createDragGhostFromElement(
  element: CircuitElement,
  clientX: number,
  clientY: number,
): DragGhostState {
  if (element.type === "unitary") {
    return { x: clientX, y: clientY, type: "unitary", kind: element.kind };
  }
  if (element.type === "measurement") {
    return { x: clientX, y: clientY, type: "measurement" };
  }
  if (element.type === "reset") {
    return { x: clientX, y: clientY, type: "reset" };
  }
  if (element.type === "swap") {
    return { x: clientX, y: clientY, type: "swap" };
  }
  if (element.type === "custom") {
    return { x: clientX, y: clientY, type: "custom", classifier: element.classifier };
  }
  return { x: clientX, y: clientY, type: "ctrl" };
}
