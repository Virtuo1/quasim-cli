import { useCallback, useRef } from "react";

import { normalizeSelectionBox, selectionHitsElement } from "../components/canvas/selection";
import type {
  CanvasElement,
  ClassicalControlElement,
  DebuggerState,
  DropPreview,
  PaletteDragSpec,
  SerializedCircuit,
} from "../types";
import { createDefaultConditionExpression, exprRegisters, rebindConditionAnchor } from "../utils/conditions";
import { cellTaken, deserializeCircuit, exportCircuitToFile, serializeCircuit } from "../utils/circuit";
import {
  buildCustomGateDefinition,
  canCreateCustomGate,
  customGateSpan,
  elementOccupiedQubits,
  findCustomGateDefinition,
  isGroupableQuantumElement,
} from "../utils/customGates";
import { clientToCanvasHit, clientToSvgPoint, uid } from "../utils/layout";
import {
  createClassicalControlElement,
  createDragGhostFromElement,
  createElementFromPalette,
} from "./editorHelpers";
import type { CircuitEditorActions, CircuitEditorStores, UseCircuitEditorArgs } from "./circuitEditorTypes";
import {
  buildDebugSession as buildDebugSessionRequest,
  continueDebugSession as continueDebugSessionRequest,
  fetchDebugSessionBasisAmplitude,
  fetchDebugSessionRegisters,
  fetchDebugSessionState,
  fetchDebugSessionStateVector,
  nextDebugSession as nextDebugSessionRequest,
} from "../utils/api";

export function useCircuitEditorCommands(
  { svgRef }: UseCircuitEditorArgs,
  stores: CircuitEditorStores,
): CircuitEditorActions {
  const { document: doc, ui } = stores;
  const basisAmplitudeRequestsRef = useRef(new Set<number>());

  const createIdleDebuggerState = useCallback(
    (): DebuggerState => ({
      sessionId: null,
      mode: "idle",
      pc: null,
      stateVector: null,
      debugClassicalRegisterValues: {},
      basisAmplitudeCache: {},
      error: null,
    }),
    [],
  );

  const setDebuggerMode = useCallback((mode: DebuggerState["mode"]) => {
    doc.setDebuggerState((current) => ({ ...current, mode }));
  }, [doc]);

  const setDebuggerError = useCallback((error: string | null, mode: DebuggerState["mode"] = "error") => {
    doc.setDebuggerState((current) => ({ ...current, error, mode }));
  }, [doc]);

  const resetDebuggerSession = useCallback(() => {
    basisAmplitudeRequestsRef.current.clear();
    doc.setDebuggerState(createIdleDebuggerState());
  }, [createIdleDebuggerState, doc]);

  const resetUiState = useCallback(() => {
    ui.setSelectedIds([]);
    ui.setParameterModal(null);
    ui.setClassicalRegisterModal(null);
    ui.setConditionModal(null);
    ui.setAssignModal(null);
    ui.setJumpModal(null);
    ui.setHoveredJumpTargetStep(null);
    ui.setCustomGateModal(null);
    ui.setDragGhost(null);
    ui.setDropPreview(null);
    ui.setDraggingId(null);
    ui.setSelectionBox(null);
  }, [ui]);

  const clearSelection = useCallback(() => {
    ui.setSelectedIds([]);
  }, [ui]);

  const insertAtStep = useCallback(
    (current: CanvasElement[], insertStep: number) =>
      current.map((element) => ({
        ...element,
        step: element.step >= insertStep ? element.step + 1 : element.step,
        ...(element.type === "jump" && element.targetStep != null && element.targetStep >= insertStep
          ? { targetStep: element.targetStep + 1 }
          : {}),
      })),
    [],
  );

  const resolveCanvasHit = useCallback(
    (clientX: number, clientY: number) =>
      clientToCanvasHit(clientX, clientY, {
        svg: svgRef.current,
        nQ: doc.nQRef.current,
        nS: doc.nSRef.current,
        classicalRegs: doc.classicalRegsRef.current,
      }),
    [doc.classicalRegsRef, doc.nQRef, doc.nSRef, svgRef],
  );

  const openConditionEditor = useCallback((elId: number) => {
    ui.setConditionModal({ elId });
  }, [ui]);

  const openJumpTargetEditor = useCallback((elId: number, suggestedStep?: number | null) => {
    ui.setJumpModal({ elId });
    ui.setHoveredJumpTargetStep(suggestedStep ?? null);
  }, [ui]);

  const fetchStateVectorForMode = useCallback(
    async (sessionId: string, mode: "state" | "sorted") => {
      if (mode === "sorted") {
        return fetchDebugSessionStateVector(sessionId, { topN: 32 });
      }

      return fetchDebugSessionStateVector(sessionId, { nonzero: false });
    },
    [],
  );

  const refreshDebugSessionBySessionId = useCallback(async (sessionId: string) => {
    try {
      const [stateResponse, registersResponse, stateVectorResponse] = await Promise.all([
        fetchDebugSessionState(sessionId),
        fetchDebugSessionRegisters(sessionId),
        fetchStateVectorForMode(sessionId, ui.debugViewMode),
      ]);

      doc.setDebuggerState((current) => {
        const nextBasisAmplitudeCache = { ...current.basisAmplitudeCache };
        for (const entry of stateVectorResponse.amplitudes) {
          nextBasisAmplitudeCache[entry.basis] = entry.amplitude;
        }

        return {
          ...current,
          sessionId,
          mode: "ready",
          pc: stateResponse.pc,
          stateVector: stateVectorResponse,
          debugClassicalRegisterValues: registersResponse.registers,
          basisAmplitudeCache: nextBasisAmplitudeCache,
          error: null,
        };
      });
    } catch (error) {
      setDebuggerError(error instanceof Error ? error.message : "Failed to refresh debugger session.");
    }
  }, [doc, fetchStateVectorForMode, setDebuggerError, ui.debugViewMode]);

  const refreshDebugSession = useCallback(async () => {
    const sessionId = doc.debuggerRef.current.sessionId;
    if (!sessionId) {
      return;
    }

    await refreshDebugSessionBySessionId(sessionId);
  }, [doc.debuggerRef, refreshDebugSessionBySessionId]);

  const buildDebugSession = useCallback(async () => {
    setDebuggerMode("building");
    basisAmplitudeRequestsRef.current.clear();

    try {
      const response = await buildDebugSessionRequest(
        serializeCircuit({
          qubits: doc.nQRef.current,
          steps: doc.nSRef.current,
          classicalRegisters: doc.classicalRegsRef.current,
          elements: doc.elementsRef.current,
          customGateDefinitions: doc.customGateDefinitionsRef.current,
        }),
      );

      doc.setDebuggerState((current) => ({
        ...current,
        sessionId: response.session_id,
        mode: "building",
        pc: null,
        stateVector: null,
        debugClassicalRegisterValues: {},
        basisAmplitudeCache: {},
        error: null,
      }));

      await refreshDebugSessionBySessionId(response.session_id);
    } catch (error) {
      basisAmplitudeRequestsRef.current.clear();
      doc.setDebuggerState({
        ...createIdleDebuggerState(),
        mode: "error",
        error: error instanceof Error ? error.message : "Failed to build debugger session.",
      });
    }
  }, [createIdleDebuggerState, doc, refreshDebugSessionBySessionId, setDebuggerMode]);

  const stepDebugSession = useCallback(async () => {
    const sessionId = doc.debuggerRef.current.sessionId;
    if (!sessionId) {
      return;
    }

    setDebuggerMode("stepping");

    try {
      await nextDebugSessionRequest(sessionId);
      await refreshDebugSession();
    } catch (error) {
      setDebuggerError(error instanceof Error ? error.message : "Failed to step debugger session.");
    }
  }, [doc.debuggerRef, refreshDebugSession, setDebuggerError, setDebuggerMode]);

  const continueDebugSession = useCallback(async () => {
    const sessionId = doc.debuggerRef.current.sessionId;
    if (!sessionId) {
      return;
    }

    setDebuggerMode("continuing");

    try {
      await continueDebugSessionRequest(sessionId);
      await refreshDebugSession();
    } catch (error) {
      setDebuggerError(error instanceof Error ? error.message : "Failed to continue debugger session.");
    }
  }, [doc.debuggerRef, refreshDebugSession, setDebuggerError, setDebuggerMode]);

  const changeDebugViewMode = useCallback(
    (mode: "state" | "sorted") => {
      ui.setDebugViewMode(mode);

      const sessionId = doc.debuggerRef.current.sessionId;
      if (!sessionId) {
        return;
      }

      void (async () => {
        try {
          const stateVectorResponse = await fetchStateVectorForMode(sessionId, mode);
          doc.setDebuggerState((current) => {
            const nextBasisAmplitudeCache = { ...current.basisAmplitudeCache };
            for (const entry of stateVectorResponse.amplitudes) {
              nextBasisAmplitudeCache[entry.basis] = entry.amplitude;
            }

            return {
              ...current,
              stateVector: stateVectorResponse,
              basisAmplitudeCache: nextBasisAmplitudeCache,
              error: null,
            };
          });
        } catch (error) {
          setDebuggerError(error instanceof Error ? error.message : "Failed to refresh statevector view.");
        }
      })();
    },
    [doc, fetchStateVectorForMode, setDebuggerError, ui],
  );

  const loadTrackedBasisAmplitude = useCallback(async (basis: number) => {
    const sessionId = doc.debuggerRef.current.sessionId;
    if (!sessionId) {
      return;
    }

    if (basis in doc.debuggerRef.current.basisAmplitudeCache || basisAmplitudeRequestsRef.current.has(basis)) {
      return;
    }

    basisAmplitudeRequestsRef.current.add(basis);

    try {
      const response = await fetchDebugSessionBasisAmplitude(sessionId, basis);
      doc.setDebuggerState((current) => ({
        ...current,
        basisAmplitudeCache: {
          ...current.basisAmplitudeCache,
          [basis]: response.amplitude,
        },
      }));
    } catch (error) {
      setDebuggerError(error instanceof Error ? error.message : `Failed to load basis amplitude ${basis}.`);
    } finally {
      basisAmplitudeRequestsRef.current.delete(basis);
    }
  }, [doc, setDebuggerError]);

  const getPlacementQubits = useCallback(
    (spec: PaletteDragSpec | CanvasElement, baseQubit: number) => {
      if (spec.type === "custom") {
        const definition = findCustomGateDefinition(spec.classifier, doc.customGateDefinitionsRef.current);
        const span = customGateSpan(definition);
        return Array.from({ length: span }, (_, offset) => baseQubit + offset);
      }

      if (spec.type === "jump") {
        return Array.from({ length: doc.nQRef.current }, (_, qubit) => qubit);
      }

      return [baseQubit];
    },
    [doc.customGateDefinitionsRef, doc.nQRef],
  );

  const buildDropPreview = useCallback(
    (
      hit: ReturnType<typeof resolveCanvasHit>,
      spec: PaletteDragSpec | CanvasElement,
      draggedId?: number,
    ): DropPreview | null => {
      if (!hit) {
        return null;
      }

      if (hit.zone === "qubit") {
        const occupiedQubits = getPlacementQubits(spec, hit.qubit);
        const withinBounds = occupiedQubits.every((qubit) => qubit >= 0 && qubit < doc.nQRef.current);
        const others =
          draggedId == null
            ? doc.elementsRef.current
            : doc.elementsRef.current.filter((candidate) => candidate.id !== draggedId);

        if (hit.insertAt != null) {
          return {
            zone: "qubit",
            step: hit.insertAt,
            qubit: hit.qubit,
            insertAt: hit.insertAt,
            qubitSpan: occupiedQubits.length,
            fullColumn: spec.type === "jump",
            valid: withinBounds,
          };
        }

        const overlaps = occupiedQubits.some((qubit) =>
          cellTaken(others, hit.step, qubit, doc.customGateDefinitionsRef.current),
        );
        const jumpOccupiesWholeColumn = spec.type === "jump";
        const stepAlreadyUsed =
          jumpOccupiesWholeColumn &&
          others.some((element) => element.step === hit.step && element.type !== "cctrl");

        return {
          zone: "qubit",
          step: hit.step,
          qubit: hit.qubit,
          qubitSpan: occupiedQubits.length,
          fullColumn: spec.type === "jump",
          valid: withinBounds && !overlaps && !stepAlreadyUsed,
        };
      }

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

      const others =
        draggedId == null
          ? doc.elementsRef.current
          : doc.elementsRef.current.filter((candidate) => candidate.id !== draggedId);
      const alreadyHas = others.some((element) => element.type === "cctrl" && element.step === hit.step);

      return {
        zone: "creg",
        step: hit.step,
        cregIdx: hit.cregIdx,
        cregName: hit.cregName,
        valid: !alreadyHas,
      };
    },
    [doc.customGateDefinitionsRef, doc.elementsRef, doc.nQRef, getPlacementQubits],
  );

  const applyQubitDrop = useCallback(
    (preview: Extract<DropPreview, { zone: "qubit" }>, spec: PaletteDragSpec) => {
      const newStep = preview.insertAt ?? preview.step;
      const newElement = createElementFromPalette(spec, newStep, preview.qubit);

      doc.setElements((current) => {
        const shifted = preview.insertAt != null ? insertAtStep(current, preview.insertAt) : current;
        return [...shifted, newElement];
      });

      if (newElement.type === "measurement") {
        if (doc.classicalRegsRef.current.length > 0) {
          doc.setElements((current) =>
            current.map((element) =>
              element.id === newElement.id && element.type === "measurement"
                ? { ...element, registerName: doc.classicalRegsRef.current[0]?.name ?? null, bitIndex: null }
                : element,
            ),
          );
        }
        ui.setClassicalRegisterModal({ elId: newElement.id });
      } else if (newElement.type === "assign") {
        if (doc.classicalRegsRef.current.length > 0) {
          doc.setElements((current) =>
            current.map((element) =>
              element.id === newElement.id && element.type === "assign"
                ? { ...element, registerName: doc.classicalRegsRef.current[0]?.name ?? null }
                : element,
            ),
          );
        }
        ui.setAssignModal({ elId: newElement.id });
      } else if (newElement.type === "jump") {
        openJumpTargetEditor(newElement.id, newStep);
      } else if (newElement.type === "unitary" && newElement.params) {
        ui.setParameterModal({ id: newElement.id, values: newElement.params });
      }
    },
    [doc, insertAtStep, openJumpTargetEditor, ui],
  );

  const applyCregDrop = useCallback(
    (preview: Extract<DropPreview, { zone: "creg" }>) => {
      const newElement = createClassicalControlElement(
        preview.insertAt ?? preview.step,
        preview.cregIdx,
        createDefaultConditionExpression(preview.cregName),
      );

      doc.setElements((current) => {
        const shifted = preview.insertAt != null ? insertAtStep(current, preview.insertAt) : current;
        return [...shifted, newElement];
      });
      openConditionEditor(newElement.id);
    },
    [doc, insertAtStep, openConditionEditor],
  );

  const moveExistingElement = useCallback(
    (elementId: number, preview: DropPreview) => {
      if (preview.zone === "creg") {
        if (preview.insertAt != null) {
          const insertStep = preview.insertAt;
          doc.setElements((current) => {
            const movingEl = current.find(
              (element): element is Extract<CanvasElement, { type: "cctrl" }> =>
                element.id === elementId && element.type === "cctrl",
            );
            if (!movingEl) {
              return current;
            }

            const others = current.filter((element) => element.id !== elementId);
            const shifted = insertAtStep(others, insertStep);
            return [
              ...shifted,
              {
                ...movingEl,
                step: insertStep,
                cregIdx: preview.cregIdx,
                condition: rebindConditionAnchor(
                  movingEl.condition,
                  doc.classicalRegsRef.current[movingEl.cregIdx]?.name ?? preview.cregName,
                  preview.cregName,
                ),
              },
            ];
          });
          return;
        }

        doc.setElements((current) =>
          current.map((element) =>
            element.id === elementId && element.type === "cctrl"
              ? {
                  ...element,
                  step: preview.step,
                  cregIdx: preview.cregIdx,
                  condition: rebindConditionAnchor(
                    element.condition,
                    doc.classicalRegsRef.current[element.cregIdx]?.name ?? preview.cregName,
                    preview.cregName,
                  ),
                }
              : element,
          ),
        );
        return;
      }

      if (preview.insertAt != null) {
        const insertStep = preview.insertAt;
        doc.setElements((current) => {
          const movingEl = current.find(
            (element): element is Exclude<CanvasElement, ClassicalControlElement> =>
              element.id === elementId && element.type !== "cctrl",
          );
          if (!movingEl) {
            return current;
          }

          const others = current.filter((element) => element.id !== elementId);
          const shifted = insertAtStep(others, insertStep);
          return [
            ...shifted,
            movingEl.type === "jump"
              ? {
                  ...movingEl,
                  step: insertStep,
                  targetStep:
                    movingEl.targetStep != null && movingEl.targetStep >= insertStep
                      ? movingEl.targetStep + 1
                      : movingEl.targetStep,
                }
              : { ...movingEl, step: insertStep, qubit: preview.qubit },
          ];
        });
        return;
      }

      doc.setElements((current) =>
        current.map((element) =>
          element.id === elementId && element.type !== "cctrl"
            ? element.type === "jump"
              ? { ...element, step: preview.step }
              : { ...element, step: preview.step, qubit: preview.qubit }
            : element,
        ),
      );
    },
    [doc, insertAtStep],
  );

  const startPaletteDrag = useCallback(
    (event: React.PointerEvent, spec: PaletteDragSpec) => {
      event.preventDefault();
      ui.setDragGhost({ x: event.clientX, y: event.clientY, ...spec });

      const getPreview = (clientX: number, clientY: number) =>
        buildDropPreview(resolveCanvasHit(clientX, clientY), spec);

      const onMove = (moveEvent: PointerEvent) => {
        ui.setDragGhost((current) => (current ? { ...current, x: moveEvent.clientX, y: moveEvent.clientY } : current));
        ui.setDropPreview(getPreview(moveEvent.clientX, moveEvent.clientY));
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

        ui.setDragGhost(null);
        ui.setDropPreview(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [applyCregDrop, applyQubitDrop, buildDropPreview, resolveCanvasHit, ui],
  );

  const startElementDrag = useCallback(
    (event: React.PointerEvent, elementId: number) => {
      event.preventDefault();
      event.stopPropagation();

      const element = doc.elementsRef.current.find((candidate) => candidate.id === elementId);
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
          ui.setDraggingId(elementId);
          clearSelection();
        }

        if (!moving) {
          return;
        }

        ui.setDragGhost(createDragGhostFromElement(element, moveEvent.clientX, moveEvent.clientY));
        ui.setDropPreview(getPreview(moveEvent.clientX, moveEvent.clientY));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        if (!moving) {
          ui.setSelectedIds((current) => (current.length === 1 && current[0] === elementId ? [] : [elementId]));
          return;
        }

        const preview = getPreview(upEvent.clientX, upEvent.clientY);
        if (preview?.valid) {
          moveExistingElement(elementId, preview);
        }

        ui.setDragGhost(null);
        ui.setDropPreview(null);
        ui.setDraggingId(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [buildDropPreview, clearSelection, doc.elementsRef, moveExistingElement, resolveCanvasHit, ui],
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
      ui.setSelectionBox({ x: start.x, y: start.y, width: 0, height: 0 });

      const onMove = (moveEvent: PointerEvent) => {
        const current = clientToSvgPoint(moveEvent.clientX, moveEvent.clientY, svgRef.current);
        if (!current) {
          return;
        }

        ui.setSelectionBox(normalizeSelectionBox(start.x, start.y, current.x, current.y));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const end = clientToSvgPoint(upEvent.clientX, upEvent.clientY, svgRef.current);
        const box = end ? normalizeSelectionBox(start.x, start.y, end.x, end.y) : { x: start.x, y: start.y, width: 0, height: 0 };
        const nextSelectedIds =
          box.width < 4 && box.height < 4
            ? []
            : doc.elementsRef.current
                .filter((element) =>
                  selectionHitsElement(
                    box,
                    element,
                    doc.nQRef.current,
                    doc.classicalRegsRef.current,
                    doc.customGateDefinitionsRef.current,
                  ),
                )
                .map((element) => element.id);

        ui.setSelectedIds(nextSelectedIds);
        ui.setSelectionBox(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clearSelection, doc.classicalRegsRef, doc.customGateDefinitionsRef, doc.elementsRef, doc.nQRef, svgRef, ui],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === "Delete" &&
        ui.selectedIds.length > 0 &&
        !ui.classicalRegisterModal &&
        !ui.parameterModal &&
        !ui.conditionModal &&
        !ui.assignModal &&
        !ui.jumpModal
      ) {
        event.preventDefault();
        doc.setElements((current) => current.filter((element) => !ui.selectedIds.includes(element.id)));
        ui.setSelectedIds([]);
      }

      if (event.key === "Escape") {
        clearSelection();
      }
    },
    [clearSelection, doc, ui],
  );

  const addRegister = useCallback(() => {
    const name = doc.newRegName.trim();
    if (!name || doc.classicalRegs.some((reg) => reg.name === name)) {
      return;
    }

    doc.setCregs((current) => [...current, { id: uid(), name }]);
    doc.setNewRegName("");
  }, [doc]);

  const deleteRegister = useCallback(
    (regId: number) => {
      const reg = doc.classicalRegs.find((entry) => entry.id === regId);
      if (!reg) {
        return;
      }

      const deletedIdx = doc.classicalRegs.findIndex((entry) => entry.id === regId);
      doc.setCregs((current) => current.filter((entry) => entry.id !== regId));
      doc.setElements((current) =>
        current
          .filter((element) => !(element.type === "cctrl" && exprRegisters(element.condition).includes(reg.name)))
          .map((element) => {
            if (element.type === "cctrl" && element.cregIdx > deletedIdx) {
              return { ...element, cregIdx: element.cregIdx - 1 };
            }

            if (element.type === "measurement" && element.registerName === reg.name) {
              return { ...element, registerName: null };
            }

            return element;
          }),
      );
    },
    [doc],
  );

  const addQubit = useCallback(() => {
    doc.setNQ((current) => Math.min(current + 1, 20));
  }, [doc]);

  const removeQubit = useCallback(() => {
    const next = doc.nQ - 1;
    if (next < 1) {
      return;
    }

    doc.setNQ(next);
    doc.setElements((current) =>
      current.filter((element) =>
        elementOccupiedQubits(element, doc.customGateDefinitionsRef.current).every((qubit) => qubit < next),
      ),
    );
  }, [doc]);

  const exportJSON = useCallback(() => {
    exportCircuitToFile({
      qubits: doc.nQ,
      steps: doc.nS,
      classicalRegisters: doc.classicalRegs,
      customGateDefinitions: doc.customGateDefinitions,
      elements: doc.elements,
    });
  }, [doc]);

  const importJSON = useCallback(() => {
    const input = window.document.createElement("input");
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
          doc.setNQ(next.nQ);
          doc.setCregs(next.classicalRegs);
          doc.setCustomGateDefinitions(next.customGateDefinitions);
          doc.setElements(next.elements);
          doc.setNewRegName("");
          resetDebuggerSession();
          resetUiState();
        } catch {
          window.alert("Invalid circuit JSON.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [doc, resetUiState]);

  const clearCircuit = useCallback(() => {
    doc.setElements([]);
    doc.setCregs([]);
    doc.setCustomGateDefinitions([]);
    doc.setNewRegName("");
    resetDebuggerSession();
    resetUiState();
  }, [doc, resetDebuggerSession, resetUiState]);

  const assignMeasurementRegister = useCallback(
    (registerName: string, bitIndex: number) => {
      const modal = ui.classicalRegisterModal;
      if (!modal) {
        return;
      }

      doc.setElements((current) =>
        current.map((element) =>
          element.id === modal.elId && element.type === "measurement"
            ? { ...element, registerName, bitIndex }
            : element,
        ),
      );
      ui.setClassicalRegisterModal(null);
    },
    [doc, ui],
  );

  const createRegisterAndAssign = useCallback(
    (name: string, bitIndex: number) => {
      const trimmed = name.trim();
      const modal = ui.classicalRegisterModal;
      if (!trimmed || doc.classicalRegs.some((reg) => reg.name === trimmed) || !modal) {
        return;
      }

      doc.setCregs((current) => [...current, { id: uid(), name: trimmed }]);
      doc.setElements((current) =>
        current.map((element) =>
          element.id === modal.elId && element.type === "measurement"
            ? { ...element, registerName: trimmed, bitIndex }
            : element,
        ),
      );
      ui.setClassicalRegisterModal(null);
    },
    [doc, ui],
  );

  const applyCondition = useCallback(
    (condition: Extract<CanvasElement, { type: "cctrl" }>["condition"]) => {
      const modal = ui.conditionModal;
      if (!modal) {
        return;
      }

      doc.setElements((current) =>
        current.map((element) =>
          element.id === modal.elId && element.type === "cctrl" ? { ...element, condition } : element,
        ),
      );
      ui.setConditionModal(null);
    },
    [doc, ui],
  );

  const applyParameter = useCallback(() => {
    const modal = ui.parameterModal;
    if (!modal) {
      return;
    }

    doc.setElements((current) =>
      current.map((element) =>
        element.id === modal.id && element.type === "unitary"
          ? { ...element, params: modal.values }
          : element,
      ),
    );
    ui.setParameterModal(null);
  }, [doc, ui]);

  const applyJumpTarget = useCallback(
    (targetStep: number) => {
      const modal = ui.jumpModal;
      if (!modal) {
        return;
      }

      const jumpElement = doc.elementsRef.current.find(
        (element): element is Extract<CanvasElement, { type: "jump" }> =>
          element.id === modal.elId && element.type === "jump",
      );
      if (!jumpElement || jumpElement.step === targetStep) {
        return;
      }

      doc.setElements((current) =>
        current.map((element) =>
          element.id === modal.elId && element.type === "jump" ? { ...element, targetStep } : element,
        ),
      );
      ui.setJumpModal(null);
      ui.setHoveredJumpTargetStep(null);
    },
    [doc, ui],
  );

  const applyAssign = useCallback(
    (registerName: string | null, expr: Extract<CanvasElement, { type: "assign" }>["expr"]) => {
      const modal = ui.assignModal;
      if (!modal) {
        return;
      }

      doc.setElements((current) =>
        current.map((element) =>
          element.id === modal.elId && element.type === "assign"
            ? { ...element, registerName, expr }
            : element,
        ),
      );
      ui.setAssignModal(null);
    },
    [doc, ui],
  );

  const createCustomGate = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || doc.customGateDefinitions.some((definition) => definition.classifier === trimmed)) {
        return;
      }

      const selectedElements = doc.elements.filter((element) => ui.selectedIds.includes(element.id));
      const validation = canCreateCustomGate(selectedElements, doc.elements, doc.customGateDefinitions);
      if (!validation.valid) {
        return;
      }

      const groupableElements = selectedElements.filter(isGroupableQuantumElement);
      const definition = buildCustomGateDefinition(trimmed, groupableElements, uid());
      const instanceStep = Math.min(...groupableElements.map((element) => element.step));

      doc.setCustomGateDefinitions((current) => [...current, definition]);
      doc.setElements((current) => {
        const remaining = current.filter((element) => !ui.selectedIds.includes(element.id));
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
      ui.setSelectedIds([]);
      ui.setCustomGateModal(null);
    },
    [doc, ui],
  );

  const deleteSelected = useCallback(
    (id: number) => {
      doc.setElements((current) => current.filter((element) => element.id !== id));
      ui.setSelectedIds([]);
    },
    [doc, ui],
  );

  const deleteSelectedSet = useCallback(() => {
    doc.setElements((current) => current.filter((element) => !ui.selectedIds.includes(element.id)));
    ui.setSelectedIds([]);
  }, [doc, ui]);

  return {
    setSelectedIds: ui.setSelectedIds,
    clearSelection,
    setParameterModal: ui.setParameterModal,
    setClassicalRegisterModal: ui.setClassicalRegisterModal,
    setConditionModal: ui.setConditionModal,
    setAssignModal: ui.setAssignModal,
    setJumpModal: ui.setJumpModal,
    setHoveredJumpTargetStep: ui.setHoveredJumpTargetStep,
    setCustomGateModal: ui.setCustomGateModal,
    setNewRegName: doc.setNewRegName,
    setDebugViewMode: ui.setDebugViewMode,
    handleKeyDown,
    startCanvasSelection,
    startPaletteDrag,
    startElementDrag,
    openConditionEditor,
    openJumpTargetEditor,
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
    applyAssign,
    applyParameter,
    applyJumpTarget,
    createCustomGate,
    deleteSelected,
    deleteSelectedSet,
    buildDebugSession,
    stepDebugSession,
    continueDebugSession,
    refreshDebugSession,
    changeDebugViewMode,
    loadTrackedBasisAmplitude,
  };
}
