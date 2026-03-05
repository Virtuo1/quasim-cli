import { useCallback, useEffect, useRef, useState } from "react";

import { CircuitCanvas } from "./circuit-builder/components/CircuitCanvas";
import { AppHeader } from "./circuit-builder/components/AppHeader";
import { PalettePanel } from "./circuit-builder/components/PalettePanel";
import { StatusBar } from "./circuit-builder/components/StatusBar";
import { ClassicalRegisterModal } from "./circuit-builder/components/modals/ClassicalRegisterModal";
import { ConditionModal } from "./circuit-builder/components/modals/ConditionModal";
import { ParameterModal } from "./circuit-builder/components/modals/ParameterModal";
import { COND_OPS, MIN_STEPS, UI_COLORS, gateSupportsParam } from "./circuit-builder/constants";
import { DragGhost } from "./circuit-builder/components/DragGhost";
import { compact, deserializeCircuit, exportCircuitToFile, analyzeStep, cellTaken, getConnectorLines } from "./circuit-builder/utils/circuit";
import { clientToCanvasHit, uid } from "./circuit-builder/utils/layout";
import type {
  CircuitElement,
  ClassicalRegister,
  ClassicalRegisterModalState,
  ClassicalControlElement,
  ConditionModalState,
  DragGhostState,
  DropPreview,
  ParameterModalState,
  PaletteDragSpec,
  SerializedCircuit,
  StepAnalysisMap,
} from "./circuit-builder/types";

function App() {
  const [nQ, setNQ] = useState(4);
  const [elements, setRawElements] = useState<CircuitElement[]>([]);
  const [nS, setNS] = useState(MIN_STEPS);
  const [classicalRegs, setCregs] = useState<ClassicalRegister[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [paramModal, setParamModal] = useState<ParameterModalState | null>(null);
  const [cregModal, setCregModal] = useState<ClassicalRegisterModalState | null>(null);
  const [condModal, setCondModal] = useState<ConditionModalState | null>(null);
  const [newRegName, setNewRegName] = useState("");
  const [ghost, setGhost] = useState<DragGhostState | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const [dragElId, setDragElId] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const elementsRef = useRef(elements);
  const nQRef = useRef(nQ);
  const nSRef = useRef(nS);
  const cregsRef = useRef(classicalRegs);

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
    cregsRef.current = classicalRegs;
  }, [classicalRegs]);

  useEffect(() => {
    contRef.current?.focus();
  }, []);

  const setElements = useCallback(
    (updater: CircuitElement[] | ((prev: CircuitElement[]) => CircuitElement[])) => {
      setRawElements((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        const { elements: compacted, nS: newNS } = compact(next);
        setNS(newNS);
        return compacted;
      });
    },
    [],
  );

  const resolveCanvasHit = useCallback(
    (clientX: number, clientY: number) =>
      clientToCanvasHit(clientX, clientY, {
        svg: svgRef.current,
        nQ: nQRef.current,
        nS: nSRef.current,
        classicalRegs: cregsRef.current,
      }),
    [],
  );

  const openConditionEditor = useCallback((elId: number) => {
    setCondModal({ elId });
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selId &&
        !cregModal &&
        !paramModal &&
        !condModal
      ) {
        event.preventDefault();
        setElements((current) => current.filter((el) => el.id !== selId));
        setSelId(null);
      }

      if (event.key === "Escape") {
        setSelId(null);
      }
    },
    [condModal, cregModal, paramModal, selId, setElements],
  );

  const startPaletteDrag = useCallback(
    (event: React.PointerEvent, spec: PaletteDragSpec) => {
      event.preventDefault();
      setGhost({ x: event.clientX, y: event.clientY, ...spec });

      const getPreview = (clientX: number, clientY: number): DropPreview | null => {
        const hit = resolveCanvasHit(clientX, clientY);
        if (!hit) {
          return null;
        }

        if (hit.zone === "qubit") {
          return {
            zone: "qubit",
            step: hit.step,
            qubit: hit.qubit,
            valid: !cellTaken(elementsRef.current, hit.step, hit.qubit),
          };
        }

        if (spec.type !== "ctrl") {
          return null;
        }

        const alreadyHas = elementsRef.current.some(
          (el) => el.type === "cctrl" && el.step === hit.step && el.cregIdx === hit.cregIdx,
        );

        return {
          zone: "creg",
          step: hit.step,
          cregIdx: hit.cregIdx,
          cregName: hit.cregName,
          valid: !alreadyHas,
        };
      };

      const onMove = (moveEvent: PointerEvent) => {
        setGhost((current) => (current ? { ...current, x: moveEvent.clientX, y: moveEvent.clientY } : current));
        setDropPreview(getPreview(moveEvent.clientX, moveEvent.clientY));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        const preview = getPreview(upEvent.clientX, upEvent.clientY);
        if (preview?.valid) {
          if (preview.zone === "creg") {
            const newEl: ClassicalControlElement = {
              id: uid(),
              type: "cctrl",
              step: preview.step,
              cregIdx: preview.cregIdx,
              cregName: preview.cregName,
              op: "==",
              val: 0,
            };
            setElements((current) => [...current, newEl]);
            openConditionEditor(newEl.id);
          } else {
            const isMeasurement = spec.type === "gate" && spec.gateType === "M";
            const needsParam = spec.type === "gate" && gateSupportsParam(spec.gateType);
            const newEl: CircuitElement =
              spec.type === "gate"
                ? {
                    id: uid(),
                    type: "gate",
                    gateType: spec.gateType,
                    step: preview.step,
                    qubit: preview.qubit,
                    param: needsParam ? 0 : undefined,
                    creg: isMeasurement ? null : undefined,
                  }
                : {
                    id: uid(),
                    type: spec.type,
                    step: preview.step,
                    qubit: preview.qubit,
                  };

            setElements((current) => [...current, newEl]);

            if (isMeasurement) {
              if (cregsRef.current.length > 0) {
                setElements((current) =>
                  current.map((el) =>
                    el.id === newEl.id && el.type === "gate"
                      ? { ...el, creg: cregsRef.current[0]?.name ?? null }
                      : el,
                  ),
                );
              }
              setCregModal({ elId: newEl.id });
            } else if (needsParam) {
              setParamModal({ id: newEl.id, val: 0 });
            }
          }
        }

        setGhost(null);
        setDropPreview(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [openConditionEditor, resolveCanvasHit, setElements],
  );

  const startElementDrag = useCallback(
    (event: React.PointerEvent, elId: number) => {
      event.preventDefault();
      event.stopPropagation();

      const element = elementsRef.current.find((candidate) => candidate.id === elId);
      if (!element) {
        return;
      }

      const startX = event.clientX;
      const startY = event.clientY;
      let moving = false;

      const getPreview = (clientX: number, clientY: number): DropPreview | null => {
        const hit = resolveCanvasHit(clientX, clientY);
        if (!hit) {
          return null;
        }

        if (element.type === "cctrl") {
          if (hit.zone !== "creg") {
            return null;
          }

          const others = elementsRef.current.filter((candidate) => candidate.id !== elId);
          const alreadyHas = others.some(
            (candidate) =>
              candidate.type === "cctrl" &&
              candidate.step === hit.step &&
              candidate.cregIdx === hit.cregIdx,
          );

          return {
            zone: "creg",
            step: hit.step,
            cregIdx: hit.cregIdx,
            cregName: hit.cregName,
            valid: !alreadyHas,
          };
        }

        if (hit.zone !== "qubit") {
          return null;
        }

        const others = elementsRef.current.filter((candidate) => candidate.id !== elId);
        return {
          zone: "qubit",
          step: hit.step,
          qubit: hit.qubit,
          valid: !cellTaken(others, hit.step, hit.qubit),
        };
      };

      const onMove = (moveEvent: PointerEvent) => {
        if (!moving && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 5) {
          moving = true;
          setDragElId(elId);
          setSelId(null);
        }

        if (!moving) {
          return;
        }

        if (element.type === "gate") {
          setGhost({
            x: moveEvent.clientX,
            y: moveEvent.clientY,
            type: "gate",
            gateType: element.gateType,
          });
        } else if (element.type === "swap") {
          setGhost({
            x: moveEvent.clientX,
            y: moveEvent.clientY,
            type: "swap",
          });
        } else {
          setGhost({
            x: moveEvent.clientX,
            y: moveEvent.clientY,
            type: "ctrl",
          });
        }
        setDropPreview(getPreview(moveEvent.clientX, moveEvent.clientY));
      };

      const onUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        if (!moving) {
          setSelId((current) => (current === elId ? null : elId));
          return;
        }

        const preview = getPreview(upEvent.clientX, upEvent.clientY);
        if (preview?.valid) {
          if (preview.zone === "creg") {
            setElements((current) =>
              current.map((el) =>
                el.id === elId && el.type === "cctrl"
                  ? { ...el, step: preview.step, cregIdx: preview.cregIdx, cregName: preview.cregName }
                  : el,
              ),
            );
          } else {
            setElements((current) =>
              current.map((el) =>
                el.id === elId && el.type !== "cctrl"
                  ? { ...el, step: preview.step, qubit: preview.qubit }
                  : el,
              ),
            );
          }
        }

        setGhost(null);
        setDropPreview(null);
        setDragElId(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [resolveCanvasHit, setElements],
  );

  const addCreg = useCallback(() => {
    const name = newRegName.trim();
    if (!name || classicalRegs.some((reg) => reg.name === name)) {
      return;
    }

    setCregs((current) => [...current, { id: uid(), name }]);
    setNewRegName("");
  }, [classicalRegs, newRegName]);

  const deleteCreg = useCallback(
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
      current.filter((el) => {
        if (el.type === "cctrl") {
          return true;
        }

        return el.qubit < next;
      }),
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
          setSelId(null);
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
    setSelId(null);
  }, [setElements]);

  const stepAnalysis: StepAnalysisMap = {};
  for (let step = 0; step < nS; step += 1) {
    stepAnalysis[step] = analyzeStep(elements.filter((el) => el.step === step));
  }

  const errorSteps = Object.values(stepAnalysis).filter((analysis) => analysis.hasError).length;
  const selectedElement = selId ? elements.find((el) => el.id === selId) ?? null : null;

  return (
    <div
      ref={contRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: UI_COLORS.appBg,
        outline: "none",
        userSelect: "none",
      }}
    >
      <AppHeader
        nQ={nQ}
        nS={nS}
        classicalRegisterCount={classicalRegs.length}
        onAddQubit={addQubit}
        onRemoveQubit={removeQubit}
        onImport={importJSON}
        onExport={exportJSON}
        onClear={clearCircuit}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <PalettePanel
          classicalRegs={classicalRegs}
          selectedElement={selectedElement}
          newRegName={newRegName}
          onNewRegNameChange={setNewRegName}
          onAddRegister={addCreg}
          onDeleteRegister={deleteCreg}
          onStartPaletteDrag={startPaletteDrag}
          onEditSelectedParam={(id, value) => setParamModal({ id, val: value })}
          onEditSelectedCreg={(elId) => setCregModal({ elId })}
          onEditSelectedCondition={openConditionEditor}
          onDeleteSelected={(id) => {
            setElements((current) => current.filter((el) => el.id !== id));
            setSelId(null);
          }}
        />

        <CircuitCanvas
          svgRef={svgRef}
          nQ={nQ}
          nS={nS}
          elements={elements}
          classicalRegs={classicalRegs}
          selectedId={selId}
          draggingId={dragElId}
          dropPreview={dropPreview}
          stepAnalysis={stepAnalysis}
          getConnectorLines={getConnectorLines}
          onCanvasPointerDown={(event) => {
            const target = event.target as Element | null;
            if (!target?.closest(".gate-el")) {
              setSelId(null);
            }
          }}
          onElementPointerDown={startElementDrag}
        />
      </div>

      <StatusBar
        nQ={nQ}
        nS={nS}
        elementCount={elements.length}
        selectedElement={selectedElement}
        dropPreview={dropPreview}
        errorSteps={errorSteps}
      />

      <ParameterModal
        modal={paramModal}
        element={paramModal ? elements.find((el): el is Extract<CircuitElement, { type: "gate" }> => el.id === paramModal.id && el.type === "gate") ?? null : null}
        onCancel={() => setParamModal(null)}
        onChange={(value) =>
          setParamModal((current) => (current ? { ...current, val: value } : current))
        }
        onApply={() => {
          if (!paramModal) {
            return;
          }
          setElements((current) =>
            current.map((el) =>
              el.id === paramModal.id && el.type === "gate" ? { ...el, param: paramModal.val } : el,
            ),
          );
          setParamModal(null);
        }}
      />

      <ClassicalRegisterModal
        modal={cregModal}
        element={cregModal ? elements.find((el): el is Extract<CircuitElement, { type: "gate" }> => el.id === cregModal.elId && el.type === "gate") ?? null : null}
        classicalRegs={classicalRegs}
        onCancel={() => setCregModal(null)}
        onAssign={(regName) => {
          if (!cregModal) {
            return;
          }
          setElements((current) =>
            current.map((el) =>
              el.id === cregModal.elId && el.type === "gate" ? { ...el, creg: regName } : el,
            ),
          );
          setCregModal(null);
        }}
        onCreateAndAssign={(name) => {
          const trimmed = name.trim();
          if (!trimmed || classicalRegs.some((reg) => reg.name === trimmed) || !cregModal) {
            return;
          }
          setCregs((current) => [...current, { id: uid(), name: trimmed }]);
          setElements((current) =>
            current.map((el) =>
              el.id === cregModal.elId && el.type === "gate" ? { ...el, creg: trimmed } : el,
            ),
          );
          setCregModal(null);
        }}
      />

      <ConditionModal
        modal={condModal}
        element={condModal ? elements.find((el): el is Extract<CircuitElement, { type: "cctrl" }> => el.id === condModal.elId && el.type === "cctrl") ?? null : null}
        operators={COND_OPS}
        onCancel={() => setCondModal(null)}
        onApply={(op, val) => {
          if (!condModal) {
            return;
          }
          setElements((current) =>
            current.map((el) => (el.id === condModal.elId && el.type === "cctrl" ? { ...el, op, val } : el)),
          );
          setCondModal(null);
        }}
      />

      <DragGhost ghost={ghost} />
    </div>
  );
}

export default App;
