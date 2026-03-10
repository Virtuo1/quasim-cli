import type { UseCircuitEditorArgs, UseCircuitEditorResult } from "./circuitEditorTypes";
import { useCircuitDocumentState } from "./useCircuitDocumentState";
import { useCircuitEditorCommands } from "./useCircuitEditorCommands";
import { useCircuitEditorSelectors } from "./useCircuitEditorSelectors";
import { useCircuitUiState } from "./useCircuitUiState";

export function useCircuitEditor(args: UseCircuitEditorArgs): UseCircuitEditorResult {
  const document = useCircuitDocumentState();
  const ui = useCircuitUiState(args);
  const derived = useCircuitEditorSelectors({ document, ui });
  const actions = useCircuitEditorCommands(args, { document, ui });

  return {
    state: {
      nQ: document.nQ,
      nS: document.nS,
      elements: document.elements,
      classicalRegs: document.classicalRegs,
      customGateDefinitions: document.customGateDefinitions,
      newRegName: document.newRegName,
      debugStateVector: document.debugStateVector,
      selectedIds: ui.selectedIds,
      parameterModal: ui.parameterModal,
      classicalRegisterModal: ui.classicalRegisterModal,
      conditionModal: ui.conditionModal,
      assignModal: ui.assignModal,
      jumpModal: ui.jumpModal,
      hoveredJumpTargetStep: ui.hoveredJumpTargetStep,
      customGateModal: ui.customGateModal,
      dragGhost: ui.dragGhost,
      dropPreview: ui.dropPreview,
      draggingId: ui.draggingId,
      selectionBox: ui.selectionBox,
      ...derived,
    },
    actions,
  };
}
