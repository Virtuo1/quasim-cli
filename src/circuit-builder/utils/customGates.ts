import type {
  CircuitElement,
  CustomGateDefinition,
  CustomGateElement,
  GroupableElement,
  SerializedCustomGateDefinition,
  SerializedCustomGateElement,
} from "../types";

export function isGroupableQuantumElement(element: CircuitElement): element is GroupableElement {
  if (element.type === "ctrl" || element.type === "swap") {
    return true;
  }

  return element.type === "gate" && element.gateType !== "M";
}

export function elementOccupiedQubits(
  element: CircuitElement,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  if (element.type === "cctrl") {
    return [];
  }

  if (element.type === "custom") {
    return customGateOccupiedQubits(
      element,
      findCustomGateDefinition(element.classifier, customGateDefinitions),
    );
  }

  return [element.qubit];
}

export function canCreateCustomGate(
  elements: CircuitElement[],
  allElements: CircuitElement[] = elements,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  if (elements.length === 0) {
    return { valid: false, reason: "Select at least one purely quantum element." };
  }

  if (!elements.every(isGroupableQuantumElement)) {
    return { valid: false, reason: "Custom gates may only contain quantum gates, controls, and swaps." };
  }

  const steps = new Set(elements.map((element) => element.step));
  if (steps.size !== 1) {
    return { valid: false, reason: "Custom gates can only be created from a single column right now." };
  }

  const selectedIds = new Set(elements.map((element) => element.id));
  const minQubit = Math.min(...elements.map((element) => element.qubit));
  const maxQubit = Math.max(...elements.map((element) => element.qubit));
  const step = elements[0].step;
  // Grouping replaces the selection with one tall gate, so any remaining quantum
  // element inside that vertical span would overlap the resulting custom gate.
  const overlapsRemainingColumn = allElements.some((element) => {
    if (element.step !== step || selectedIds.has(element.id) || element.type === "cctrl") {
      return false;
    }

    return elementOccupiedQubits(element, customGateDefinitions).some(
      (qubit) => qubit >= minQubit && qubit <= maxQubit,
    );
  });

  if (overlapsRemainingColumn) {
    return { valid: false, reason: "Select the full quantum block in that column before creating a custom gate." };
  }

  return { valid: true as const };
}

export function buildCustomGateDefinition(
  classifier: string,
  label: string,
  elements: GroupableElement[],
  id: number,
): CustomGateDefinition {
  const minQubit = Math.min(...elements.map((element) => element.qubit));
  const maxQubit = Math.max(...elements.map((element) => element.qubit));

  return {
    id,
    classifier,
    label,
    minQubit,
    maxQubit,
    elements: elements.map((element) => ({ ...element, step: 0, qubit: element.qubit - minQubit })),
  };
}

export function findCustomGateDefinition(
  classifier: string,
  definitions: CustomGateDefinition[],
) {
  return definitions.find((definition) => definition.classifier === classifier);
}

export function customGateSpan(definition: CustomGateDefinition | undefined) {
  if (!definition) {
    return 1;
  }

  return definition.maxQubit - definition.minQubit + 1;
}

export function customGateOccupiedQubits(
  element: CustomGateElement,
  definition: CustomGateDefinition | undefined,
) {
  const span = customGateSpan(definition);
  return Array.from({ length: span }, (_, offset) => element.qubit + offset);
}

export function serializeCustomGateDefinitions(definitions: CustomGateDefinition[]): SerializedCustomGateDefinition[] {
  return definitions.map((definition) => ({
    classifier: definition.classifier,
    label: definition.label,
    elements: definition.elements.map(serializeCustomGateElement),
  }));
}

export function deserializeCustomGateDefinitions(
  definitions: SerializedCustomGateDefinition[] | undefined,
  makeId: () => number,
): CustomGateDefinition[] {
  return (definitions ?? []).map((definition) => {
    const groupableElements = definition.elements.flatMap((element) => deserializeCustomGateElement(element, makeId));
    return buildCustomGateDefinition(definition.classifier, definition.label, groupableElements, makeId());
  });
}

function serializeCustomGateElement(element: GroupableElement): SerializedCustomGateElement {
  if (element.type === "ctrl") {
    return { type: "CTRL", qubit: element.qubit };
  }

  if (element.type === "swap") {
    return { type: "SWAP", qubits: [element.qubit] };
  }

  return { type: element.gateType, qubit: element.qubit, param: element.param };
}

function deserializeCustomGateElement(
  element: SerializedCustomGateElement,
  makeId: () => number,
): GroupableElement[] {
  if (element.type === "CTRL" && typeof element.qubit === "number") {
    return [{ id: makeId(), type: "ctrl", step: 0, qubit: element.qubit }];
  }

  if (element.type === "SWAP") {
    return (element.qubits ?? []).map((qubit) => ({ id: makeId(), type: "swap", step: 0, qubit }));
  }

  if (element.type !== "CTRL" && typeof element.qubit === "number") {
    return [{
      id: makeId(),
      type: "gate",
      gateType: element.type,
      step: 0,
      qubit: element.qubit,
      param: element.param,
    }];
  }

  return [];
}
