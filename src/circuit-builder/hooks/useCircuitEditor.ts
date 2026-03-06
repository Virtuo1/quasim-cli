import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { COND_OPS, MIN_STEPS } from "../constants";
import type {
  CircuitElement,
  ClassicalControlElement,
  ClassicalRegister,
  ClassicalRegisterModalState,
  ConditionModalState,
  CustomGateDefinition,
  CustomGateModalState,
  DragGhostState,
  DropPreview,
  GroupableElement,
  PaletteDragSpec,
  ParameterModalState,
  SelectionBox,
  SerializedCircuit,
  StepAnalysisMap,
} from "../types";
import { analyzeStep, cellTaken, compact, deserializeCircuit, exportCircuitToFile } from "../utils/circuit";
import { clientToCanvasHit, clientToSvgPoint, uid } from "../utils/layout";
import { gateSupportsParam } from "../constants";
import { normalizeSelectionBox, selectionHitsElement } from "../components/canvas/selection";
import {
  buildCustomGateDefinition,
  canCreateCustomGate,
  customGateSpan,
  findCustomGateDefinition,
  isGroupableQuantumElement,
} from "../utils/customGates";

interface UseCircuitEditorArgs {
  svgRef: React.RefObject<SVGSVGElement | null>;
  contRef: React.RefObject<HTMLDivElement | null>;
}

type ElementUpdater = CircuitElement[] | ((prev: CircuitElement[]) => CircuitElement[]);

export function useCircuitEditor({ svgRef, contRef }: UseCircuitEditorArgs) {
  const [nQ, setNQ] = useState(4);
  const [elements, setRawElements] = useState<CircuitElement[]>([]);
  const [nS, setNS] = useState(MIN_STEPS);
  const [classicalRegs, setCregs] = useState<ClassicalRegister[]>([]);
  const [customGateDefinitions, setCustomGateDefinitions] = useState<CustomGateDefinition[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [parameterModal, setParameterModal] = useState<ParameterModalState | null>(null);
  const [classicalRegisterModal, setClassicalRegisterModal] = useState<ClassicalRegisterModalState | null>(null);
  const [conditionModal, setConditionModal] = useState<ConditionModalState | null>(null);
  const [customGateModal, setCustomGateModal] = useState<CustomGateModalState | null>(null);
  const [newRegName, setNewRegName] = useState("");
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const elementsRef = useRef(elements);
  const nQRef = useRef(nQ);
  const nSRef = useRef(nS);
  const classicalRegsRef = useRef(classicalRegs);
  const customGateDefinitionsRef = useRef(customGateDefinitions);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    nQRef.current = nQ;
  }, [nQ]);

  useEffect(() => {
    nSRef.current = nS;
  }, [nS]);

  useEffect(() => {
    classicalRegsRef.current = classicalRegs;
  }, [classicalRegs]);

  useEffect(() => {
    customGateDefinitionsRef.current = customGateDefinitions;
  }, [customGateDefinitions]);

  useEffect(() => {
    contRef.current?.focus();
  }, [contRef]);

  const setElements = useCallback((updater: ElementUpdater) => {
    setRawElements((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const { elements: compacted, nS: newNS } = compact(next);
      setNS(newNS);
      return compacted;
    });
  }, []);

  const insertAtStep = useCallback(
    (current: CircuitElement[], insertStep: number) =>
      current.map((el) => (el.step >= insertStep ? { ...el, step: el.step + 1 } : el)),
    [],
  );

  const resolveCanvasHit = useCallback(
    (clientX: number, clientY: number) =>
      clientToCanvasHit(clientX, clientY, {
        svg: svgRef.current,
        nQ: nQRef.current,
        nS: nSRef.current,
        classicalRegs: classicalRegsRef.current,
      }),
    [svgRef],
  );

  const openConditionEditor = useCallback((elId: number) => {
    setConditionModal({ elId });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const getPlacementQubits = useCallback(
    (spec: PaletteDragSpec | CircuitElement, baseQubit: number) => {
      if ((spec.type === "custom")) {
        // Custom gates occupy a qubit span, so drag previews and collision checks
        // need the full footprint instead of just the anchor qubit.
        const definition = findCustomGateDefinition(spec.classifier, customGateDefinitionsRef.current);
        const span = customGateSpan(definition);
        return Array.from({ length: span }, (_, offset) => baseQubit + offset);
      }

      if ("qubit" in spec) {
        return [baseQubit];
      }

      return [baseQubit];
    },
    [],
  );

  const buildDropPreview = useCallback(
    (
      hit: ReturnType<typeof resolveCanvasHit>,
      spec: PaletteDragSpec | CircuitElement,
      draggedId?: number,
    ): DropPreview | null => {
      if (!hit) {
        return null;
      }

      if (hit.zone === "qubit") {
        const occupiedQubits = getPlacementQubits(spec, hit.qubit);
        const withinBounds = occupiedQubits.every((qubit) => qubit >= 0 && qubit < nQRef.current);

        if (hit.insertAt != null) {
          return {
            zone: "qubit",
            step: hit.insertAt,
            qubit: hit.qubit,
            insertAt: hit.insertAt,
            qubitSpan: occupiedQubits.length,
            valid: withinBounds,
          };
        }

        const others = draggedId == null
          ? elementsRef.current
          : elementsRef.current.filter((candidate) => candidate.id !== draggedId);
        const overlaps = occupiedQubits.some((qubit) =>
          cellTaken(others, hit.step, qubit, customGateDefinitionsRef.current),
        );

        return {
          zone: "qubit",
          step: hit.step,
          qubit: hit.qubit,
          qubitSpan: occupiedQubits.length,
          valid: withinBounds && !overlaps,
        };
      }

      // Only palette controls and existing classical controls can target a classical register lane.
      const acceptsClassicalControl = spec.type === "ctrl" || spec.type === "cctrl";
      if (!acceptsClassicalControl) {
        return null;
      }

      if (hit.insertAt != null) {
        return {
          zone: "creg",
          step: hit.insertAt,
          cregIdx: hit.cregIdx,
          cregName: hit.cregName,
          insertAt: hit.insertAt,
          valid: true,
        };
      }

      const others = draggedId == null
        ? elementsRef.current
        : elementsRef.current.filter((candidate) => candidate.id !== draggedId);
      const alreadyHas = others.some(
        (el) => el.type === "cctrl" && el.step === hit.step && el.cregIdx === hit.cregIdx,
      );

      return {
        zone: "creg",
        step: hit.step,
        cregIdx: hit.cregIdx,
        cregName: hit.cregName,
        valid: !alreadyHas,
      };
    },
    [getPlacementQubits, resolveCanvasHit],
  );

  const applyQubitDrop = useCallback(
    (preview: Extract<DropPreview, { zone: "qubit" }>, spec: PaletteDragSpec) => {
      const isMeasurement = spec.type === "gate" && spec.gateType === "M";
      const needsParam = spec.type === "gate" && gateSupportsParam(spec.gateType);
      const newStep = preview.insertAt ?? preview.step;
      const newElement: CircuitElement =
        spec.type === "gate"
          ? {
              id: uid(),
              type: "gate",
              gateType: spec.gateType,
              step: newStep,
              qubit: preview.qubit,
              param: needsParam ? 0 : undefined,
              creg: isMeasurement ? null : undefined,
            }
          : spec.type === "custom"
            ? {
                id: uid(),
                type: "custom",
                classifier: spec.classifier,
                step: newStep,
                qubit: preview.qubit,
              }
          : {
              id: uid(),
              type: spec.type,
              step: newStep,
              qubit: preview.qubit,
            };

      setElements((current) => {
        // Insertion works by shifting later columns first, then letting compaction normalize indices.
        const shifted = preview.insertAt != null ? insertAtStep(current, preview.insertAt) : current;
        return [...shifted, newElement];
      });

      if (isMeasurement) {
        if (classicalRegsRef.current.length > 0) {
          setElements((current) =>
            current.map((el) =>
              el.id === newElement.id && el.type === "gate"
                ? { ...el, creg: classicalRegsRef.current[0]?.name ?? null }
                : el,
            ),
          );
        }
        setClassicalRegisterModal({ elId: newElement.id });
      } else if (needsParam) {
        setParameterModal({ id: newElement.id, val: 0 });
      }
    },
    [insertAtStep, setElements],
  );

  const applyCregDrop = useCallback(
    (preview: Extract<DropPreview, { zone: "creg" }>) => {
      const newElement: ClassicalControlElement = {
        id: uid(),
        type: "cctrl",
        step: preview.insertAt ?? preview.step,
        cregIdx: preview.cregIdx,
        cregName: preview.cregName,
        op: "==",
        val: 0,
      };

      setElements((current) => {
        const shifted = preview.insertAt != null ? insertAtStep(current, preview.insertAt) : current;
        return [...shifted, newElement];
      });
      openConditionEditor(newElement.id);
    },
    [insertAtStep, openConditionEditor, setElements],
  );

  const startPaletteDrag = useCallback(
    (event: React.PointerEvent, spec: PaletteDragSpec) => {
      event.preventDefault();
      setDragGhost({ x: event.clientX, y: event.clientY, ...spec });

      // Preview generation is shared with element dragging so placement rules stay consistent.
      const getPreview = (clientX: number, clientY: number) => buildDropPreview(resolveCanvasHit(clientX, clientY), spec);

      const onMove = (moveEvent: PointerEvent) => {
        setDragGhost((current) => (current ? { ...current, x: moveEvent.clientX, y: moveEvent.clientY } : current));
        setDropPreview(getPreview(moveEvent.clientX, moveEvent.clientY));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const preview = getPreview(upEvent.clientX, upEvent.clientY);
        if (preview?.valid) {
          if (preview.zone === "creg") {
            applyCregDrop(preview);
          } else {
            applyQubitDrop(preview, spec);
          }
        }

        setDragGhost(null);
        setDropPreview(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [applyCregDrop, applyQubitDrop, buildDropPreview, resolveCanvasHit],
  );

  const createElementGhost = useCallback((element: CircuitElement, clientX: number, clientY: number): DragGhostState => {
    if (element.type === "gate") {
      return { x: clientX, y: clientY, type: "gate", gateType: element.gateType };
    }
    if (element.type === "swap") {
      return { x: clientX, y: clientY, type: "swap" };
    }
    if (element.type === "custom") {
      return { x: clientX, y: clientY, type: "custom", classifier: element.classifier };
    }
    return { x: clientX, y: clientY, type: "ctrl" };
  }, []);

  const moveExistingElement = useCallback(
    (elementId: number, preview: DropPreview) => {
      if (preview.zone === "creg") {
        if (preview.insertAt != null) {
          const insertStep = preview.insertAt;
          setElements((current) => {
            const movingEl = current.find(
              (el): el is Extract<CircuitElement, { type: "cctrl" }> => el.id === elementId && el.type === "cctrl",
            );
            if (!movingEl) {
              return current;
            }
            // Remove the moving element before shifting so the inserted column is based on the remaining circuit.
            const others = current.filter((el) => el.id !== elementId);
            const shifted = insertAtStep(others, insertStep);
            return [...shifted, { ...movingEl, step: insertStep, cregIdx: preview.cregIdx, cregName: preview.cregName }];
          });
          return;
        }

        setElements((current) =>
          current.map((el) =>
            el.id === elementId && el.type === "cctrl"
              ? { ...el, step: preview.step, cregIdx: preview.cregIdx, cregName: preview.cregName }
              : el,
          ),
        );
        return;
      }

      if (preview.insertAt != null) {
        const insertStep = preview.insertAt;
        setElements((current) => {
          const movingEl = current.find(
            (el): el is Exclude<CircuitElement, ClassicalControlElement> => el.id === elementId && el.type !== "cctrl",
          );
          if (!movingEl) {
            return current;
          }
          // Moving into a gap behaves like a remove-then-insert operation.
          const others = current.filter((el) => el.id !== elementId);
          const shifted = insertAtStep(others, insertStep);
          return [...shifted, { ...movingEl, step: insertStep, qubit: preview.qubit }];
        });
        return;
      }

      setElements((current) =>
        current.map((el) =>
          el.id === elementId && el.type !== "cctrl"
            ? { ...el, step: preview.step, qubit: preview.qubit }
            : el,
        ),
      );
    },
    [insertAtStep, setElements],
  );

  const startElementDrag = useCallback(
    (event: React.PointerEvent, elementId: number) => {
      event.preventDefault();
      event.stopPropagation();

      const element = elementsRef.current.find((candidate) => candidate.id === elementId);
      if (!element) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;
      let moving = false;
      const getPreview = (clientX: number, clientY: number) =>
        buildDropPreview(resolveCanvasHit(clientX, clientY), element, elementId);

      const onMove = (moveEvent: PointerEvent) => {
        if (!moving && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) {
          moving = true;
          setDraggingId(elementId);
          clearSelection();
        }

        if (!moving) {
          return;
        }

        setDragGhost(createElementGhost(element, moveEvent.clientX, moveEvent.clientY));
        setDropPreview(getPreview(moveEvent.clientX, moveEvent.clientY));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        if (!moving) {
          setSelectedIds((current) => (current.length === 1 && current[0] === elementId ? [] : [elementId]));
          return;
        }

        const preview = getPreview(upEvent.clientX, upEvent.clientY);
        if (preview?.valid) {
          moveExistingElement(elementId, preview);
        }

        setDragGhost(null);
        setDropPreview(null);
        setDraggingId(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [buildDropPreview, clearSelection, createElementGhost, moveExistingElement, resolveCanvasHit],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedIds.length > 0 &&
        !classicalRegisterModal &&
        !parameterModal &&
        !conditionModal
      ) {
        event.preventDefault();
        setElements((current) => current.filter((el) => !selectedIds.includes(el.id)));
        setSelectedIds([]);
      }

      if (event.key === "Escape") {
        clearSelection();
      }
    },
    [classicalRegisterModal, clearSelection, conditionModal, parameterModal, selectedIds, setElements],
  );

  const startCanvasSelection = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const target = event.target as Element | null;
      if (target?.closest(".gate-el")) {
        return;
      }

      const start = clientToSvgPoint(event.clientX, event.clientY, svgRef.current);
      if (!start) {
        clearSelection();
        return;
      }

      clearSelection();
      setSelectionBox({ x: start.x, y: start.y, width: 0, height: 0 });

      const onMove = (moveEvent: PointerEvent) => {
        const current = clientToSvgPoint(moveEvent.clientX, moveEvent.clientY, svgRef.current);
        if (!current) {
          return;
        }

        setSelectionBox(normalizeSelectionBox(start.x, start.y, current.x, current.y));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const end = clientToSvgPoint(upEvent.clientX, upEvent.clientY, svgRef.current);
        const box = end ? normalizeSelectionBox(start.x, start.y, end.x, end.y) : { x: start.x, y: start.y, width: 0, height: 0 };
        const nextSelectedIds =
          box.width < 4 && box.height < 4
            ? []
            : elementsRef.current
                .filter((element) =>
                  selectionHitsElement(box, element, nQRef.current, customGateDefinitionsRef.current),
                )
                .map((element) => element.id);

        setSelectedIds(nextSelectedIds);
        setSelectionBox(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clearSelection, svgRef],
  );

  const addRegister = useCallback(() => {
    const name = newRegName.trim();
    if (!name || classicalRegs.some((reg) => reg.name === name)) {
      return;
    }

    setCregs((current) => [...current, { id: uid(), name }]);
    setNewRegName("");
  }, [classicalRegs, newRegName]);

  const deleteRegister = useCallback(
    (regId: number) => {
      const reg = classicalRegs.find((entry) => entry.id === regId);
      if (!reg) {
        return;
      }

      const deletedIdx = classicalRegs.findIndex((entry) => entry.id === regId);
      setCregs((current) => current.filter((entry) => entry.id !== regId));
      setElements((current) =>
        current
          .filter((el) => !(el.type === "cctrl" && el.cregName === reg.name))
          .map((el) => {
            if (el.type === "cctrl" && el.cregIdx > deletedIdx) {
              return { ...el, cregIdx: el.cregIdx - 1 };
            }

            if (el.type === "gate" && el.gateType === "M" && el.creg === reg.name) {
              return { ...el, creg: null };
            }

            return el;
          }),
      );
    },
    [classicalRegs, setElements],
  );

  const addQubit = useCallback(() => {
    setNQ((current) => Math.min(current + 1, 20));
  }, []);

  const removeQubit = useCallback(() => {
    const next = nQ - 1;
    if (next < 1) {
      return;
    }

    setNQ(next);
    setElements((current) =>
      current.filter((el) => (el.type === "cctrl" ? true : el.qubit < next)),
    );
  }, [nQ, setElements]);

  const customGateCreation = useMemo(() => {
    const selectedElements = elements.filter((element) => selectedIds.includes(element.id));
    return {
      selectedElements,
      ...canCreateCustomGate(selectedElements, elements, customGateDefinitions),
    };
  }, [customGateDefinitions, elements, selectedIds]);

  const exportJSON = useCallback(() => {
    exportCircuitToFile({
      qubits: nQ,
      steps: nS,
      classicalRegisters: classicalRegs,
      customGateDefinitions,
      elements,
    });
  }, [classicalRegs, customGateDefinitions, elements, nQ, nS]);

  const importJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (changeEvent) => {
      const file = (changeEvent.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        try {
          const raw = JSON.parse(String(loadEvent.target?.result ?? "{}")) as SerializedCircuit;
          const next = deserializeCircuit(raw);
          setNQ(next.nQ);
          setCregs(next.classicalRegs);
          setCustomGateDefinitions(next.customGateDefinitions);
          setElements(next.elements);
          setSelectedIds([]);
        } catch {
          window.alert("Invalid circuit JSON.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setElements]);

  const clearCircuit = useCallback(() => {
    setElements([]);
    setCregs([]);
    setCustomGateDefinitions([]);
    setSelectedIds([]);
  }, [setElements]);

  const stepAnalysis = useMemo<StepAnalysisMap>(() => {
    const analysis: StepAnalysisMap = {};
    // Keep the expensive per-step validation derived from current editor state rather than duplicating it in events.
    for (let step = 0; step < nS; step += 1) {
      analysis[step] = analyzeStep(elements.filter((el) => el.step === step));
    }
    return analysis;
  }, [elements, nS]);

  const errorSteps = useMemo(
    () => Object.values(stepAnalysis).filter((analysis) => analysis.hasError).length,
    [stepAnalysis],
  );

  const selectedElement = useMemo(
    () => (selectedIds.length === 1 ? elements.find((el) => el.id === selectedIds[0]) ?? null : null),
    [elements, selectedIds],
  );

  const selectedCount = selectedIds.length;

  const parameterModalElement = useMemo(
    () =>
      parameterModal
        ? elements.find((el): el is Extract<CircuitElement, { type: "gate" }> => el.id === parameterModal.id && el.type === "gate") ?? null
        : null,
    [elements, parameterModal],
  );

  const classicalRegisterModalElement = useMemo(
    () =>
      classicalRegisterModal
        ? elements.find((el): el is Extract<CircuitElement, { type: "gate" }> => el.id === classicalRegisterModal.elId && el.type === "gate") ?? null
        : null,
    [classicalRegisterModal, elements],
  );

  const conditionModalElement = useMemo(
    () =>
      conditionModal
        ? elements.find((el): el is Extract<CircuitElement, { type: "cctrl" }> => el.id === conditionModal.elId && el.type === "cctrl") ?? null
        : null,
    [conditionModal, elements],
  );

  const assignMeasurementRegister = useCallback(
    (registerName: string) => {
      if (!classicalRegisterModal) {
        return;
      }
      setElements((current) =>
        current.map((el) =>
          el.id === classicalRegisterModal.elId && el.type === "gate" ? { ...el, creg: registerName } : el,
        ),
      );
      setClassicalRegisterModal(null);
    },
    [classicalRegisterModal, setElements],
  );

  const createRegisterAndAssign = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || classicalRegs.some((reg) => reg.name === trimmed) || !classicalRegisterModal) {
        return;
      }

      setCregs((current) => [...current, { id: uid(), name: trimmed }]);
      setElements((current) =>
        current.map((el) =>
          el.id === classicalRegisterModal.elId && el.type === "gate" ? { ...el, creg: trimmed } : el,
        ),
      );
      setClassicalRegisterModal(null);
    },
    [classicalRegisterModal, classicalRegs, setElements],
  );

  const applyCondition = useCallback(
    (op: (typeof COND_OPS)[number], val: number) => {
      if (!conditionModal) {
        return;
      }

      setElements((current) =>
        current.map((el) => (el.id === conditionModal.elId && el.type === "cctrl" ? { ...el, op, val } : el)),
      );
      setConditionModal(null);
    },
    [conditionModal, setElements],
  );

  const applyParameter = useCallback(() => {
    if (!parameterModal) {
      return;
    }

    setElements((current) =>
      current.map((el) =>
        el.id === parameterModal.id && el.type === "gate" ? { ...el, param: parameterModal.val } : el,
      ),
    );
    setParameterModal(null);
  }, [parameterModal, setElements]);

  const createCustomGate = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || customGateDefinitions.some((definition) => definition.classifier === trimmed)) {
        return;
      }

      const selectedElements = elements.filter(
        (element): element is GroupableElement =>
          selectedIds.includes(element.id) && isGroupableQuantumElement(element),
      );
      const validation = canCreateCustomGate(selectedElements, elements, customGateDefinitions);
      if (!validation.valid) {
        return;
      }

      const definition = buildCustomGateDefinition(trimmed, trimmed, selectedElements, uid());
      const instanceStep = Math.min(...selectedElements.map((element) => element.step));

      setCustomGateDefinitions((current) => [...current, definition]);
      setElements((current) => {
        const remaining = current.filter((element) => !selectedIds.includes(element.id));
        return [
          ...remaining,
          {
            id: uid(),
            type: "custom",
            classifier: definition.classifier,
            step: instanceStep,
            qubit: definition.minQubit,
          },
        ];
      });
      setSelectedIds([]);
      setCustomGateModal(null);
    },
    [customGateDefinitions, elements, selectedIds, setElements],
  );

  return {
    state: {
      nQ,
      nS,
      elements,
      classicalRegs,
      customGateDefinitions,
      selectedIds,
      selectedCount,
      selectedElement,
      parameterModal,
      parameterModalElement,
      classicalRegisterModal,
      classicalRegisterModalElement,
      conditionModal,
      conditionModalElement,
      customGateModal,
      customGateCreation,
      newRegName,
      dragGhost,
      dropPreview,
      draggingId,
      selectionBox,
      stepAnalysis,
      errorSteps,
    },
    actions: {
      setSelectedIds,
      clearSelection,
      setParameterModal,
      setClassicalRegisterModal,
      setConditionModal,
      setCustomGateModal,
      setNewRegName,
      handleKeyDown,
      startCanvasSelection,
      startPaletteDrag,
      startElementDrag,
      openConditionEditor,
      addRegister,
      deleteRegister,
      addQubit,
      removeQubit,
      exportJSON,
      importJSON,
      clearCircuit,
      assignMeasurementRegister,
      createRegisterAndAssign,
      applyCondition,
      applyParameter,
      createCustomGate,
      deleteSelected: (id: number) => {
        setElements((current) => current.filter((el) => el.id !== id));
        setSelectedIds([]);
      },
      deleteSelectedSet: () => {
        setElements((current) => current.filter((el) => !selectedIds.includes(el.id)));
        setSelectedIds([]);
      },
    },
  };
}
