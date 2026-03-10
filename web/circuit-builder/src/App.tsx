import { useRef, useState } from "react";

import { AppHeader } from "./circuit-builder/components/AppHeader";
import { CircuitCanvas } from "./circuit-builder/components/CircuitCanvas";
import { DockPanel } from "./circuit-builder/components/DockPanel";
import { DragGhost } from "./circuit-builder/components/DragGhost";
import { PalettePanel } from "./circuit-builder/components/PalettePanel";
import { StatusBar } from "./circuit-builder/components/StatusBar";
import { AssignModal } from "./circuit-builder/components/modals/AssignModal";
import { ClassicalRegisterModal } from "./circuit-builder/components/modals/ClassicalRegisterModal";
import { ConditionModal } from "./circuit-builder/components/modals/ConditionModal";
import { CustomGateModal } from "./circuit-builder/components/modals/CustomGateModal";
import { JumpModal } from "./circuit-builder/components/modals/JumpModal";
import { ParameterModal } from "./circuit-builder/components/modals/ParameterModal";
import { UI_COLORS } from "./circuit-builder/constants";
import { useCircuitEditor } from "./circuit-builder/hooks/useCircuitEditor";

const MIN_PALETTE_WIDTH = 180;
const MAX_PALETTE_WIDTH = 500;

function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const [paletteWidth, setPaletteWidth] = useState(232);
  const { state, actions } = useCircuitEditor({ svgRef, contRef });

  const startPaletteResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const containerRect = contRef.current?.getBoundingClientRect();

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = containerRect ? moveEvent.clientX - containerRect.left : moveEvent.clientX;
      setPaletteWidth(clamp(nextWidth, MIN_PALETTE_WIDTH, MAX_PALETTE_WIDTH));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={contRef}
      tabIndex={0}
      onKeyDown={actions.handleKeyDown}
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
        nQ={state.nQ}
        nS={state.nS}
        classicalRegisterCount={state.classicalRegs.length}
        onAddQubit={actions.addQubit}
        onRemoveQubit={actions.removeQubit}
        onImport={actions.importJSON}
        onExport={actions.exportJSON}
        onClear={actions.clearCircuit}
      />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ position: "relative", display: "flex", flexShrink: 0, minWidth: 0 }}>
          <PalettePanel
            width={paletteWidth}
            classicalRegs={state.classicalRegs}
            customGateDefinitions={state.customGateDefinitions}
            selectedElement={state.selectedElement}
            selectedCount={state.selectedCount}
            customGateCreationError={state.customGateCreation.valid ? null : state.customGateCreation.reason}
            newRegName={state.newRegName}
            onNewRegNameChange={actions.setNewRegName}
            onAddRegister={actions.addRegister}
            onDeleteRegister={actions.deleteRegister}
            onStartPaletteDrag={actions.startPaletteDrag}
            onEditSelectedParam={(id, values) => actions.setParameterModal({ id, values })}
            onEditSelectedCreg={(elId) => actions.setClassicalRegisterModal({ elId })}
            onEditSelectedAssign={(elId) => actions.setAssignModal({ elId })}
            onEditSelectedCondition={actions.openConditionEditor}
            onEditSelectedJump={(elId) => actions.openJumpTargetEditor(elId)}
            onCreateCustomGate={() => actions.setCustomGateModal({})}
            onDeleteSelected={actions.deleteSelected}
            onDeleteSelectedSet={actions.deleteSelectedSet}
          />
          <div
            onPointerDown={startPaletteResize}
            style={{
              position: "absolute",
              top: 0,
              right: -4,
              bottom: 0,
              width: 8,
              cursor: "ew-resize",
              background: "transparent",
              zIndex: 2,
            }}
          />
        </div>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          <CircuitCanvas
            svgRef={svgRef}
            nQ={state.nQ}
            nS={state.nS}
            elements={state.elements}
            classicalRegs={state.classicalRegs}
            customGateDefinitions={state.customGateDefinitions}
            selectedIds={state.selectedIds}
            draggingId={state.draggingId}
            dropPreview={state.dropPreview}
            selectionBox={state.selectionBox}
            stepAnalysis={state.stepAnalysis}
            jumpTargetSelectionActive={!!state.jumpModal}
            hoveredJumpTargetStep={state.hoveredJumpTargetStep}
            jumpSourceStep={state.jumpModalElement?.step ?? null}
            onJumpTargetHover={actions.setHoveredJumpTargetStep}
            onJumpTargetSelect={actions.applyJumpTarget}
            onCanvasPointerDown={actions.startCanvasSelection}
            onElementPointerDown={actions.startElementDrag}
          />

          <DockPanel
            nQ={state.nQ}
            classicalRegs={state.classicalRegs}
            debugStateVector={state.debugStateVector}
            debugClassicalRegisterValues={state.debugClassicalRegisterValues}
          />
        </div>
      </div>

      <StatusBar
        selectedElement={state.selectedElement}
        selectedCount={state.selectedCount}
        dropPreview={state.dropPreview}
        errorSteps={state.errorSteps}
      />

      <ParameterModal
        modal={state.parameterModal}
        element={state.parameterModalElement}
        onCancel={() => actions.setParameterModal(null)}
        onChange={(values) => actions.setParameterModal((current) => (current ? { ...current, values } : current))}
        onApply={actions.applyParameter}
      />

      <ClassicalRegisterModal
        modal={state.classicalRegisterModal}
        element={state.classicalRegisterModalElement}
        classicalRegs={state.classicalRegs}
        onCancel={() => actions.setClassicalRegisterModal(null)}
        onAssign={actions.assignMeasurementRegister}
        onCreateAndAssign={actions.createRegisterAndAssign}
      />

      <AssignModal
        modal={state.assignModal}
        element={state.assignModalElement}
        classicalRegs={state.classicalRegs}
        onCancel={() => actions.setAssignModal(null)}
        onApply={actions.applyAssign}
      />

      <ConditionModal
        modal={state.conditionModal}
        element={state.conditionModalElement}
        classicalRegs={state.classicalRegs}
        onCancel={() => actions.setConditionModal(null)}
        onApply={actions.applyCondition}
      />

      <JumpModal
        modal={state.jumpModal}
        element={state.jumpModalElement}
        hoveredStep={state.hoveredJumpTargetStep}
        onCancel={() => {
          actions.setJumpModal(null);
          actions.setHoveredJumpTargetStep(null);
        }}
      />

      <CustomGateModal
        modal={state.customGateModal}
        existingClassifiers={state.customGateDefinitions.map((definition) => definition.classifier)}
        validationError={state.customGateCreation.valid ? null : state.customGateCreation.reason}
        onCancel={() => actions.setCustomGateModal(null)}
        onCreate={actions.createCustomGate}
      />

      <DragGhost ghost={state.dragGhost} customGateDefinitions={state.customGateDefinitions} />
    </div>
  );
}

export default App;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
