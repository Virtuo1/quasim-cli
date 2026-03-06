import { GB } from "../../constants";
import type { CircuitElement, CustomGateDefinition, SelectionBox } from "../../types";
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
  element: CircuitElement,
  nQ: number,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  const a = getSelectionBounds(box);
  const b = getElementBounds(element, nQ, customGateDefinitions);
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function getElementBounds(
  element: CircuitElement,
  nQ: number,
  customGateDefinitions: CustomGateDefinition[],
): Bounds {
  const cx = wireX(element.step);

  if (element.type === "cctrl") {
    const cy = cregY(element.cregIdx, nQ);
    return { left: cx - 14, top: cy - 18, right: cx + 14, bottom: cy + 18 };
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

  const label = element.param != null ? `${element.gateType}(${element.param})` : element.gateType;
  const width = label.length > 5 ? 56 : GB;
  return { left: cx - width / 2, top: cy - GB / 2, right: cx + width / 2, bottom: cy + GB / 2 };
}
