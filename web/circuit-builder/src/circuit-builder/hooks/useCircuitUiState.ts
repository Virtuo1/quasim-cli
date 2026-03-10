import { useEffect, useState } from "react";

import type {
  AssignModalState,
  ClassicalRegisterModalState,
  ConditionModalState,
  CustomGateModalState,
  DragGhostState,
  DropPreview,
  JumpModalState,
  ParameterModalState,
  SelectionBox,
} from "../types";
import type { CircuitUiStore, UseCircuitEditorArgs } from "./circuitEditorTypes";

export function useCircuitUiState({ contRef }: UseCircuitEditorArgs): CircuitUiStore {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [parameterModal, setParameterModal] = useState<ParameterModalState | null>(null);
  const [classicalRegisterModal, setClassicalRegisterModal] = useState<ClassicalRegisterModalState | null>(null);
  const [conditionModal, setConditionModal] = useState<ConditionModalState | null>(null);
  const [assignModal, setAssignModal] = useState<AssignModalState | null>(null);
  const [jumpModal, setJumpModal] = useState<JumpModalState | null>(null);
  const [hoveredJumpTargetStep, setHoveredJumpTargetStep] = useState<number | null>(null);
  const [customGateModal, setCustomGateModal] = useState<CustomGateModalState | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  useEffect(() => {
    contRef.current?.focus();
  }, [contRef]);

  return {
    selectedIds,
    parameterModal,
    classicalRegisterModal,
    conditionModal,
    assignModal,
    jumpModal,
    hoveredJumpTargetStep,
    customGateModal,
    dragGhost,
    dropPreview,
    draggingId,
    selectionBox,
    setSelectedIds,
    setParameterModal,
    setClassicalRegisterModal,
    setConditionModal,
    setAssignModal,
    setJumpModal,
    setHoveredJumpTargetStep,
    setCustomGateModal,
    setDragGhost,
    setDropPreview,
    setDraggingId,
    setSelectionBox,
  };
}
