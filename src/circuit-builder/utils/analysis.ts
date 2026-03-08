import { GB, MAX_CREG_BIT_INDEX, MIN_STEPS } from "../constants";
import type {
  AssignElement,
  CircuitElement,
  ClassicalRegister,
  ClassicalControlElement,
  CustomGateDefinition,
  JumpElement,
  MeasurementElement,
  QuantumConnectorLine,
  ResetElement,
  StepAnalysis,
} from "../types";
import { exprRegisters, validateConditionExpression } from "./conditions";
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

  const remapped = elements.map((element) => {
    const nextStep = stepMap[element.step];
    if (element.type !== "jump" || element.targetStep == null) {
      return { ...element, step: nextStep };
    }

    // Jump targets refer to compacted column indices too, so column removal/insertion
    // needs to keep the target aligned with the current visible circuit.
    const targetStep = element.targetStep;
    const exactTarget = stepMap[targetStep];
    const compactedTarget =
      exactTarget ?? occupiedSteps.filter((step) => step < targetStep).length;
    return {
      ...element,
      step: nextStep,
      targetStep: Math.max(0, Math.min(compactedTarget, Math.max(occupiedSteps.length - 1, 0))),
    };
  }) as CircuitElement[];
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

    if (element.type === "jump") {
      return true;
    }

    return "qubit" in element && element.qubit === qubit;
  });
}

export function analyzeStep(
  stepElements: CircuitElement[],
  customGateDefinitions: CustomGateDefinition[] = [],
): StepAnalysis {
  const swaps = stepElements.filter((element): element is Extract<CircuitElement, { type: "swap" }> => element.type === "swap");
  const ctrls = stepElements.filter((element): element is Extract<CircuitElement, { type: "ctrl" }> => element.type === "ctrl");
  const unitaryGates = stepElements.filter((element): element is Extract<CircuitElement, { type: "unitary" }> => element.type === "unitary");
  const measurements = stepElements.filter((element): element is MeasurementElement => element.type === "measurement");
  const assigns = stepElements.filter((element): element is AssignElement => element.type === "assign");
  const resets = stepElements.filter((element): element is ResetElement => element.type === "reset");
  const jumps = stepElements.filter((element): element is JumpElement => element.type === "jump");
  const customs = stepElements.filter((element): element is Extract<CircuitElement, { type: "custom" }> => element.type === "custom");
  const cctrl = stepElements.filter((element): element is Extract<CircuitElement, { type: "cctrl" }> => element.type === "cctrl");

  const classicalOps = measurements.length + assigns.length + resets.length;
  const hasQuantumTargets = unitaryGates.length + swaps.length + measurements.length + assigns.length + resets.length + jumps.length + customs.length > 0;
  const swapError = swaps.length !== 0 && swaps.length !== 2;
  const ctrlOrphan = ctrls.length > 0 && !hasQuantumTargets;
  const ctrlOnClassicalOp = ctrls.length > 0 && classicalOps > 0;
  const ctrlOnCustom = ctrls.length > 0 && customs.length > 0;
  const overlapElementIds = findOverlappingElementIds(stepElements, customGateDefinitions);
  const overlapError = overlapElementIds.length > 0;
  const measurementBitConflictIds = findDuplicateMeasurementTargets(measurements);
  const measurementBitConflict = measurementBitConflictIds.length > 0;
  const registerWriteConflictIds = findRegisterWriteConflictIds(measurements, assigns);
  const registerWriteConflict = registerWriteConflictIds.length > 0;
  const jumpMixedColumn =
    jumps.length > 0 &&
    (jumps.length > 1 || stepElements.some((element) => element.type !== "jump" && element.type !== "cctrl"));
  const jumpWithoutTarget = jumps.some((jump) => jump.targetStep == null);
  const cctrlOrphan = cctrl.length > 0 && !hasQuantumTargets;
  const cctrlMultiple = cctrl.length > 1;
  const conditionInvalid = cctrl.some((control) => validateConditionExpression(control.condition).length > 0);
  const measurementWithoutTarget = measurements.some(
    (measurement) =>
      !measurement.registerName ||
      measurement.bitIndex == null ||
      measurement.bitIndex < 0 ||
      measurement.bitIndex > MAX_CREG_BIT_INDEX,
  );
  const assignWithoutRegister = assigns.some((assign) => !assign.registerName);

  return {
    swaps,
    ctrls,
    unitaryGates,
    measurements,
    assigns,
    resets,
    jumps,
    customs,
    cctrl,
    swapError,
    ctrlOrphan,
    ctrlOnClassicalOp,
    ctrlOnCustom,
    overlapError,
    overlapElementIds,
    measurementBitConflict,
    measurementBitConflictIds,
    registerWriteConflict,
    registerWriteConflictIds,
    jumpMixedColumn,
    jumpWithoutTarget,
    cctrlOrphan,
    cctrlMultiple,
    conditionInvalid,
    measurementWithoutTarget,
    assignWithoutRegister,
    hasError:
      swapError ||
      ctrlOrphan ||
      ctrlOnClassicalOp ||
      ctrlOnCustom ||
      overlapError ||
      measurementBitConflict ||
      registerWriteConflict ||
      jumpMixedColumn ||
      jumpWithoutTarget ||
      cctrlOrphan ||
      cctrlMultiple ||
      conditionInvalid ||
      measurementWithoutTarget ||
      assignWithoutRegister,
  };
}

function findDuplicateMeasurementTargets(measurements: MeasurementElement[]) {
  const targets = new Map<string, number[]>();

  for (const measurement of measurements) {
    if (!measurement.registerName || measurement.bitIndex == null) {
      continue;
    }

    const key = `${measurement.registerName}:${measurement.bitIndex}`;
    const existing = targets.get(key) ?? [];
    existing.push(measurement.id);
    targets.set(key, existing);
  }

  return Array.from(targets.values())
    .filter((ids) => ids.length > 1)
    .flat();
}

function findRegisterWriteConflictIds(measurements: MeasurementElement[], assigns: AssignElement[]) {
  const assignsByRegister = new Map<string, number[]>();

  for (const assign of assigns) {
    if (!assign.registerName) {
      continue;
    }

    const existing = assignsByRegister.get(assign.registerName) ?? [];
    existing.push(assign.id);
    assignsByRegister.set(assign.registerName, existing);
  }

  const conflictingIds = new Set<number>();

  for (const measurement of measurements) {
    if (!measurement.registerName) {
      continue;
    }

    const conflictingAssignIds = assignsByRegister.get(measurement.registerName);
    if (!conflictingAssignIds) {
      continue;
    }

    conflictingIds.add(measurement.id);
    conflictingAssignIds.forEach((id) => conflictingIds.add(id));
  }

  return [...conflictingIds];
}

export function getConnectorLines(stepElements: CircuitElement[]): QuantumConnectorLine[] {
  return getConnectorLinesWithCustoms(stepElements);
}

export function getConnectorLinesWithCustoms(
  stepElements: CircuitElement[],
  customGateDefinitions: CustomGateDefinition[] = [],
): QuantumConnectorLine[] {
  const { swaps, ctrls, unitaryGates, measurements, assigns, resets, customs, cctrl, swapError, ctrlOrphan, ctrlOnClassicalOp, ctrlOnCustom, overlapError } =
    analyzeStep(stepElements, customGateDefinitions);
  const lines: QuantumConnectorLine[] = [];
  const hasClassicalControl = cctrl.length > 0;

  if (ctrls.length > 0) {
    const allQuantumNodes = [...ctrls, ...unitaryGates, ...measurements, ...assigns, ...resets, ...swaps, ...customs];
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
        ...assigns.map((assign) => assign.qubit),
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
          error: ctrlOrphan || ctrlOnClassicalOp || ctrlOnCustom || swapError || overlapError,
        });
        return lines;
      }

      lines.push({
        kind: "quantum",
        q1: minQubit,
        q2: maxQubit,
        error: ctrlOrphan || ctrlOnClassicalOp || ctrlOnCustom || swapError || overlapError,
      });
    }
  } else if (swaps.length >= 2 && !hasClassicalControl) {
    const swapQubits = swaps.map((swap) => swap.qubit);
    lines.push({
      kind: "quantum",
      q1: Math.min(...swapQubits),
      q2: Math.max(...swapQubits),
      error: swapError || overlapError,
    });
  }

  return lines;
}

export function measurementWireLine(
  measurement: MeasurementElement | AssignElement,
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
  classicalRegs: ClassicalRegister[],
  nQ: number,
  customGateDefinitions: CustomGateDefinition[] = [],
) {
  const stepTargets = elements.filter(
    (element): element is Extract<CircuitElement, { type: "unitary" | "measurement" | "assign" | "reset" | "swap" | "jump" | "custom" }> =>
      element.step === control.step &&
      (element.type === "unitary" ||
        element.type === "measurement" ||
        element.type === "assign" ||
        element.type === "reset" ||
        element.type === "swap" ||
        element.type === "jump" ||
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
      if (element.type === "jump") {
        return [0];
      }
      return [element.qubit];
    }),
  );
  const referencedRegisterIndices = exprRegisters(control.condition)
    .map((registerName) => classicalRegs.findIndex((register) => register.name === registerName))
    .filter((index): index is number => index >= 0)
    .sort((a, b) => a - b);
  const registerIndices =
    referencedRegisterIndices.length > 0
      ? referencedRegisterIndices
      : [control.cregIdx];

  return {
    registerIndices,
    y1: cregY(Math.max(...registerIndices), nQ) - 7,
    y2: wireY(topTargetQubit),
  };
}

function findOverlappingElementIds(
  stepElements: CircuitElement[],
  customGateDefinitions: CustomGateDefinition[],
) {
  const occupiedByQubit = new Map<number, number[]>();

  for (const element of stepElements) {
    if (element.type === "cctrl") {
      continue;
    }

    const occupiedQubits =
      element.type === "custom"
        ? customGateOccupiedQubits(
            element,
            customGateDefinitions.find((candidate) => candidate.classifier === element.classifier),
          )
        : element.type === "jump"
          ? []
          : [element.qubit];

    for (const qubit of occupiedQubits) {
      const existing = occupiedByQubit.get(qubit) ?? [];
      existing.push(element.id);
      occupiedByQubit.set(qubit, existing);
    }
  }

  return [...occupiedByQubit.values()].filter((ids) => ids.length > 1).flat();
}
