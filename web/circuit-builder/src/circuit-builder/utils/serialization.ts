import type {
  CanvasElement,
  ClassicalRegister,
  CustomGateDefinition,
  OperationDefinition,
  SerializedCondition,
  SerializedCircuit,
} from "../types";
import { uid } from "./layout";
import { analyzeStep } from "./analysis";
import { deserializeCustomGateDefinitions, serializeCustomGateDefinitions } from "./customGates";
import { exprRegisters } from "./conditions";

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
  elements: CanvasElement[];
  customGateDefinitions: CustomGateDefinition[];
}) {
  const gates: OperationDefinition[] = [];
  const conditions: SerializedCondition[] = [];

  for (let step = 0; step < steps; step += 1) {
    const stepElements = elements.filter((element) => element.step === step);
    const analysis = analyzeStep(stepElements, customGateDefinitions);
    const { swaps, ctrls, unitaryGates, measurements, assigns, resets, jumps, customs, cctrl, ctrlOrphan, ctrlOnClassicalOp, ctrlOnCustom } = analysis;
    const controls =
      ctrlOrphan || ctrlOnClassicalOp || ctrlOnCustom
        ? []
        : ctrls.map((element) => element.qubit).sort((a, b) => a - b);
    const condition =
      cctrl.length > 0
        ? {
            step,
            expr: cctrl[0].condition,
          }
        : null;
    if (condition) {
      conditions.push(condition);
    }

    for (const gate of unitaryGates) {
      const operation: OperationDefinition = { step, type: gate.kind, qubit: gate.qubit };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (gate.params && gate.params.length > 0) {
        operation.params = gate.params;
      }
      gates.push(operation);
    }

    for (const measurement of measurements) {
      const operation: OperationDefinition = { step, type: "M", qubit: measurement.qubit };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (measurement.registerName) {
        operation.creg = measurement.registerName;
      }
      if (measurement.bitIndex != null) {
        operation.cregBit = measurement.bitIndex;
      }
      gates.push(operation);
    }

    for (const assign of assigns) {
      const operation: OperationDefinition = { step, type: "ASSIGN", qubit: assign.qubit, expr: assign.expr };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      if (assign.registerName) {
        operation.creg = assign.registerName;
      }
      gates.push(operation);
    }

    for (const reset of resets) {
      const operation: OperationDefinition = { step, type: "RESET", qubit: reset.qubit };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      gates.push(operation);
    }

    for (const jump of jumps) {
      if (jump.targetStep == null) {
        continue;
      }

      const operation: OperationDefinition = {
        step,
        type: "JUMP",
        targetStep: jump.targetStep,
      };
      gates.push(operation);
    }

    for (const custom of customs) {
      const operation: OperationDefinition = {
        step,
        type: "CUSTOM",
        classifier: custom.classifier,
        qubit: custom.qubit,
      };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      gates.push(operation);
    }

    if (swaps.length === 2) {
      const operation: OperationDefinition = {
        step,
        type: "SWAP",
        qubits: swaps.map((element) => element.qubit).sort((a, b) => a - b),
      };
      if (controls.length > 0) {
        operation.controls = controls;
      }
      gates.push(operation);
    }
  }

  const data: SerializedCircuit = {
    qubits,
    steps,
    classicalRegisters: classicalRegisters.map((register) => register.name),
    customGates: serializeCustomGateDefinitions(customGateDefinitions),
    instructions: gates,
    conditions,
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
  const elements: CanvasElement[] = [];
  const usedCtrls = new Set<string>();
  const usedCctrl = new Set<string>();

  for (const gate of raw.instructions ?? []) {
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
        bitIndex: typeof gate.cregBit === "number" ? gate.cregBit : null,
      });
    } else if (gate.type === "ASSIGN" && typeof gate.qubit === "number") {
      elements.push({
        id: uid(),
        type: "assign",
        step: gate.step,
        qubit: gate.qubit,
        registerName: gate.creg ?? null,
        expr: gate.expr ?? { Val: { Int: 0 } },
      });
    } else if (gate.type === "RESET" && typeof gate.qubit === "number") {
      elements.push({
        id: uid(),
        type: "reset",
        step: gate.step,
        qubit: gate.qubit,
      });
    } else if (gate.type === "JUMP") {
      elements.push({
        id: uid(),
        type: "jump",
        step: gate.step,
        targetStep: typeof gate.targetStep === "number" ? gate.targetStep : null,
      });
    } else if (
      gate.type !== "M" &&
      gate.type !== "ASSIGN" &&
      gate.type !== "RESET" &&
      gate.type !== "CUSTOM" &&
      typeof gate.qubit === "number"
    ) {
      elements.push({
        id: uid(),
        type: "unitary",
        kind: gate.type,
        step: gate.step,
        qubit: gate.qubit,
        params: gate.params,
      });
    }

    for (const controlQubit of gate.controls ?? []) {
      const key = `${gate.step}:${controlQubit}`;
      if (!usedCtrls.has(key)) {
        usedCtrls.add(key);
        elements.push({ id: uid(), type: "ctrl", step: gate.step, qubit: controlQubit });
      }
    }
  }

  for (const condition of raw.conditions ?? []) {
    const key = `${condition.step}:${JSON.stringify(condition.expr)}`;
    if (usedCctrl.has(key)) {
      continue;
    }

    usedCctrl.add(key);
    const conditionRegisters = exprRegisters(condition.expr);
    const regIndex = classicalRegs.findIndex((register) => register.name === conditionRegisters[0]);
    if (regIndex >= 0) {
      elements.push({
        id: uid(),
        type: "cctrl",
        step: condition.step,
        cregIdx: regIndex,
        condition: condition.expr,
      });
    }
  }

  return {
    nQ: raw.qubits ?? 4,
    classicalRegs,
    customGateDefinitions,
    elements,
  };
}
