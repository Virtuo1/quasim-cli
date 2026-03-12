import { useCallback, useEffect, useRef, useState } from "react";

import { MIN_STEPS } from "../constants";
import type {
  CanvasElement,
  ClassicalRegister,
  CustomGateDefinition,
  DebuggerState,
} from "../types";
import { compact } from "../utils/circuit";
import type { CircuitDocumentStore, ElementUpdater } from "./circuitEditorTypes";

export function useCircuitDocumentState(): CircuitDocumentStore {
  const [nQ, setNQ] = useState(4);
  const [elements, setRawElements] = useState<CanvasElement[]>([]);
  const [nS, setNS] = useState(MIN_STEPS);
  const [classicalRegs, setCregs] = useState<ClassicalRegister[]>([]);
  const [customGateDefinitions, setCustomGateDefinitions] = useState<CustomGateDefinition[]>([]);
  const [newRegName, setNewRegName] = useState("");
  const [debuggerState, setDebuggerState] = useState<DebuggerState>(createIdleDebuggerState());

  const elementsRef = useSyncedRef(elements);
  const nQRef = useSyncedRef(nQ);
  const nSRef = useSyncedRef(nS);
  const classicalRegsRef = useSyncedRef(classicalRegs);
  const customGateDefinitionsRef = useSyncedRef(customGateDefinitions);
  const debuggerRef = useSyncedRef(debuggerState);

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
    debugger: debuggerState,
    elementsRef,
    nQRef,
    nSRef,
    classicalRegsRef,
    customGateDefinitionsRef,
    debuggerRef,
    setNQ,
    setNS,
    setElements,
    setCregs,
    setCustomGateDefinitions,
    setNewRegName,
    setDebuggerState,
  };
}

function useSyncedRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}

function createIdleDebuggerState(): DebuggerState {
  return {
    sessionId: null,
    mode: "idle",
    pc: null,
    stateVector: null,
    debugClassicalRegisterValues: {},
    basisAmplitudeCache: {},
    error: null,
  };
}
