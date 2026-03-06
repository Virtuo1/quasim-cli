import { GB, MIN_STEPS } from "../constants";
import type {
  CircuitElement,
  ClassicalRegister,
  ClassicalControlElement,
  CustomGateDefinition,
  MeasurementElement,
  QuantumConnectorLine,
  ResetElement,
  StepAnalysis,
} from "../types";
import { cregY, wireY } from "./layout";
import { customGateOccupiedQubits } from "./customGates";

export function compact(elements: CircuitElement[]) {
  if (elements.length === 0) {
    return { elements: [], nS: MIN_STEPS };
  }

  const occupiedSteps = [...new Set(elements.map((element) => element.step))].sort((a, b) => a - b);
  const stepMap: Record<number, number> = {};
  occupiedSteps.forEach((step, index) => {
    stepMap[step] = index;
  });

  const remapped = elements.map((element) => ({ ...element, step: stepMap[element.step] })) as CircuitElement[];
  return { elements: remapped, nS: Math.max(MIN_STEPS, occupiedSteps.length + 1) };
}

export function cellTaken(
  elements: CircuitElement[],
  step: number,
  qubit: number,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  return elements.some((element) => {
    if (element.step !== step) {
      return false;
    }

    if (element.type === "custom") {
      const definition = customGateDefinitions.find((candidate) => candidate.classifier === element.classifier);
      return customGateOccupiedQubits(element, definition).includes(qubit);
    }

    return "qubit" in element && element.qubit === qubit;
  });
}

export function analyzeStep(stepElements: CircuitElement[]): StepAnalysis {
  const swaps = stepElements.filter((element): element is Extract<CircuitElement, { type: "swap" }> => element.type === "swap");
  const ctrls = stepElements.filter((element): element is Extract<CircuitElement, { type: "ctrl" }> => element.type === "ctrl");
  const unitaryGates = stepElements.filter((element): element is Extract<CircuitElement, { type: "unitary" }> => element.type === "unitary");
  const measurements = stepElements.filter((element): element is MeasurementElement => element.type === "measurement");
  const resets = stepElements.filter((element): element is ResetElement => element.type === "reset");
  const customs = stepElements.filter((element): element is Extract<CircuitElement, { type: "custom" }> => element.type === "custom");
  const cctrl = stepElements.filter((element): element is Extract<CircuitElement, { type: "cctrl" }> => element.type === "cctrl");

  const classicalOps = measurements.length + resets.length;
  const swapError = swaps.length !== 0 && swaps.length !== 2;
  const ctrlOrphan = ctrls.length > 0 && unitaryGates.length + swaps.length + measurements.length + resets.length + customs.length === 0;
  const ctrlOnClassicalOp = ctrls.length > 0 && classicalOps > 0;
  const ctrlOnCustom = ctrls.length > 0 && customs.length > 0;
  const cctrlOrphan = cctrl.length > 0 && unitaryGates.length + swaps.length + measurements.length + resets.length + customs.length === 0;
  const cctrlMultiple = cctrl.length > 1;
  const measurementWithoutRegister = measurements.some((measurement) => !measurement.registerName);

  return {
    swaps,
    ctrls,
    unitaryGates,
    measurements,
    resets,
    customs,
    cctrl,
    swapError,
    ctrlOrphan,
    ctrlOnClassicalOp,
    ctrlOnCustom,
    cctrlOrphan,
    cctrlMultiple,
    measurementWithoutRegister,
    hasError:
      swapError ||
      ctrlOrphan ||
      ctrlOnClassicalOp ||
      ctrlOnCustom ||
      cctrlOrphan ||
      cctrlMultiple ||
      measurementWithoutRegister,
  };
}

export function getConnectorLines(stepElements: CircuitElement[]): QuantumConnectorLine[] {
  return getConnectorLinesWithCustoms(stepElements);
}

export function getConnectorLinesWithCustoms(
  stepElements: CircuitElement[],
  customGateDefinitions: CustomGateDefinition[] = [],
): QuantumConnectorLine[] {
  const { swaps, ctrls, unitaryGates, measurements, resets, customs, cctrl, swapError, ctrlOrphan, ctrlOnClassicalOp, ctrlOnCustom } =
    analyzeStep(stepElements);
  const lines: QuantumConnectorLine[] = [];
  const hasClassicalControl = cctrl.length > 0;

  if (ctrls.length > 0) {
    const allQuantumNodes = [...ctrls, ...unitaryGates, ...measurements, ...resets, ...swaps, ...customs];
    const occupiedQubits = allQuantumNodes.flatMap((element) => {
      if (element.type === "custom") {
        const definition = customGateDefinitions.find((candidate) => candidate.classifier === element.classifier);
        return customGateOccupiedQubits(element, definition);
      }
      return [element.qubit];
    });

    if (occupiedQubits.length > 0) {
      const minQubit = Math.min(...occupiedQubits);
      const maxQubit = Math.max(...occupiedQubits);
      const targetQubits = [
        ...unitaryGates.map((gate) => gate.qubit),
        ...measurements.map((measurement) => measurement.qubit),
        ...resets.map((reset) => reset.qubit),
        ...swaps.map((swap) => swap.qubit),
        ...customs.flatMap((custom) => {
          const definition = customGateDefinitions.find((candidate) => candidate.classifier === custom.classifier);
          return customGateOccupiedQubits(custom, definition);
        }),
      ];
      const topTargetQubit = targetQubits.length > 0 ? Math.min(...targetQubits) : maxQubit;

      if (hasClassicalControl && maxQubit > topTargetQubit) {
        lines.push({
          kind: "quantum",
          q1: minQubit,
          q2: topTargetQubit,
          error: ctrlOrphan || ctrlOnClassicalOp || ctrlOnCustom || swapError,
        });
        return lines;
      }

      lines.push({
        kind: "quantum",
        q1: minQubit,
        q2: maxQubit,
        error: ctrlOrphan || ctrlOnClassicalOp || ctrlOnCustom || swapError,
      });
    }
  } else if (swaps.length >= 2 && !hasClassicalControl) {
    const swapQubits = swaps.map((swap) => swap.qubit);
    lines.push({
      kind: "quantum",
      q1: Math.min(...swapQubits),
      q2: Math.max(...swapQubits),
      error: swapError,
    });
  }

  return lines;
}

export function measurementWireLine(
  measurement: MeasurementElement,
  classicalRegs: ClassicalRegister[],
  nQ: number,
) {
  const registerIndex = classicalRegs.findIndex((register) => register.name === measurement.registerName);
  if (registerIndex < 0) {
    return null;
  }

  return {
    x: measurement.step,
    y1: wireY(measurement.qubit) + GB / 2,
    y2: cregY(registerIndex, nQ) - 5,
  };
}

export function classicalControlWireLine(
  control: ClassicalControlElement,
  elements: CircuitElement[],
  nQ: number,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  const stepTargets = elements.filter(
    (element): element is Extract<CircuitElement, { type: "unitary" | "measurement" | "reset" | "swap" | "custom" }> =>
      element.step === control.step &&
      (element.type === "unitary" ||
        element.type === "measurement" ||
        element.type === "reset" ||
        element.type === "swap" ||
        element.type === "custom"),
  );
  if (stepTargets.length === 0) {
    return null;
  }

  const topTargetQubit = Math.min(
    ...stepTargets.flatMap((element) => {
      if (element.type === "custom") {
        const definition = customGateDefinitions.find((candidate) => candidate.classifier === element.classifier);
        return customGateOccupiedQubits(element, definition);
      }
      return [element.qubit];
    }),
  );
  return {
    y1: cregY(control.cregIdx, nQ) - 7,
    y2: wireY(topTargetQubit),
  };
}
