import type {
  CanvasElement,
  CustomGateDefinition,
  CustomGateElement,
  GroupableElement,
  SerializedCustomGateDefinition,
  OperationDefinition,
} from "../types";

export function isGroupableQuantumElement(element: CanvasElement): element is GroupableElement {
  return element.type === "ctrl" || element.type === "swap" || element.type === "unitary";
}

export function elementOccupiedQubits(
  element: CanvasElement,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  if (element.type === "cctrl") {
    return [];
  }

  if (element.type === "jump") {
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
  elements: CanvasElement[],
  allElements: CanvasElement[] = elements,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  if (elements.length === 0) {
    return { valid: false, reason: "Select at least one purely quantum element." };
  }

  if (!elements.every(isGroupableQuantumElement)) {
    return { valid: false, reason: "Custom gates may only contain quantum gates, controls, and swaps." };
  }

  const relativeOperations = buildRelativeOperations(elements);
  if ("reason" in relativeOperations) {
    return { valid: false, reason: relativeOperations.reason };
  }

  const selectedIds = new Set(elements.map((element) => element.id));
  const minQubit = Math.min(...elements.map((element) => element.qubit));
  const maxQubit = Math.max(...elements.map((element) => element.qubit));
  const steps = new Set(elements.map((element) => element.step));

  // Grouping replaces the selection with one tall gate, so any remaining quantum
  // element inside that vertical span would overlap the resulting custom gate.
  const overlapsRemainingBlock = allElements.some((element) => {
    if (!steps.has(element.step) || selectedIds.has(element.id) || element.type === "cctrl") {
      return false;
    }

    return elementOccupiedQubits(element, customGateDefinitions).some(
      (qubit) => qubit >= minQubit && qubit <= maxQubit,
    );
  });

  if (overlapsRemainingBlock) {
    return { valid: false, reason: "Select the full quantum block before creating a custom gate." };
  }

  return { valid: true as const };
}

export function buildCustomGateDefinition(
  classifier: string,
  elements: GroupableElement[],
  id: number,
): CustomGateDefinition {
  const gates = buildRelativeOperations(elements);
  if ("reason" in gates) {
    throw new Error(gates.reason);
  }

  const { minQubit, maxQubit } = getOperationQubitBounds(gates);
  return {
    id,
    classifier,
    gates,
    minQubit,
    maxQubit,
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
    gates: definition.gates,
  }));
}

export function deserializeCustomGateDefinitions(
  definitions: SerializedCustomGateDefinition[] | undefined,
  makeId: () => number,
): CustomGateDefinition[] {
  return (definitions ?? []).map((definition) => {
    const { minQubit, maxQubit } = getOperationQubitBounds(definition.gates);
    return {
      id: makeId(),
      classifier: definition.classifier,
      gates: definition.gates,
      minQubit,
      maxQubit,
    };
  });
}

function buildRelativeOperations(
  elements: GroupableElement[],
): OperationDefinition[] | { reason: string } {
  const steps = [...new Set(elements.map((element) => element.step))].sort((a, b) => a - b);
  const minStep = Math.min(...steps);
  const minQubit = Math.min(...elements.map((element) => element.qubit));
  const operations: OperationDefinition[] = [];

  for (const step of steps) {
    const stepElements = elements.filter((element) => element.step === step);
    const ctrls = stepElements.filter(
      (element): element is Extract<GroupableElement, { type: "ctrl" }> => element.type === "ctrl",
    );
    const swaps = stepElements.filter(
      (element): element is Extract<GroupableElement, { type: "swap" }> => element.type === "swap",
    );
    const unitaryGates = stepElements.filter(
      (element): element is Extract<GroupableElement, { type: "unitary" }> => element.type === "unitary",
    );
    const controls = ctrls.map((element) => element.qubit - minQubit).sort((a, b) => a - b);
    const relativeStep = step - minStep;

    if (ctrls.length > 0 && unitaryGates.length + swaps.length === 0) {
      return { reason: "A custom gate step cannot consist only of control nodes." };
    }

    if (swaps.length !== 0 && swaps.length !== 2) {
      return { reason: "A custom gate step must contain either zero or exactly two swap nodes." };
    }

    for (const gate of unitaryGates) {
      operations.push({
        step: relativeStep,
        type: gate.kind,
        qubit: gate.qubit - minQubit,
        params: gate.params,
        controls: controls.length > 0 ? controls : undefined,
      });
    }

    if (swaps.length === 2) {
      operations.push({
        step: relativeStep,
        type: "SWAP",
        qubits: swaps.map((swap) => swap.qubit - minQubit).sort((a, b) => a - b),
        controls: controls.length > 0 ? controls : undefined,
      });
    }
  }

  return operations;
}

function getOperationQubitBounds(gates: OperationDefinition[]) {
  const qubits = gates.flatMap((gate) => [
    ...(gate.controls ?? []),
    ...(typeof gate.qubit === "number" ? [gate.qubit] : []),
    ...(gate.qubits ?? []),
  ]);

  return {
    minQubit: qubits.length > 0 ? Math.min(...qubits) : 0,
    maxQubit: qubits.length > 0 ? Math.max(...qubits) : 0,
  };
}
