import { CH, CONNECTOR_BLACK, CW, ERROR_COLORS, GB, CRH, CREG_GAP, GATE_DEFS, LW, PX, PY, UI_COLORS, gateSupportsParam } from "../constants";
import type { CircuitElement, ClassicalRegister, DropPreview, QuantumConnectorLine, StepAnalysisMap } from "../types";
import { classicalControlWireLine, measurementWireLine } from "../utils/circuit";
import { cregY, wireX, wireY } from "../utils/layout";

interface CircuitCanvasProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  nQ: number;
  nS: number;
  elements: CircuitElement[];
  classicalRegs: ClassicalRegister[];
  selectedId: number | null;
  draggingId: number | null;
  dropPreview: DropPreview | null;
  stepAnalysis: StepAnalysisMap;
  getConnectorLines: (stepEls: CircuitElement[]) => QuantumConnectorLine[];
  onCanvasPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onElementPointerDown: (event: React.PointerEvent, id: number) => void;
}

export function CircuitCanvas({
  svgRef,
  nQ,
  nS,
  elements,
  classicalRegs,
  selectedId,
  draggingId,
  dropPreview,
  stepAnalysis,
  getConnectorLines,
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
        {Array.from({ length: nS }, (_, step) => {
          const { hasError } = stepAnalysis[step] ?? {};
          return (
            <g key={`step-${step}`}>
              {hasError ? (
                <text x={wireX(step)} y={10} textAnchor="middle" fontSize={10} fill={ERROR_COLORS.primary}>
                  ⚠
                </text>
              ) : null}
              <text
                x={wireX(step)}
                y={PY - 12}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fontFamily="monospace"
                fill={hasError ? ERROR_COLORS.primary : UI_COLORS.slate400}
              >
                {step}
              </text>
            </g>
          );
        })}

        <DropPreviewOverlay dropPreview={dropPreview} nQ={nQ} />

        {Array.from({ length: nQ }, (_, qubit) => (
          <g key={`wire-${qubit}`}>
            <line x1={PX + LW} y1={wireY(qubit)} x2={PX + LW + nS * CW - 4} y2={wireY(qubit)} stroke={UI_COLORS.borderMid} strokeWidth={2} />
            <text x={PX + 6} y={wireY(qubit) + 1} textAnchor="start" dominantBaseline="middle" fontSize={11} fontFamily="monospace" fill={UI_COLORS.slate400}>
              |0⟩
            </text>
            <text x={PX + LW - 8} y={wireY(qubit) + 1} textAnchor="end" dominantBaseline="middle" fontSize={12} fontFamily="monospace" fill={UI_COLORS.slate600}>
              q<tspan fontSize={9} dy={3}>{qubit}</tspan>
            </text>
            <line x1={PX + LW + nS * CW - 4} y1={wireY(qubit) - 2} x2={PX + LW + nS * CW + 6} y2={wireY(qubit) - 2} stroke={UI_COLORS.slate400} strokeWidth={1} />
            <line x1={PX + LW + nS * CW - 4} y1={wireY(qubit) + 2} x2={PX + LW + nS * CW + 6} y2={wireY(qubit) + 2} stroke={UI_COLORS.slate400} strokeWidth={1} />
          </g>
        ))}

        {Array.from({ length: nS }, (_, step) => {
          const stepEls = elements.filter((el) => el.step === step);
          return getConnectorLines(stepEls).map((line, index) => (
            <line
              key={`connector-${step}-${index}`}
              x1={wireX(step)}
              y1={wireY(line.q1)}
              x2={wireX(step)}
              y2={wireY(line.q2)}
              stroke={line.error ? ERROR_COLORS.primary : CONNECTOR_BLACK}
              strokeWidth={2}
              strokeDasharray={line.error ? "5 3" : undefined}
            />
          ));
        })}

        <MeasurementWires elements={elements} classicalRegs={classicalRegs} nQ={nQ} />
        <ClassicalRegLines classicalRegs={classicalRegs} nQ={nQ} nS={nS} />
        <ClassicalControlWires elements={elements} nQ={nQ} />

        {elements.map((element) => {
          const analysis = stepAnalysis[element.step];
          const inError =
            (element.type === "ctrl" && (analysis.ctrlOrphan || analysis.ctrlOnMeas)) ||
            (element.type === "swap" && analysis.swapError) ||
            (element.type === "cctrl" && analysis.cctrlOrphan) ||
            (element.type === "gate" && element.gateType === "M" && !element.creg);

          return (
            <ElementNode
              key={element.id}
              element={element}
              nQ={nQ}
              selected={element.id === selectedId}
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

function DropPreviewOverlay({ dropPreview, nQ }: { dropPreview: DropPreview | null; nQ: number }) {
  if (!dropPreview) {
    return null;
  }

  if (dropPreview.zone === "qubit") {
    return (
      <rect
        x={PX + LW + dropPreview.step * CW + 5}
        y={PY + dropPreview.qubit * CH + 5}
        width={CW - 10}
        height={CH - 10}
        rx={3}
        fill={dropPreview.valid ? "rgba(34,197,94,.12)" : ERROR_COLORS.previewFill}
        stroke={dropPreview.valid ? "#16a34a" : ERROR_COLORS.primary}
        strokeWidth={1.5}
        strokeDasharray="4"
      />
    );
  }

  return (
    <rect
      x={PX + LW + dropPreview.step * CW + 5}
      y={cregY(dropPreview.cregIdx, nQ) - CRH / 2 + 5}
      width={54}
      height={CRH - 10}
      rx={3}
      fill={dropPreview.valid ? "rgba(124,58,237,.1)" : ERROR_COLORS.previewFill}
      stroke={dropPreview.valid ? "#7c3aed" : ERROR_COLORS.primary}
      strokeWidth={1.5}
      strokeDasharray="4"
    />
  );
}

function MeasurementWires({
  elements,
  classicalRegs,
  nQ,
}: {
  elements: CircuitElement[];
  classicalRegs: ClassicalRegister[];
  nQ: number;
}) {
  return (
    <>
      {elements
        .filter((el): el is Extract<CircuitElement, { type: "gate" }> => el.type === "gate" && el.gateType === "M" && !!el.creg)
        .map((element) => {
          const line = measurementWireLine(element, classicalRegs, nQ);
          if (!line) {
            return null;
          }

          return (
            <g key={`measurement-wire-${element.id}`}>
              <line x1={wireX(line.x)} y1={line.y1} x2={wireX(line.x)} y2={line.y2 - 7} stroke="#64748b" strokeWidth={1} strokeDasharray="4 3" />
              <polygon points={`${wireX(line.x)},${line.y2} ${wireX(line.x) - 4},${line.y2 - 8} ${wireX(line.x) + 4},${line.y2 - 8}`} fill="#64748b" />
            </g>
          );
        })}
    </>
  );
}

function ClassicalControlWires({ elements, nQ }: { elements: CircuitElement[]; nQ: number }) {
  return (
    <>
      {elements
        .filter((el): el is Extract<CircuitElement, { type: "cctrl" }> => el.type === "cctrl")
        .map((element) => {
          const line = classicalControlWireLine(element, elements, nQ);
          if (!line) {
            return null;
          }

          return (
            <g key={`classical-control-wire-${element.id}`}>
              <line x1={wireX(element.step) - 2} y1={line.y1} x2={wireX(element.step) - 2} y2={line.y2} stroke={CONNECTOR_BLACK} strokeWidth={2} />
              <line x1={wireX(element.step) + 2} y1={line.y1} x2={wireX(element.step) + 2} y2={line.y2} stroke={CONNECTOR_BLACK} strokeWidth={2} />
            </g>
          );
        })}
    </>
  );
}

function ClassicalRegLines({
  classicalRegs,
  nQ,
  nS,
}: {
  classicalRegs: ClassicalRegister[];
  nQ: number;
  nS: number;
}) {
  if (classicalRegs.length === 0) {
    return null;
  }

  const wireStart = PX + LW;
  const wireEnd = PX + LW + nS * 64 - 4;
  return (
    <>
      {classicalRegs.map((reg, index) => {
        const y = cregY(index, nQ);
        return (
          <g key={reg.id}>
            <line x1={wireStart} y1={y - 2} x2={wireEnd} y2={y - 2} stroke="#94a3b8" strokeWidth={2} />
            <line x1={wireStart} y1={y + 2} x2={wireEnd} y2={y + 2} stroke="#94a3b8" strokeWidth={2} />
            <text x={PX + 6} y={y + 1} textAnchor="start" dominantBaseline="middle" fontSize={10} fontFamily="monospace" fill="#64748b" fontStyle="italic">
              c/
            </text>
            <text x={PX + 18} y={y + 1} textAnchor="start" dominantBaseline="middle" fontSize={11} fontFamily="monospace" fill="#475569">
              {reg.name}
            </text>
            <line x1={wireEnd} y1={y - 5} x2={wireEnd} y2={y + 5} stroke="#94a3b8" strokeWidth={2} />
          </g>
        );
      })}
    </>
  );
}

function ElementNode({
  element,
  selected,
  dragging,
  inError,
  onPointerDown,
  nQ,
}: {
  element: CircuitElement;
  selected: boolean;
  dragging: boolean;
  inError: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  nQ: number;
}) {
  const cx = wireX(element.step);
  const errorColor = ERROR_COLORS.primary;
  const ops = {
    className: "gate-el",
    style: { cursor: "grab", opacity: dragging ? 0.18 : 1 },
    onPointerDown,
  };

  if (element.type === "ctrl") {
    const cy = wireY(element.qubit);
    const color = inError ? errorColor : selected ? "#F59E0B" : CONNECTOR_BLACK;
    return (
      <g {...ops}>
        {selected ? <circle cx={cx} cy={cy} r={12} fill="#F59E0B" opacity={0.15} /> : null}
        <circle cx={cx} cy={cy} r={7} fill={color} />
        {inError ? (
          <text x={cx + 10} y={cy - 8} fontSize={10} fill={errorColor} fontWeight="bold">
            !
          </text>
        ) : null}
      </g>
    );
  }

  if (element.type === "swap") {
    const cy = wireY(element.qubit);
    const color = inError ? errorColor : selected ? "#F59E0B" : CONNECTOR_BLACK;
    return (
      <g {...ops}>
        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent" />
        {selected ? <rect x={cx - 16} y={cy - 16} width={32} height={32} rx={3} fill="#F59E0B" opacity={0.15} /> : null}
        <line x1={cx - 11} y1={cy - 11} x2={cx + 11} y2={cy + 11} stroke={color} strokeWidth={2.5} />
        <line x1={cx + 11} y1={cy - 11} x2={cx - 11} y2={cy + 11} stroke={color} strokeWidth={2.5} />
        {inError ? (
          <text x={cx + 13} y={cy - 10} fontSize={10} fill={errorColor} fontWeight="bold">
            !
          </text>
        ) : null}
      </g>
    );
  }

  if (element.type === "cctrl") {
    const cy = cregY(element.cregIdx, nQ);
    const color = inError ? errorColor : selected ? "#F59E0B" : CONNECTOR_BLACK;
    const condLabel = `${element.op} ${element.val}`;
    return (
      <g {...ops}>
        <rect x={cx - 14} y={cy - 18} width={28} height={36} fill="transparent" />
        {selected ? <circle cx={cx} cy={cy} r={12} fill="#F59E0B" opacity={0.15} /> : null}
        <circle cx={cx} cy={cy} r={7} fill={color} />
        <text x={cx} y={cy + 17} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="#475569" fontWeight={600}>
          {condLabel}
        </text>
        {inError ? (
          <text x={cx + 10} y={cy - 8} fontSize={10} fill={errorColor} fontWeight="bold">
            !
          </text>
        ) : null}
      </g>
    );
  }

  const cy = wireY(element.qubit);
  const def = GATE_DEFS[element.gateType];
  const raw = gateSupportsParam(element.gateType) && element.param != null ? `${def.l}(${formatAngle(element.param)})` : def.l;
  const bw = raw.length > 5 ? 56 : GB;
  const fs = raw.length > 6 ? 8 : raw.length > 4 ? 10 : 12;
  const fill = selected ? "#F59E0B" : def.c;
  const stroke = selected ? "#B45309" : "none";

  if (element.gateType === "M") {
    return (
      <g {...ops}>
        <rect x={cx - GB / 2} y={cy - GB / 2} width={GB} height={GB} rx={3} fill={inError ? errorColor : fill} stroke={selected ? "#B45309" : "none"} strokeWidth={2} />
        <path d={`M ${cx - 9} ${cy + 4} A 9 9 0 0 1 ${cx + 9} ${cy + 4}`} stroke="#fff" strokeWidth={1.5} fill="none" />
        <line x1={cx} y1={cy + 4} x2={cx + 8} y2={cy - 6} stroke="#fff" strokeWidth={1.5} />
        <text
          x={cx}
          y={cy - GB / 2 - 4}
          textAnchor="middle"
          fontSize={8}
          fontFamily="monospace"
          fill={element.creg ? UI_COLORS.slate500 : ERROR_COLORS.label}
        >
          {element.creg ?? "no reg"}
        </text>
      </g>
    );
  }

  return (
    <g {...ops}>
      <rect x={cx - bw / 2} y={cy - GB / 2} width={bw} height={GB} rx={3} fill={fill} stroke={stroke} strokeWidth={2} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={fs} fontFamily="monospace" fontWeight={700}>
        {raw}
      </text>
    </g>
  );
}

function formatAngle(rad: number) {
  const pi = rad / Math.PI;
  if (Math.abs(pi - Math.round(pi)) < 0.001) {
    return `${Math.round(pi)}π`;
  }
  if (Math.abs(pi * 2 - Math.round(pi * 2)) < 0.001) {
    return `${Math.round(pi * 2)}/2π`;
  }
  if (Math.abs(pi * 4 - Math.round(pi * 4)) < 0.001) {
    return `${Math.round(pi * 4)}/4π`;
  }
  return rad.toFixed(3);
}
