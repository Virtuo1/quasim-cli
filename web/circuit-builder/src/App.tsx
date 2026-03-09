import { useRef } from "react";

import { AppHeader } from "./circuit-builder/components/AppHeader";
import { CircuitCanvas } from "./circuit-builder/components/CircuitCanvas";
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

function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const { state, actions } = useCircuitEditor({ svgRef, contRef });

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
        <PalettePanel
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
