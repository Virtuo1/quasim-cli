import { useMemo } from "react";

import type { CanvasElement, StepAnalysisMap } from "../types";
import { analyzeStep } from "../utils/circuit";
import { canCreateCustomGate } from "../utils/customGates";
import type { CircuitEditorDerivedState, CircuitEditorStores } from "./circuitEditorTypes";

export function useCircuitEditorSelectors({ document, ui }: CircuitEditorStores): CircuitEditorDerivedState {
  const customGateCreation = useMemo(() => {
    const selectedElements = document.elements.filter((element) => ui.selectedIds.includes(element.id));
    const validation = canCreateCustomGate(selectedElements, document.elements, document.customGateDefinitions);

    return {
      selectedElements,
      valid: validation.valid,
      reason: validation.valid ? null : validation.reason,
    };
  }, [document.customGateDefinitions, document.elements, ui.selectedIds]);

  const stepAnalysis = useMemo<StepAnalysisMap>(() => {
    const analysis: StepAnalysisMap = {};
    for (let step = 0; step < document.nS; step += 1) {
      analysis[step] = analyzeStep(
        document.elements.filter((element) => element.step === step),
        document.customGateDefinitions,
      );
    }
    return analysis;
  }, [document.customGateDefinitions, document.elements, document.nS]);

  const errorSteps = useMemo(
    () => Object.values(stepAnalysis).filter((analysis) => analysis.hasError).length,
    [stepAnalysis],
  );

  const selectedElement = useMemo(
    () => (ui.selectedIds.length === 1 ? document.elements.find((element) => element.id === ui.selectedIds[0]) ?? null : null),
    [document.elements, ui.selectedIds],
  );

  const parameterModalElement = useMemo(
    () => {
      const modal = ui.parameterModal;
      return modal
        ? document.elements.find(
            (element): element is Extract<CanvasElement, { type: "unitary" }> =>
              element.id === modal.id && element.type === "unitary",
          ) ?? null
        : null;
    },
    [document.elements, ui.parameterModal],
  );

  const classicalRegisterModalElement = useMemo(
    () => {
      const modal = ui.classicalRegisterModal;
      return modal
        ? document.elements.find(
            (element): element is Extract<CanvasElement, { type: "measurement" }> =>
              element.id === modal.elId && element.type === "measurement",
          ) ?? null
        : null;
    },
    [document.elements, ui.classicalRegisterModal],
  );

  const conditionModalElement = useMemo(
    () => {
      const modal = ui.conditionModal;
      return modal
        ? document.elements.find(
            (element): element is Extract<CanvasElement, { type: "cctrl" }> =>
              element.id === modal.elId && element.type === "cctrl",
          ) ?? null
        : null;
    },
    [document.elements, ui.conditionModal],
  );

  const assignModalElement = useMemo(
    () => {
      const modal = ui.assignModal;
      return modal
        ? document.elements.find(
            (element): element is Extract<CanvasElement, { type: "assign" }> =>
              element.id === modal.elId && element.type === "assign",
          ) ?? null
        : null;
    },
    [document.elements, ui.assignModal],
  );

  const jumpModalElement = useMemo(
    () => {
      const modal = ui.jumpModal;
      return modal
        ? document.elements.find(
            (element): element is Extract<CanvasElement, { type: "jump" }> =>
              element.id === modal.elId && element.type === "jump",
          ) ?? null
        : null;
    },
    [document.elements, ui.jumpModal],
  );

  return {
    selectedCount: ui.selectedIds.length,
    selectedElement,
    parameterModalElement,
    classicalRegisterModalElement,
    conditionModalElement,
    assignModalElement,
    jumpModalElement,
    customGateCreation,
    stepAnalysis,
    errorSteps,
  };
}
