import type {
  CircuitElement,
  ClassicalRegister,
  CustomGateDefinition,
  SerializedCircuit,
  SerializedGate,
} from "../types";
import { uid } from "./layout";
import { analyzeStep } from "./analysis";
import { deserializeCustomGateDefinitions, serializeCustomGateDefinitions } from "./customGates";

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
    const { swaps, ctrls, unitaryGates, measurements, resets, jumps, customs, cctrl, ctrlOrphan, ctrlOnClassicalOp, ctrlOnCustom } = analysis;
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
      if (gate.params && gate.params.length > 0) {
        operation.params = gate.params;
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

    for (const jump of jumps) {
      if (jump.targetStep == null) {
        continue;
      }

      const operation: SerializedGate = {
        step,
        type: "JUMP",
        targetStep: jump.targetStep,
      };
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
    } else if (gate.type === "JUMP") {
      elements.push({
        id: uid(),
        type: "jump",
        step: gate.step,
        targetStep: typeof gate.targetStep === "number" ? gate.targetStep : null,
      });
    } else if (
      gate.type !== "M" &&
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
