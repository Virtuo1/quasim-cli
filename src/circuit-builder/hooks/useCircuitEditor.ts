import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { COND_OPS, MIN_STEPS } from "../constants";
import type {
  CircuitElement,
  ClassicalControlElement,
  ClassicalRegister,
  ClassicalRegisterModalState,
  ConditionModalState,
  DragGhostState,
  DropPreview,
  PaletteDragSpec,
  ParameterModalState,
  SerializedCircuit,
  StepAnalysisMap,
} from "../types";
import { analyzeStep, cellTaken, compact, deserializeCircuit, exportCircuitToFile } from "../utils/circuit";
import { clientToCanvasHit, uid } from "../utils/layout";
import { gateSupportsParam } from "../constants";

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [parameterModal, setParameterModal] = useState<ParameterModalState | null>(null);
  const [classicalRegisterModal, setClassicalRegisterModal] = useState<ClassicalRegisterModalState | null>(null);
  const [conditionModal, setConditionModal] = useState<ConditionModalState | null>(null);
  const [newRegName, setNewRegName] = useState("");
  const [dragGhost, setDragGhost] = useState<DragGhostState | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const elementsRef = useRef(elements);
  const nQRef = useRef(nQ);
  const nSRef = useRef(nS);
  const classicalRegsRef = useRef(classicalRegs);

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
        if (hit.insertAt != null) {
          return {
            zone: "qubit",
            step: hit.insertAt,
            qubit: hit.qubit,
            insertAt: hit.insertAt,
            valid: true,
          };
        }

        const others = draggedId == null
          ? elementsRef.current
          : elementsRef.current.filter((candidate) => candidate.id !== draggedId);

        return {
          zone: "qubit",
          step: hit.step,
          qubit: hit.qubit,
          valid: !cellTaken(others, hit.step, hit.qubit),
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
    [resolveCanvasHit],
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
          setSelectedId(null);
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
          setSelectedId((current) => (current === elementId ? null : elementId));
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
    [buildDropPreview, createElementGhost, moveExistingElement, resolveCanvasHit],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedId &&
        !classicalRegisterModal &&
        !parameterModal &&
        !conditionModal
      ) {
        event.preventDefault();
        setElements((current) => current.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      }

      if (event.key === "Escape") {
        setSelectedId(null);
      }
    },
    [classicalRegisterModal, conditionModal, parameterModal, selectedId, setElements],
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

  const exportJSON = useCallback(() => {
    exportCircuitToFile({
      qubits: nQ,
      steps: nS,
      classicalRegisters: classicalRegs,
      elements,
    });
  }, [classicalRegs, elements, nQ, nS]);

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
          setElements(next.elements);
          setSelectedId(null);
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
    setSelectedId(null);
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
    () => (selectedId ? elements.find((el) => el.id === selectedId) ?? null : null),
    [elements, selectedId],
  );

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

  return {
    state: {
      nQ,
      nS,
      elements,
      classicalRegs,
      selectedId,
      selectedElement,
      parameterModal,
      parameterModalElement,
      classicalRegisterModal,
      classicalRegisterModalElement,
      conditionModal,
      conditionModalElement,
      newRegName,
      dragGhost,
      dropPreview,
      draggingId,
      stepAnalysis,
      errorSteps,
    },
    actions: {
      setSelectedId,
      setParameterModal,
      setClassicalRegisterModal,
      setConditionModal,
      setNewRegName,
      handleKeyDown,
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
      deleteSelected: (id: number) => {
        setElements((current) => current.filter((el) => el.id !== id));
        setSelectedId(null);
      },
    },
  };
}
