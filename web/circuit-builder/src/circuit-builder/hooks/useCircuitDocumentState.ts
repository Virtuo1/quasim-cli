import { useCallback, useEffect, useRef, useState } from "react";

import { MIN_STEPS } from "../constants";
import type {
  CanvasElement,
  ClassicalRegister,
  CustomGateDefinition,
  DebugClassicalRegisterValues,
  DebugStateVector,
} from "../types";
import { compact } from "../utils/circuit";
import type { CircuitDocumentStore, ElementUpdater } from "./circuitEditorTypes";

const USE_MOCK_DEBUG_STATE_VECTOR = true;

export function useCircuitDocumentState(): CircuitDocumentStore {
  const [nQ, setNQ] = useState(4);
  const [elements, setRawElements] = useState<CanvasElement[]>([]);
  const [nS, setNS] = useState(MIN_STEPS);
  const [classicalRegs, setCregs] = useState<ClassicalRegister[]>([]);
  const [customGateDefinitions, setCustomGateDefinitions] = useState<CustomGateDefinition[]>([]);
  const [newRegName, setNewRegName] = useState("");
  const [debugStateVector, setDebugStateVector] = useState<DebugStateVector | null>(null);
  const [debugClassicalRegisterValues, setDebugClassicalRegisterValues] = useState<DebugClassicalRegisterValues>({});

  const elementsRef = useSyncedRef(elements);
  const nQRef = useSyncedRef(nQ);
  const nSRef = useSyncedRef(nS);
  const classicalRegsRef = useSyncedRef(classicalRegs);
  const customGateDefinitionsRef = useSyncedRef(customGateDefinitions);

  useEffect(() => {
    if (USE_MOCK_DEBUG_STATE_VECTOR) {
      setDebugStateVector(createMockDebugStateVector(nQ));
      setDebugClassicalRegisterValues(createMockDebugClassicalRegisterValues(classicalRegs, nQ));
    }
  }, [classicalRegs, nQ]);

  const setElements = useCallback((updater: ElementUpdater) => {
    setRawElements((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const { elements: compacted, nS: newNS } = compact(next);
      setNS(newNS);
      return compacted;
    });
  }, []);

  return {
    nQ,
    nS,
    elements,
    classicalRegs,
    customGateDefinitions,
    newRegName,
    debugStateVector,
    debugClassicalRegisterValues,
    elementsRef,
    nQRef,
    nSRef,
    classicalRegsRef,
    customGateDefinitionsRef,
    setNQ,
    setNS,
    setElements,
    setCregs,
    setCustomGateDefinitions,
    setNewRegName,
    setDebugStateVector,
    setDebugClassicalRegisterValues,
  };
}

function useSyncedRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function createMockDebugStateVector(qubitCount: number): DebugStateVector {
  const amplitudeCount = 2 ** qubitCount;
  const amplitudes = Array.from({ length: amplitudeCount }, (_, index) => {
    const envelope = 0.18 + 0.82 * Math.abs(Math.sin(index * 0.17) * Math.cos(index * 0.043));
    const phase = index * 0.31;
    return {
      real: Math.cos(phase) * envelope,
      imag: Math.sin(phase) * envelope * 0.7,
    };
  });

  const norm = Math.sqrt(
    amplitudes.reduce((sum, amplitude) => sum + amplitude.real * amplitude.real + amplitude.imag * amplitude.imag, 0),
  );

  return {
    amplitudes: amplitudes.map((amplitude) => ({
      real: amplitude.real / norm,
      imag: amplitude.imag / norm,
    })),
  };
}

function createMockDebugClassicalRegisterValues(
  classicalRegs: ClassicalRegister[],
  qubitCount: number,
): DebugClassicalRegisterValues {
  return Object.fromEntries(
    classicalRegs.map((register, index) => [register.name, ((index + 1) * 3 + qubitCount) % 16]),
  );
}
