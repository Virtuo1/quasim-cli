import { GB, MIN_STEPS } from "../constants";
import type {
  CircuitElement,
  ClassicalRegister,
  ClassicalControlElement,
  QuantumConnectorLine,
  SerializedCircuit,
  SerializedGate,
  StepAnalysis,
} from "../types";
import { cregY, uid, wireY } from "./layout";

export function compact(elements: CircuitElement[]) {
  if (elements.length === 0) {
    return { elements: [], nS: MIN_STEPS };
  }

  const occupied = [...new Set(elements.map((element) => element.step))].sort((a, b) => a - b);
  const map: Record<number, number> = {};
  occupied.forEach((step, index) => {
    map[step] = index;
  });

  const remapped = elements.map((element) => ({ ...element, step: map[element.step] })) as CircuitElement[];
  return { elements: remapped, nS: Math.max(MIN_STEPS, occupied.length + 1) };
}

export function cellTaken(elements: CircuitElement[], step: number, qubit: number) {
  return elements.some((element) => "qubit" in element && element.step === step && element.qubit === qubit);
}

export function analyzeStep(stepEls: CircuitElement[]): StepAnalysis {
  const swaps = stepEls.filter((el): el is Extract<CircuitElement, { type: "swap" }> => el.type === "swap");
  const ctrls = stepEls.filter((el): el is Extract<CircuitElement, { type: "ctrl" }> => el.type === "ctrl");
  const gates = stepEls.filter((el): el is Extract<CircuitElement, { type: "gate" }> => el.type === "gate");
  const cctrl = stepEls.filter((el): el is Extract<CircuitElement, { type: "cctrl" }> => el.type === "cctrl");

  const swapError = swaps.length !== 0 && swaps.length !== 2;
  const ctrlOrphan = ctrls.length > 0 && gates.length + swaps.length === 0;
  const ctrlOnMeas = ctrls.length > 0 && gates.some((gate) => gate.gateType === "M");
  const cctrlOrphan = cctrl.length > 0 && gates.length + swaps.length === 0;
  const measNoReg = gates.some((gate) => gate.gateType === "M" && !gate.creg);

  return {
    swaps,
    ctrls,
    gates,
    cctrl,
    swapError,
    ctrlOrphan,
    ctrlOnMeas,
    cctrlOrphan,
    measNoReg,
    hasError: swapError || ctrlOrphan || ctrlOnMeas || cctrlOrphan || measNoReg,
  };
}

export function getConnectorLines(stepEls: CircuitElement[]): QuantumConnectorLine[] {
  const { swaps, ctrls, gates, cctrl, swapError, ctrlOrphan, ctrlOnMeas } = analyzeStep(stepEls);
  const lines: QuantumConnectorLine[] = [];
  const hasCctrl = cctrl.length > 0;

  if (ctrls.length > 0) {
    const all = [
      ...ctrls,
      ...stepEls.filter((el): el is Extract<CircuitElement, { type: "gate" | "swap" }> => el.type === "gate" || el.type === "swap"),
    ];
    const qs = all.map((el) => el.qubit);
    if (qs.length > 0) {
      const minQ = Math.min(...qs);
      const maxQ = Math.max(...qs);
      const topTargetQ =
        gates.length > 0
          ? Math.min(...gates.map((gate) => gate.qubit))
          : swaps.length > 0
            ? Math.min(...swaps.map((swap) => swap.qubit))
            : maxQ;

      if (hasCctrl && maxQ > topTargetQ) {
        lines.push({
          kind: "quantum",
          q1: minQ,
          q2: topTargetQ,
          error: ctrlOrphan || ctrlOnMeas || swapError,
        });
        return lines;
      }

      lines.push({
        kind: "quantum",
        q1: minQ,
        q2: maxQ,
        error: ctrlOrphan || ctrlOnMeas || swapError,
      });
    }
  } else if (swaps.length >= 2 && !hasCctrl) {
    const qs = swaps.map((swap) => swap.qubit);
    lines.push({
      kind: "quantum",
      q1: Math.min(...qs),
      q2: Math.max(...qs),
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
}: {
  qubits: number;
  steps: number;
  classicalRegisters: ClassicalRegister[];
  elements: CircuitElement[];
}) {
  const gates: SerializedGate[] = [];

  for (let step = 0; step < steps; step += 1) {
    const stepEls = elements.filter((el) => el.step === step);
    const { swaps, ctrls, gates: stepGates, cctrl } = analyzeStep(stepEls);
    const controls = ctrls.map((el) => el.qubit).sort((a, b) => a - b);
    const condition =
      cctrl.length > 0
        ? { reg: cctrl[0].cregName, op: cctrl[0].op, val: cctrl[0].val }
        : null;

    for (const gate of stepGates) {
      const op: SerializedGate = { step, type: gate.gateType, qubit: gate.qubit };
      if (controls.length) {
        op.controls = controls;
      }
      if (gate.param != null) {
        op.param = gate.param;
      }
      if (gate.gateType === "M" && gate.creg) {
        op.creg = gate.creg;
      }
      if (condition) {
        op.condition = condition;
      }
      gates.push(op);
    }

    if (swaps.length === 2) {
      const op: SerializedGate = {
        step,
        type: "SWAP",
        qubits: swaps.map((el) => el.qubit).sort((a, b) => a - b),
      };
      if (controls.length) {
        op.controls = controls;
      }
      if (condition) {
        op.condition = condition;
      }
      gates.push(op);
    }
  }

  const data: SerializedCircuit = {
    qubits,
    steps,
    classicalRegisters: classicalRegisters.map((reg) => reg.name),
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
  const classicalRegs = (raw.classicalRegisters ?? []).map((name) => ({ id: uid(), name }));
  const elements: CircuitElement[] = [];
  const usedCtrls = new Set<string>();
  const usedCctrl = new Set<string>();

  for (const gate of raw.gates ?? []) {
    if (gate.type === "SWAP") {
      for (const qubit of gate.qubits ?? []) {
        elements.push({ id: uid(), type: "swap", step: gate.step, qubit });
      }
    } else if (typeof gate.qubit === "number") {
      elements.push({
        id: uid(),
        type: "gate",
        gateType: gate.type,
        step: gate.step,
        qubit: gate.qubit,
        param: gate.param,
        creg: gate.creg ?? (gate.type === "M" ? null : undefined),
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
        const regIndex = classicalRegs.findIndex((reg) => reg.name === gate.condition?.reg);
        if (regIndex >= 0) {
          elements.push({
            id: uid(),
            type: "cctrl",
            step: gate.step,
            cregIdx: regIndex,
            cregName: gate.condition.reg,
            op: gate.condition.op,
            val: gate.condition.val,
          });
        }
      }
    }
  }

  return {
    nQ: raw.qubits ?? 4,
    classicalRegs,
    elements,
  };
}

export function measurementWireLine(
  gate: Extract<CircuitElement, { type: "gate" }>,
  classicalRegs: ClassicalRegister[],
  nQ: number,
) {
  const regIdx = classicalRegs.findIndex((reg) => reg.name === gate.creg);
  if (regIdx < 0) {
    return null;
  }

  return {
    x: gate.step,
    y1: wireY(gate.qubit) + GB / 2,
    y2: cregY(regIdx, nQ) - 5,
  };
}

export function classicalControlWireLine(control: ClassicalControlElement, elements: CircuitElement[], nQ: number) {
  const stepGates = elements.filter(
    (el): el is Extract<CircuitElement, { type: "gate" | "swap" }> =>
      el.step === control.step && (el.type === "gate" || el.type === "swap"),
  );
  if (stepGates.length === 0) {
    return null;
  }

  const topQ = Math.min(...stepGates.map((el) => el.qubit));
  return {
    y1: cregY(control.cregIdx, nQ) - 7,
    y2: wireY(topQ),
  };
}
