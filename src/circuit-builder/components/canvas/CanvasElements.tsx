import { CONNECTOR_BLACK, ERROR_COLORS, GB, CLASSICAL_OP_DEFS, UI_COLORS, UNITARY_OP_DEFS, unitaryGateSupportsParam } from "../../constants";
import type { CircuitElement, CustomGateDefinition } from "../../types";
import { describeExprCompact, exprRegisters } from "../../utils/conditions";
import { customGateOccupiedQubits, findCustomGateDefinition } from "../../utils/customGates";
import { cregY, wireX, wireY } from "../../utils/layout";

export function ElementNode({
  element,
  selected,
  dragging,
  inError,
  onPointerDown,
  nQ,
  classicalRegs = [],
  customGateDefinitions = [],
}: {
  element: CircuitElement;
  selected: boolean;
  dragging: boolean;
  inError: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  nQ: number;
  classicalRegs?: { id: number; name: string }[];
  customGateDefinitions?: CustomGateDefinition[];
}) {
  const cx = wireX(element.step);
  const errorColor = ERROR_COLORS.primary;
  const selectedStrokeColor = inError ? UI_COLORS.amber500 : UI_COLORS.amber700;
  const ops = {
    className: "gate-el",
    style: { cursor: "grab", opacity: dragging ? 0.18 : 1 },
    onPointerDown,
  };

  if (element.type === "ctrl") {
    const cy = wireY(element.qubit);
    const color = inError ? errorColor : selected ? UI_COLORS.amber500 : CONNECTOR_BLACK;
    return (
      <g {...ops}>
        {selected ? <circle cx={cx} cy={cy} r={12} fill={UI_COLORS.amber500} opacity={0.15} /> : null}
        <circle cx={cx} cy={cy} r={7} fill={color} />
        {inError ? <text x={cx + 10} y={cy - 8} fontSize={10} fill={errorColor} fontWeight="bold">!</text> : null}
      </g>
    );
  }

  if (element.type === "swap") {
    const cy = wireY(element.qubit);
    const color = inError ? errorColor : selected ? UI_COLORS.amber500 : CONNECTOR_BLACK;
    return (
      <g {...ops}>
        <rect x={cx - 18} y={cy - 18} width={36} height={36} fill="transparent" />
        {selected ? <rect x={cx - 16} y={cy - 16} width={32} height={32} rx={3} fill={UI_COLORS.amber500} opacity={0.15} /> : null}
        <line x1={cx - 11} y1={cy - 11} x2={cx + 11} y2={cy + 11} stroke={color} strokeWidth={2.5} />
        <line x1={cx + 11} y1={cy - 11} x2={cx - 11} y2={cy + 11} stroke={color} strokeWidth={2.5} />
        {inError ? <text x={cx + 13} y={cy - 10} fontSize={10} fill={errorColor} fontWeight="bold">!</text> : null}
      </g>
    );
  }

  if (element.type === "cctrl") {
    const registerIndices = exprRegisters(element.condition)
      .map((registerName) => classicalRegs.findIndex((register) => register.name === registerName))
      .filter((index): index is number => index >= 0);
    const topRegisterIndex = registerIndices.length > 0 ? Math.min(...registerIndices) : element.cregIdx;
    const bottomRegisterIndex = registerIndices.length > 0 ? Math.max(...registerIndices) : element.cregIdx;
    const topY = cregY(topRegisterIndex, nQ) - 18;
    const boxHeight = cregY(bottomRegisterIndex, nQ) - cregY(topRegisterIndex, nQ) + 36;
    return (
      <g {...ops}>
        <rect x={cx - 16} y={topY} width={32} height={boxHeight} fill="transparent" />
        {selected ? <rect x={cx - 18} y={topY - 3} width={36} height={boxHeight + 6} rx={4} fill={UI_COLORS.amber500} opacity={0.12} /> : null}
        <text
          x={cx}
          y={cregY(bottomRegisterIndex, nQ) + 17}
          textAnchor="middle"
          fontSize={8}
          fontFamily="monospace"
          fill={inError ? errorColor : UI_COLORS.slate600}
          fontWeight={600}
        >
          {describeExprCompact(element.condition, 10)}
        </text>
        {inError ? <text x={cx + 12} y={topY + 10} fontSize={10} fill={errorColor} fontWeight="bold">!</text> : null}
      </g>
    );
  }

  if (element.type === "custom") {
    const definition = findCustomGateDefinition(element.classifier, customGateDefinitions);
    const occupiedQubits = customGateOccupiedQubits(element, definition);
    const topQubit = Math.min(...occupiedQubits);
    const bottomQubit = Math.max(...occupiedQubits);
    const topY = wireY(topQubit) - GB / 2;
    const bottomY = wireY(bottomQubit) + GB / 2;
    const boxHeight = bottomY - topY;
    const fill = inError ? errorColor : selected ? UI_COLORS.amber500 : CONNECTOR_BLACK;
    return (
      <g {...ops}>
        <rect x={cx - 24} y={topY} width={48} height={boxHeight} rx={4} fill={fill} stroke={selected ? selectedStrokeColor : inError ? errorColor : "none"} strokeWidth={selected || inError ? 2 : 0} />
        <text x={cx} y={topY + boxHeight / 2} textAnchor="middle" dominantBaseline="middle" fill={UI_COLORS.white} fontSize={10} fontFamily="monospace" fontWeight={700}>
          {definition?.classifier ?? element.classifier}
        </text>
      </g>
    );
  }

  if (element.type === "jump") {
    const topY = wireY(0) - GB / 2;
    const bottomY = wireY(nQ - 1) + GB / 2;
    const boxHeight = bottomY - topY;
    const fill = inError ? ERROR_COLORS.previewFill : UI_COLORS.white;
    const stroke = inError ? errorColor : selected ? UI_COLORS.amber700 : CONNECTOR_BLACK;
    const textColor = inError ? errorColor : CONNECTOR_BLACK;
    return (
      <g {...ops}>
        {selected ? <rect x={cx - 28} y={topY - 4} width={56} height={boxHeight + 8} rx={6} fill={UI_COLORS.amber500} opacity={0.15} /> : null}
        <rect x={cx - 24} y={topY} width={48} height={boxHeight} rx={4} fill={fill} stroke={stroke} strokeWidth={2} />
        <text x={cx} y={topY + boxHeight / 2 - 8} textAnchor="middle" dominantBaseline="middle" fill={textColor} fontSize={13} fontFamily="monospace" fontWeight={700}>
          {CLASSICAL_OP_DEFS.jump.label}
        </text>
        <text x={cx} y={topY + boxHeight / 2 + 10} textAnchor="middle" dominantBaseline="middle" fill={textColor} fontSize={9} fontFamily="monospace" fontWeight={700}>
          {element.targetStep == null ? "?" : `-> ${element.targetStep}`}
        </text>
      </g>
    );
  }

  const cy = wireY(element.qubit);
  if (element.type === "measurement") {
    const fill = selected ? UI_COLORS.amber500 : CLASSICAL_OP_DEFS.measurement.color;
    return (
      <g {...ops}>
        <rect x={cx - GB / 2} y={cy - GB / 2} width={GB} height={GB} rx={3} fill={inError ? errorColor : fill} stroke={selected ? selectedStrokeColor : inError ? errorColor : "none"} strokeWidth={selected || inError ? 2 : 0} />
        <path d={`M ${cx - 9} ${cy + 4} A 9 9 0 0 1 ${cx + 9} ${cy + 4}`} stroke={UI_COLORS.white} strokeWidth={1.5} fill="none" />
        <line x1={cx} y1={cy + 4} x2={cx + 8} y2={cy - 6} stroke={UI_COLORS.white} strokeWidth={1.5} />
        <text x={cx} y={cy - GB / 2 - 4} textAnchor="middle" fontSize={8} fontFamily="monospace" fill={element.registerName ? UI_COLORS.slate500 : ERROR_COLORS.label}>
          {element.registerName ? `${element.registerName}[${element.bitIndex ?? "?"}]` : "no reg"}
        </text>
      </g>
    );
  }

  if (element.type === "assign") {
    const fill = inError ? errorColor : selected ? UI_COLORS.amber500 : CLASSICAL_OP_DEFS.assign.color;
    return (
      <g {...ops}>
        <rect x={cx - GB / 2} y={cy - GB / 2} width={GB} height={GB} rx={3} fill={fill} stroke={selected ? selectedStrokeColor : inError ? errorColor : "none"} strokeWidth={selected || inError ? 2 : 0} />
        <text x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="middle" fill={UI_COLORS.white} fontSize={11} fontFamily="monospace" fontWeight={700}>
          :=
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle" fill={UI_COLORS.white} fontSize={8} fontFamily="monospace" fontWeight={700}>
          {describeExprCompact(element.expr, 8)}
        </text>
        <text x={cx} y={cy - GB / 2 - 4} textAnchor="middle" fontSize={8} fontFamily="monospace" fill={element.registerName ? UI_COLORS.slate500 : ERROR_COLORS.label}>
          {element.registerName ?? "no reg"}
        </text>
      </g>
    );
  }

  if (element.type === "reset") {
    const fill = inError ? errorColor : selected ? UI_COLORS.amber500 : CLASSICAL_OP_DEFS.reset.color;
    return (
      <g {...ops}>
        <rect x={cx - GB / 2} y={cy - GB / 2} width={GB} height={GB} rx={3} fill={fill} stroke={selected ? selectedStrokeColor : inError ? errorColor : "none"} strokeWidth={selected || inError ? 2 : 0} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={UI_COLORS.white} fontSize={12} fontFamily="monospace" fontWeight={700}>
          {CLASSICAL_OP_DEFS.reset.label}
        </text>
      </g>
    );
  }

  const definition = UNITARY_OP_DEFS[element.kind];
  const raw =
    unitaryGateSupportsParam(element.kind) && element.params && element.params.length > 0
      ? `${definition.label}(${element.params.map((value) => formatAngle(value)).join(",")})`
      : definition.label;
  const boxWidth = raw.length > 5 ? 56 : GB;
  const fontSize = raw.length > 6 ? 8 : raw.length > 4 ? 10 : 12;
  const fill = inError ? errorColor : selected ? UI_COLORS.amber500 : definition.color;

  return (
    <g {...ops}>
      <rect x={cx - boxWidth / 2} y={cy - GB / 2} width={boxWidth} height={GB} rx={3} fill={fill} stroke={selected ? selectedStrokeColor : inError ? errorColor : "none"} strokeWidth={selected || inError ? 2 : 0} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={UI_COLORS.white} fontSize={fontSize} fontFamily="monospace" fontWeight={700}>
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
