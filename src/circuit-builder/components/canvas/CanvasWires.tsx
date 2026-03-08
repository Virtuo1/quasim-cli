import { CONNECTOR_BLACK, CW, ERROR_COLORS, UI_COLORS, LW, PX, PY } from "../../constants";
import type { CircuitElement, ClassicalRegister, CustomGateDefinition, QuantumConnectorLine, StepAnalysisMap } from "../../types";
import { classicalControlWireLine, measurementWireLine } from "../../utils/circuit";
import { exprRegisters } from "../../utils/conditions";
import { cregY, wireX, wireY } from "../../utils/layout";

export function StepLabels({
  count,
  stepAnalysis,
}: {
  count: number;
  stepAnalysis: Record<number, { hasError: boolean }>;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, step) => {
        const { hasError } = stepAnalysis[step] ?? {};
        return (
          <g key={`step-${step}`}>
            {hasError ? <text x={wireX(step)} y={10} textAnchor="middle" fontSize={10} fill={ERROR_COLORS.primary}>⚠</text> : null}
            <text x={wireX(step)} y={PY - 12} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontFamily="monospace" fill={hasError ? ERROR_COLORS.primary : UI_COLORS.slate400}>
              {step}
            </text>
          </g>
        );
      })}
    </>
  );
}

export function QubitWires({ nQ, columnCount }: { nQ: number; columnCount: number }) {
  return (
    <>
      {Array.from({ length: nQ }, (_, qubit) => (
        <g key={`wire-${qubit}`}>
          <line x1={PX + LW} y1={wireY(qubit)} x2={PX + LW + columnCount * CW - 4} y2={wireY(qubit)} stroke={UI_COLORS.borderMid} strokeWidth={2} />
          <text x={PX + 6} y={wireY(qubit) + 1} textAnchor="start" dominantBaseline="middle" fontSize={11} fontFamily="monospace" fill={UI_COLORS.slate400}>|0⟩</text>
          <text x={PX + LW - 8} y={wireY(qubit) + 1} textAnchor="end" dominantBaseline="middle" fontSize={12} fontFamily="monospace" fill={UI_COLORS.slate600}>
            q<tspan fontSize={9} dy={3}>{qubit}</tspan>
          </text>
          <line x1={PX + LW + columnCount * CW - 4} y1={wireY(qubit) - 2} x2={PX + LW + columnCount * CW + 6} y2={wireY(qubit) - 2} stroke={UI_COLORS.slate400} strokeWidth={1} />
          <line x1={PX + LW + columnCount * CW - 4} y1={wireY(qubit) + 2} x2={PX + LW + columnCount * CW + 6} y2={wireY(qubit) + 2} stroke={UI_COLORS.slate400} strokeWidth={1} />
        </g>
      ))}
    </>
  );
}

export function QuantumConnectorLines({
  nS,
  elements,
  customGateDefinitions,
  getConnectorLines,
}: {
  nS: number;
  elements: CircuitElement[];
  customGateDefinitions: CustomGateDefinition[];
  getConnectorLines: (stepEls: CircuitElement[], customGateDefinitions?: CustomGateDefinition[]) => QuantumConnectorLine[];
}) {
  return (
    <>
      {Array.from({ length: nS }, (_, step) => {
        const stepElements = elements.filter((el) => el.step === step);
        return getConnectorLines(stepElements, customGateDefinitions).map((line, index) => (
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
    </>
  );
}

export function MeasurementWires({ elements, classicalRegs, nQ }: { elements: CircuitElement[]; classicalRegs: ClassicalRegister[]; nQ: number }) {
  return (
    <>
      {elements
        .filter((el): el is Extract<CircuitElement, { type: "measurement" }> => el.type === "measurement" && !!el.registerName)
        .map((element) => {
          const line = measurementWireLine(element, classicalRegs, nQ);
          if (!line) {
            return null;
          }
          return (
            <g key={`measurement-wire-${element.id}`}>
              <line x1={wireX(line.x)} y1={line.y1} x2={wireX(line.x)} y2={line.y2 - 7} stroke={UI_COLORS.slate500} strokeWidth={1} strokeDasharray="4 3" />
              <polygon points={`${wireX(line.x)},${line.y2} ${wireX(line.x) - 4},${line.y2 - 8} ${wireX(line.x) + 4},${line.y2 - 8}`} fill={UI_COLORS.slate500} />
            </g>
          );
        })}
    </>
  );
}

export function ClassicalControlWires({
  elements,
  classicalRegs,
  selectedIds,
  nQ,
  customGateDefinitions,
  stepAnalysis,
}: {
  elements: CircuitElement[];
  classicalRegs: ClassicalRegister[];
  selectedIds: number[];
  nQ: number;
  customGateDefinitions: CustomGateDefinition[];
  stepAnalysis: StepAnalysisMap;
}) {
  return (
    <>
      {elements
        .filter((el): el is Extract<CircuitElement, { type: "cctrl" }> => el.type === "cctrl")
        .map((element) => {
          const line = classicalControlWireLine(element, elements, classicalRegs, nQ, customGateDefinitions);
          const visibleRegisterIndices = exprRegisters(element.condition)
            .map((registerName) => classicalRegs.findIndex((register) => register.name === registerName))
            .filter((registerIndex): registerIndex is number => registerIndex >= 0)
            .sort((left, right) => left - right);
          const analysis = stepAnalysis[element.step];
          const inError = analysis.cctrlOrphan || analysis.cctrlMultiple;
          const selected = selectedIds.includes(element.id);

          return (
            <g key={`classical-control-wire-${element.id}`}>
              {line ? (
                <>
                  <line
                    x1={wireX(element.step) - 2}
                    y1={line.y1}
                    x2={wireX(element.step) - 2}
                    y2={line.y2}
                    stroke={inError ? ERROR_COLORS.primary : CONNECTOR_BLACK}
                    strokeWidth={2}
                  />
                  <line
                    x1={wireX(element.step) + 2}
                    y1={line.y1}
                    x2={wireX(element.step) + 2}
                    y2={line.y2}
                    stroke={inError ? ERROR_COLORS.primary : CONNECTOR_BLACK}
                    strokeWidth={2}
                  />
                </>
              ) : null}
              {(visibleRegisterIndices.length > 0 ? visibleRegisterIndices : [element.cregIdx]).map((registerIndex) => (
                <g key={`classical-control-node-${element.id}-${registerIndex}`}>
                  {selected ? (
                    <circle
                      cx={wireX(element.step)}
                      cy={cregY(registerIndex, nQ)}
                      r={12}
                      fill={UI_COLORS.amber500}
                      opacity={0.15}
                    />
                  ) : null}
                  <circle
                    cx={wireX(element.step)}
                    cy={cregY(registerIndex, nQ)}
                    r={7}
                    fill={inError ? ERROR_COLORS.primary : selected ? UI_COLORS.amber500 : CONNECTOR_BLACK}
                  />
                </g>
              ))}
            </g>
          );
        })}
    </>
  );
}

export function ClassicalRegisterLines({ classicalRegs, nQ, nS }: { classicalRegs: ClassicalRegister[]; nQ: number; nS: number }) {
  if (classicalRegs.length === 0) {
    return null;
  }

  const wireStart = PX + LW;
  const wireEnd = PX + LW + nS * CW - 4;
  return (
    <>
      {classicalRegs.map((reg, index) => {
        const y = cregY(index, nQ);
        return (
          <g key={reg.id}>
            <line x1={wireStart} y1={y - 2} x2={wireEnd} y2={y - 2} stroke={UI_COLORS.slate400} strokeWidth={2} />
            <line x1={wireStart} y1={y + 2} x2={wireEnd} y2={y + 2} stroke={UI_COLORS.slate400} strokeWidth={2} />
            <text x={PX + 6} y={y + 1} textAnchor="start" dominantBaseline="middle" fontSize={10} fontFamily="monospace" fill={UI_COLORS.slate500} fontStyle="italic">c/</text>
            <text x={PX + 18} y={y + 1} textAnchor="start" dominantBaseline="middle" fontSize={11} fontFamily="monospace" fill={UI_COLORS.slate600}>{reg.name}</text>
            <line x1={wireEnd} y1={y - 5} x2={wireEnd} y2={y + 5} stroke={UI_COLORS.slate400} strokeWidth={2} />
          </g>
        );
      })}
    </>
  );
}
