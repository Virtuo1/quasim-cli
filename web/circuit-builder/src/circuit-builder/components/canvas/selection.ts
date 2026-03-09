import { GB } from "../../constants";
import type { CanvasElement, ClassicalRegister, CustomGateDefinition, SelectionBox } from "../../types";
import { exprRegisters } from "../../utils/conditions";
import { customGateOccupiedQubits, findCustomGateDefinition } from "../../utils/customGates";
import { cregY, wireX, wireY } from "../../utils/layout";

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function normalizeSelectionBox(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): SelectionBox {
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

export function getSelectionBounds(box: SelectionBox): Bounds {
  return {
    left: box.x,
    top: box.y,
    right: box.x + box.width,
    bottom: box.y + box.height,
  };
}

export function selectionHitsElement(
  box: SelectionBox,
  element: CanvasElement,
  nQ: number,
  classicalRegs: ClassicalRegister[] = [],
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  const a = getSelectionBounds(box);
  const b = getElementBounds(element, nQ, classicalRegs, customGateDefinitions);
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function getElementBounds(
  element: CanvasElement,
  nQ: number,
  classicalRegs: ClassicalRegister[],
  customGateDefinitions: CustomGateDefinition[],
): Bounds {
  const cx = wireX(element.step);

  if (element.type === "cctrl") {
    const registerIndices = exprRegisters(element.condition)
      .map((registerName) => classicalRegs.findIndex((register) => register.name === registerName))
      .filter((index): index is number => index >= 0);
    const topRegisterIndex = registerIndices.length > 0 ? Math.min(...registerIndices) : element.cregIdx;
    const bottomRegisterIndex = registerIndices.length > 0 ? Math.max(...registerIndices) : element.cregIdx;
    return {
      left: cx - 18,
      top: cregY(topRegisterIndex, nQ) - 21,
      right: cx + 18,
      bottom: cregY(bottomRegisterIndex, nQ) + 21,
    };
  }

  if (element.type === "jump") {
    return {
      left: cx - 24,
      top: wireY(0) - GB / 2,
      right: cx + 24,
      bottom: wireY(nQ - 1) + GB / 2,
    };
  }

  const cy = wireY(element.qubit);

  if (element.type === "ctrl") {
    return { left: cx - 7, top: cy - 7, right: cx + 7, bottom: cy + 7 };
  }

  if (element.type === "swap") {
    return { left: cx - 18, top: cy - 18, right: cx + 18, bottom: cy + 18 };
  }

  if (element.type === "custom") {
    const definition = findCustomGateDefinition(element.classifier, customGateDefinitions);
    const occupiedQubits = customGateOccupiedQubits(element, definition);
    return {
      left: cx - 24,
      top: wireY(Math.min(...occupiedQubits)) - GB / 2,
      right: cx + 24,
      bottom: wireY(Math.max(...occupiedQubits)) + GB / 2,
    };
  }

  const label =
    element.type === "unitary" && element.params && element.params.length > 0
      ? `${element.kind}(${element.params.join(",")})`
      : element.type === "unitary"
        ? element.kind
        : element.type === "assign"
          ? "ASSIGN"
        : element.type === "measurement"
          ? "M"
          : "|0⟩";
  const width = label.length > 5 ? 56 : GB;
  return { left: cx - width / 2, top: cy - GB / 2, right: cx + width / 2, bottom: cy + GB / 2 };
}
