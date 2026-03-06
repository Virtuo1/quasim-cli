import { CH, CREG_GAP, CRH, CW, LW, PX, PY, UI_COLORS } from "../constants";
import type { CircuitElement, ClassicalRegister, CustomGateDefinition, DropPreview, SelectionBox, StepAnalysisMap } from "../types";
import { getConnectorLines } from "../utils/circuit";
import { ClassicalControlWires, ClassicalRegisterLines, MeasurementWires, QuantumConnectorLines, QubitWires, StepLabels } from "./canvas/CanvasWires";
import { DropPreviewOverlay } from "./canvas/DropPreviewOverlay";
import { ElementNode } from "./canvas/CanvasElements";

interface CircuitCanvasProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  nQ: number;
  nS: number;
  elements: CircuitElement[];
  classicalRegs: ClassicalRegister[];
  customGateDefinitions: CustomGateDefinition[];
  selectedIds: number[];
  draggingId: number | null;
  dropPreview: DropPreview | null;
  selectionBox: SelectionBox | null;
  stepAnalysis: StepAnalysisMap;
  onCanvasPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onElementPointerDown: (event: React.PointerEvent, id: number) => void;
}

export function CircuitCanvas({
  svgRef,
  nQ,
  nS,
  elements,
  classicalRegs,
  customGateDefinitions,
  selectedIds,
  draggingId,
  dropPreview,
  selectionBox,
  stepAnalysis,
  onCanvasPointerDown,
  onElementPointerDown,
}: CircuitCanvasProps) {
  const svgW = PX * 2 + LW + nS * CW;
  const svgH = PY * 2 + nQ * CH + (classicalRegs.length > 0 ? CREG_GAP + classicalRegs.length * CRH : 0);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16, background: UI_COLORS.panelBg }}>
      <svg
        ref={svgRef}
        width={svgW}
        height={svgH}
        onPointerDown={onCanvasPointerDown}
        style={{
          background: UI_COLORS.white,
          border: `1px solid ${UI_COLORS.borderLight}`,
          borderRadius: 4,
          display: "block",
          cursor: "default",
        }}
      >
        <StepLabels count={nS} stepAnalysis={stepAnalysis} />
        <DropPreviewOverlay dropPreview={dropPreview} nQ={nQ} />
        {selectionBox ? (
          <rect
            x={selectionBox.x}
            y={selectionBox.y}
            width={selectionBox.width}
            height={selectionBox.height}
            fill="rgba(37,99,235,.10)"
            stroke={UI_COLORS.blue600}
            strokeWidth={1.5}
            strokeDasharray="4"
          />
        ) : null}
        <QubitWires nQ={nQ} columnCount={nS} />
        <QuantumConnectorLines nS={nS} elements={elements} customGateDefinitions={customGateDefinitions} getConnectorLines={getConnectorLines} />
        <MeasurementWires elements={elements} classicalRegs={classicalRegs} nQ={nQ} />
        <ClassicalRegisterLines classicalRegs={classicalRegs} nQ={nQ} nS={nS} />
        <ClassicalControlWires elements={elements} nQ={nQ} customGateDefinitions={customGateDefinitions} />

        {elements.map((element) => {
          const analysis = stepAnalysis[element.step];
          const inError =
            (element.type === "ctrl" && (analysis.ctrlOrphan || analysis.ctrlOnMeas)) ||
            (element.type === "swap" && analysis.swapError) ||
            (element.type === "cctrl" && (analysis.cctrlOrphan || analysis.cctrlMultiple)) ||
            (element.type === "gate" && element.gateType === "M" && !element.creg);

          return (
            <ElementNode
              key={element.id}
              element={element}
              nQ={nQ}
              customGateDefinitions={customGateDefinitions}
              selected={selectedIds.includes(element.id)}
              dragging={element.id === draggingId}
              inError={inError}
              onPointerDown={(event) => onElementPointerDown(event, element.id)}
            />
          );
        })}
      </svg>
      <div style={{ marginTop: 8, fontSize: 11, color: UI_COLORS.slate400 }}>
        Drag from palette · Drag to move · Click to select · Del to delete · Drop a control node onto a classical
        register to add a conditional
      </div>
    </div>
  );
}
