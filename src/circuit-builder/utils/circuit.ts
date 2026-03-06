import { GB, MIN_STEPS } from "../constants";
import type {
  CircuitElement,
  ClassicalRegister,
  ClassicalControlElement,
  CustomGateDefinition,
  MeasurementElement,
  QuantumConnectorLine,
  ResetElement,
  SerializedCircuit,
  SerializedGate,
  StepAnalysis,
} from "../types";
import { cregY, uid, wireY } from "./layout";
import { customGateOccupiedQubits, deserializeCustomGateDefinitions, serializeCustomGateDefinitions } from "./customGates";

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
    const allQuantumNodes = [
      ...ctrls,
      ...unitaryGates,
      ...measurements,
      ...resets,
      ...swaps,
      ...customs,
    ];
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

export function exportCircuitToFile({
  qubits,
  steps,
  classicalRegisters,
  elements,
  customGateDefinitions,
}: {
  qubits: number;
  steps: number;
  classicalRegisters: ClassicalRegister[];
  elements: CircuitElement[];
  customGateDefinitions: CustomGateDefinition[];
}) {
  const gates: SerializedGate[] = [];

  for (let step = 0; step < steps; step += 1) {
    const stepElements = elements.filter((element) => element.step === step);
    const analysis = analyzeStep(stepElements);
    const { swaps, ctrls, unitaryGates, measurements, resets, customs, cctrl, ctrlOrphan, ctrlOnClassicalOp, ctrlOnCustom } = analysis;
    const controls =
      ctrlOrphan || ctrlOnClassicalOp || ctrlOnCustom
        ? []
        : ctrls.map((element) => element.qubit).sort((a, b) => a - b);
    const condition =
      cctrl.length > 0
        ? {
            reg: cctrl[0].condition.registerName,
            op: cctrl[0].condition.operator,
            val: cctrl[0].condition.value,
          }
        : null;

    for (const gate of unitaryGates) {
      const operation: SerializedGate = { step, type: gate.kind, qubit: gate.qubit };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (gate.param != null) {
        operation.param = gate.param;
      }
      if (condition) {
        operation.condition = condition;
      }
      gates.push(operation);
    }

    for (const measurement of measurements) {
      const operation: SerializedGate = { step, type: "M", qubit: measurement.qubit };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (measurement.registerName) {
        operation.creg = measurement.registerName;
      }
      if (condition) {
        operation.condition = condition;
      }
      gates.push(operation);
    }

    for (const reset of resets) {
      const operation: SerializedGate = { step, type: "RESET", qubit: reset.qubit };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (condition) {
        operation.condition = condition;
      }
      gates.push(operation);
    }

    for (const custom of customs) {
      const operation: SerializedGate = {
        step,
        type: "CUSTOM",
        classifier: custom.classifier,
        qubit: custom.qubit,
      };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (condition) {
        operation.condition = condition;
      }
      gates.push(operation);
    }

    if (swaps.length === 2) {
      const operation: SerializedGate = {
        step,
        type: "SWAP",
        qubits: swaps.map((element) => element.qubit).sort((a, b) => a - b),
      };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (condition) {
        operation.condition = condition;
      }
      gates.push(operation);
    }
  }

  const data: SerializedCircuit = {
    qubits,
    steps,
    classicalRegisters: classicalRegisters.map((register) => register.name),
    customGates: serializeCustomGateDefinitions(customGateDefinitions),
    gates,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "circuit.json";
  link.click();
  URL.revokeObjectURL(url);
}

export function deserializeCircuit(raw: SerializedCircuit) {
  const customGateDefinitions = deserializeCustomGateDefinitions(raw.customGates, uid);
  const classicalRegs = (raw.classicalRegisters ?? []).map((name) => ({ id: uid(), name }));
  const elements: CircuitElement[] = [];
  const usedCtrls = new Set<string>();
  const usedCctrl = new Set<string>();

  for (const gate of raw.gates ?? []) {
    if (gate.type === "SWAP") {
      for (const qubit of gate.qubits ?? []) {
        elements.push({ id: uid(), type: "swap", step: gate.step, qubit });
      }
    } else if (gate.type === "CUSTOM" && typeof gate.qubit === "number" && gate.classifier) {
      elements.push({
        id: uid(),
        type: "custom",
        classifier: gate.classifier,
        step: gate.step,
        qubit: gate.qubit,
      });
    } else if (gate.type === "M" && typeof gate.qubit === "number") {
      elements.push({
        id: uid(),
        type: "measurement",
        step: gate.step,
        qubit: gate.qubit,
        registerName: gate.creg ?? null,
      });
    } else if (gate.type === "RESET" && typeof gate.qubit === "number") {
      elements.push({
        id: uid(),
        type: "reset",
        step: gate.step,
        qubit: gate.qubit,
      });
    } else if (gate.type !== "M" && gate.type !== "RESET" && gate.type !== "CUSTOM" && typeof gate.qubit === "number") {
      elements.push({
        id: uid(),
        type: "unitary",
        kind: gate.type,
        step: gate.step,
        qubit: gate.qubit,
        param: gate.param,
      });
    }

    for (const controlQubit of gate.controls ?? []) {
      const key = `${gate.step}:${controlQubit}`;
      if (!usedCtrls.has(key)) {
        usedCtrls.add(key);
        elements.push({ id: uid(), type: "ctrl", step: gate.step, qubit: controlQubit });
      }
    }

    if (gate.condition) {
      const key = `${gate.step}:${gate.condition.reg}`;
      if (!usedCctrl.has(key)) {
        usedCctrl.add(key);
        const regIndex = classicalRegs.findIndex((register) => register.name === gate.condition?.reg);
        if (regIndex >= 0) {
          elements.push({
            id: uid(),
            type: "cctrl",
            step: gate.step,
            cregIdx: regIndex,
            condition: {
              kind: "comparison",
              registerName: gate.condition.reg,
              operator: gate.condition.op,
              value: gate.condition.val,
            },
          });
        }
      }
    }
  }

  return {
    nQ: raw.qubits ?? 4,
    classicalRegs,
    customGateDefinitions,
    elements,
  };
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
