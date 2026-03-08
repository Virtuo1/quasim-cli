import { CH, CREG_GAP, CRH, CW, LW, PX, PY, UI_COLORS } from "../constants";
import type { CircuitElement, ClassicalRegister, CustomGateDefinition, DropPreview, SelectionBox, StepAnalysisMap } from "../types";
import { wireX } from "../utils/layout";
import { getConnectorLinesWithCustoms } from "../utils/circuit";
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
  jumpTargetSelectionActive: boolean;
  hoveredJumpTargetStep: number | null;
  jumpSourceStep: number | null;
  onJumpTargetHover: (step: number | null) => void;
  onJumpTargetSelect: (step: number) => void;
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
  jumpTargetSelectionActive,
  hoveredJumpTargetStep,
  jumpSourceStep,
  onJumpTargetHover,
  onJumpTargetSelect,
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
        <QuantumConnectorLines
          nS={nS}
          elements={elements}
          customGateDefinitions={customGateDefinitions}
          getConnectorLines={getConnectorLinesWithCustoms}
        />
        <MeasurementWires elements={elements} classicalRegs={classicalRegs} nQ={nQ} />
        <ClassicalRegisterLines classicalRegs={classicalRegs} nQ={nQ} nS={nS} />
        <ClassicalControlWires
          elements={elements}
          classicalRegs={classicalRegs}
          selectedIds={selectedIds}
          nQ={nQ}
          customGateDefinitions={customGateDefinitions}
          stepAnalysis={stepAnalysis}
        />

        {elements.map((element) => {
          const analysis = stepAnalysis[element.step];
          const inError =
            analysis.overlapElementIds.includes(element.id) ||
            (element.type === "ctrl" && (analysis.ctrlOrphan || analysis.ctrlOnClassicalOp || analysis.ctrlOnCustom)) ||
            (element.type === "custom" && analysis.ctrlOnCustom) ||
            (element.type === "swap" && analysis.swapError) ||
            (element.type === "cctrl" && (analysis.cctrlOrphan || analysis.cctrlMultiple)) ||
            (element.type === "measurement" && !element.registerName) ||
            (element.type === "assign" && !element.registerName) ||
            (element.type === "jump" && (analysis.jumpMixedColumn || analysis.jumpWithoutTarget));

          return (
            <ElementNode
              key={element.id}
              element={element}
              nQ={nQ}
              classicalRegs={classicalRegs}
              customGateDefinitions={customGateDefinitions}
              selected={selectedIds.includes(element.id)}
              dragging={element.id === draggingId}
              inError={inError}
              onPointerDown={(event) => {
                if (!jumpTargetSelectionActive) {
                  onElementPointerDown(event, element.id);
                }
              }}
            />
          );
        })}
        {jumpTargetSelectionActive ? (
          <g>
            <rect
              x={PX + LW}
              y={PY}
              width={nS * CW}
              height={nQ * CH}
              fill="transparent"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            />
            {Array.from({ length: nS }, (_, step) => {
              if (jumpSourceStep === step) {
                return null;
              }

              const isHovered = hoveredJumpTargetStep === step;
              return (
                <rect
                  key={`jump-target-${step}`}
                  x={wireX(step) - CW / 2 + 4}
                  y={PY + 4}
                  width={CW - 8}
                  height={nQ * CH - 8}
                  rx={4}
                  fill={isHovered ? "rgba(37,99,235,.14)" : "rgba(15,23,42,.03)"}
                  stroke={isHovered ? UI_COLORS.blue600 : UI_COLORS.borderMid}
                  strokeWidth={isHovered ? 2 : 1}
                  strokeDasharray={isHovered ? undefined : "4 4"}
                  style={{ cursor: "pointer" }}
                  onPointerEnter={() => onJumpTargetHover(step)}
                  onPointerLeave={() => onJumpTargetHover(null)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onJumpTargetSelect(step);
                  }}
                />
              );
            })}
          </g>
        ) : null}
      </svg>
      <div style={{ marginTop: 8, fontSize: 11, color: UI_COLORS.slate400 }}>
        Drag from palette · Drag to move · Click to select · Del to delete · Drop a control node onto a classical
        register to add a conditional
      </div>
    </div>
  );
}
