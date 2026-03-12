import { useEffect, useMemo, useState } from "react";

import { ERROR_COLORS, UI_COLORS } from "../../constants";
import { controlStyle, panelCardStyle, subtleTextStyle } from "../../ui/styles";
import type { ClassicalRegister, Expr } from "../../types";
import {
  describeExpr,
  getBinaryOperands,
  getExprAtPath,
  getExprKind,
  getNotOperand,
  inferExprType,
  isLeafExpr,
  replaceExprKind,
  updateExprAtPath,
  validateExpression,
} from "../../utils/conditions";
import { ModalFrame } from "./ModalFrame";
import {
  modalActionsStyle,
  modalDangerPanelStyle,
  modalFieldLabelStyle,
  modalPrimaryButtonStyle,
  modalSecondaryButtonStyle,
} from "./modalStyles";

interface ExpressionEditorModalProps {
  isOpen: boolean;
  expr: Expr | null;
  classicalRegs: ClassicalRegister[];
  summaryItems: (expr: Expr) => Array<{ title: string; value: string; }>;
  validateExpr: (expr: Expr) => string[];
  onCancel: () => void;
  onApply: (expr: Expr) => void;
  applyDisabled?: boolean;
  renderInspectorExtras?: (args: {
    selectedExpr: Expr;
    updateSelectedExpr: (updater: (expr: Expr) => Expr) => void;
    classicalRegs: ClassicalRegister[];
  }) => React.ReactNode;
}

interface TreeNode {
  path: string;
  expr: Expr;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "circle";
}

interface TreeEdge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface TreeLayout {
  width: number;
  height: number;
  nodes: TreeNode[];
  edges: TreeEdge[];
}

interface PanState {
  x: number;
  y: number;
}

interface DragPanState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

const LEAF_NODE_WIDTH = 112;
const LEAF_NODE_HEIGHT = 38;
const OP_NODE_SIZE = 42;
const H_GAP = 24;
const V_GAP = 64;
const CANVAS_HEIGHT = 460;
const INITIAL_PAN: PanState = { x: 48, y: 34 };

const EXPR_KIND_GROUPS: Array<{ label: string; options: Array<{ value: ReturnType<typeof getExprKind>; label: string }> }> = [
  {
    label: "Leaves",
    options: [
      { value: "reg", label: "Register" },
      { value: "int", label: "Integer" },
      { value: "float", label: "Float" },
      { value: "bool", label: "Boolean" },
    ],
  },
  {
    label: "Boolean / Bitwise",
    options: [
      { value: "not", label: "NOT" },
      { value: "and", label: "AND" },
      { value: "or", label: "OR" },
      { value: "xor", label: "XOR" },
    ],
  },
  {
    label: "Arithmetic",
    options: [
      { value: "add", label: "Add" },
      { value: "sub", label: "Subtract" },
      { value: "mul", label: "Multiply" },
      { value: "div", label: "Divide" },
      { value: "rem", label: "Remainder" },
    ],
  },
  {
    label: "Comparison",
    options: [
      { value: "eq", label: "Equal" },
      { value: "lt", label: "Less Than" },
    ],
  },
];

export function ExpressionEditorModal({
  isOpen,
  expr,
  classicalRegs,
  summaryItems,
  validateExpr,
  onCancel,
  onApply,
  applyDisabled = false,
  renderInspectorExtras,
}: ExpressionEditorModalProps) {
  const [localExpr, setLocalExpr] = useState<Expr | null>(expr);
  const [selectedPath, setSelectedPath] = useState("root");
  const [pan, setPan] = useState<PanState>(INITIAL_PAN);
  const [dragPan, setDragPan] = useState<DragPanState | null>(null);

  useEffect(() => {
    setLocalExpr(expr);
    setSelectedPath("root");
    setPan(INITIAL_PAN);
    setDragPan(null);
  }, [expr, isOpen]);

  useEffect(() => {
    if (!dragPan) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setPan({
        x: dragPan.originX + (event.clientX - dragPan.startX),
        y: dragPan.originY + (event.clientY - dragPan.startY),
      });
    };

    const handlePointerUp = () => {
      setDragPan(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragPan]);

  useEffect(() => {
    if (!localExpr) {
      return;
    }

    if (!getExprAtPath(localExpr, selectedPath)) {
      setSelectedPath("root");
    }
  }, [localExpr, selectedPath]);

  const layout = useMemo(() => (localExpr ? layoutExprTree(localExpr, "root") : null), [localExpr]);

  if (!isOpen || !localExpr || !layout) {
    return null;
  }

  const issues = validateExpr(localExpr);
  const fallbackRegister = classicalRegs[0]?.name ?? null;
  const selectedExpr = getExprAtPath(localExpr, selectedPath) ?? localExpr;
  const liveSummaryItems = summaryItems(localExpr);
  const updateSelectedExpr = (updater: (expr: Expr) => Expr) => {
    setLocalExpr((current) => (current ? updateExprAtPath(current, selectedPath, updater) : current));
  };

  const handleTreeBackgroundPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as SVGElement).dataset.role !== "tree-background") {
      return;
    }
    event.preventDefault();
    setDragPan({
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
    });
  };

  return (
    <ModalFrame width={1180}>
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={summaryGridStyle}>
          {liveSummaryItems.map((item) => (
            <SummaryCard key={item.title} title={item.title} value={item.value} />
          ))}
        </div>

        {issues.length > 0 ? <div style={errorPanelStyle}>{issues.join(" ")}</div> : null}

        <div style={splitPaneStyle}>
          <div style={treePanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={panelTitleStyle}>Expression Tree</div>
                <div style={panelSubtitleStyle}>Click nodes to edit them. Drag the background to pan.</div>
              </div>
              <button onClick={() => setPan(INITIAL_PAN)} style={modalSecondaryButtonStyle}>
                Reset view
              </button>
            </div>
            <div style={treeViewportStyle}>
              <svg
                width="100%"
                height={CANVAS_HEIGHT}
                onPointerDown={handleTreeBackgroundPointerDown}
                style={{ display: "block", cursor: dragPan ? "grabbing" : "grab" }}
              >
                <rect data-role="tree-background" x={0} y={0} width="100%" height="100%" fill={UI_COLORS.panelBg} />
                <g transform={`translate(${pan.x}, ${pan.y})`}>
                  {layout.edges.map((edge, index) => (
                    <path
                      key={`edge-${index}`}
                      d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${(edge.fromY + edge.toY) / 2}, ${edge.toX} ${edge.toY}`}
                      fill="none"
                      stroke={UI_COLORS.borderMid}
                      strokeWidth={2}
                    />
                  ))}
                  {layout.nodes.map((node) => (
                    <ExprTreeNodeView
                      key={node.path}
                      node={node}
                      selected={node.path === selectedPath}
                      onSelect={setSelectedPath}
                    />
                  ))}
                </g>
              </svg>
            </div>
            <div style={treeFooterStyle}>
              <span>Selected: <b>{getExprKindMeta(getExprKind(selectedExpr)).label}</b></span>
              <span style={{ color: UI_COLORS.slate500 }}>Tree size {layout.nodes.length} nodes</span>
            </div>
          </div>

          <div style={inspectorPanelStyle}>
            <div style={panelHeaderStyle}>
              <div>
                <div style={panelTitleStyle}>Inspector</div>
                <div style={panelSubtitleStyle}>Edit the currently selected node.</div>
              </div>
            </div>

            <div style={inspectorContentStyle}>
              <SummaryCard title="Selected Node" value={describeExpr(selectedExpr)} />

              {renderInspectorExtras
                ? renderInspectorExtras({
                    selectedExpr,
                    updateSelectedExpr,
                    classicalRegs,
                  })
                : null}

              <div style={fieldBlockStyle}>
                <div style={fieldLabelStyle}>Node Type</div>
                <select
                  value={getExprKind(selectedExpr)}
                  onChange={(event) =>
                    updateSelectedExpr((current) =>
                      replaceExprKind(current, event.target.value as ReturnType<typeof getExprKind>, fallbackRegister),
                    )
                  }
                  style={selectStyle}
                >
                  {EXPR_KIND_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <SelectedNodeValueEditor
                selectedExpr={selectedExpr}
                classicalRegs={classicalRegs}
                onChange={updateSelectedExpr}
              />
            </div>
          </div>
        </div>

        <div style={{ ...modalActionsStyle, marginTop: 16 }}>
          <button onClick={onCancel} style={modalSecondaryButtonStyle}>
            Cancel
          </button>
          <button
            onClick={() => onApply(localExpr)}
            disabled={issues.length > 0 || applyDisabled}
            style={{ ...modalPrimaryButtonStyle, opacity: issues.length > 0 || applyDisabled ? 0.5 : 1 }}
          >
            Apply
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function SummaryCard({ title, value }: { title: string; value: string; }) {
  return (
    <div style={summaryCardStyle}>
      <div style={eyebrowStyle}>{title}</div>
      <div
        style={{
          fontSize: 12,
          color: UI_COLORS.slate700,
          fontFamily: "monospace",
          lineHeight: 1.45,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ExprTreeNodeView({
  node,
  selected,
  onSelect,
}: {
  node: TreeNode;
  selected: boolean;
  onSelect: (path: string) => void;
}) {
  const meta = getExprKindMeta(getExprKind(node.expr));
  const nodeStroke = selected ? UI_COLORS.amber500 : UI_COLORS.borderMid;
  const nodeFill = getExprNodeFill(node.expr);

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelect(node.path);
      }}
      style={{ cursor: "pointer" }}
    >
      {selected ? (
        <rect
          x={node.shape === "circle" ? node.width / 2 - (node.width + 6) / 2 : -3}
          y={node.shape === "circle" ? node.height / 2 - (node.height + 6) / 2 : -3}
          width={node.width + 6}
          height={node.height + 6}
          rx={node.shape === "circle" ? (node.width + 6) / 2 : 6}
          fill={UI_COLORS.amber500}
          opacity={0.14}
        />
      ) : null}
      {node.shape === "circle" ? (
        <circle
          cx={node.width / 2}
          cy={node.height / 2}
          r={node.width / 2}
          fill={nodeFill}
          stroke={nodeStroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      ) : (
        <rect
          width={node.width}
          height={node.height}
          rx={5}
          fill={nodeFill}
          stroke={nodeStroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
      )}
      <text
        x={node.width / 2}
        y={node.shape === "circle" ? node.height / 2 + 4 : 16}
        textAnchor="middle"
        fontSize={11}
        fontFamily="monospace"
        fontWeight={700}
        fill={UI_COLORS.slate800}
        style={{ userSelect: "none" }}
      >
        {meta.symbol}
      </text>
      {node.shape === "rect" ? (
        <text
          x={node.width / 2}
          y={30}
          textAnchor="middle"
          fontSize={10}
          fontFamily="monospace"
          fill={UI_COLORS.slate600}
          style={{ userSelect: "none" }}
        >
          {describeLeafNodeValue(node.expr)}
        </text>
      ) : null}
    </g>
  );
}

function SelectedNodeValueEditor({
  selectedExpr,
  classicalRegs,
  onChange,
}: {
  selectedExpr: Expr;
  classicalRegs: ClassicalRegister[];
  onChange: (updater: (expr: Expr) => Expr) => void;
}) {
  const kind = getExprKind(selectedExpr);

  if (kind === "reg") {
    return (
      <div style={fieldBlockStyle}>
        <div style={fieldLabelStyle}>Register</div>
        <select
          value={"Reg" in selectedExpr ? selectedExpr.Reg : ""}
          onChange={(event) => onChange(() => ({ Reg: event.target.value }))}
          style={selectStyle}
        >
          <option value="">Select register</option>
          {classicalRegs.map((register) => (
            <option key={register.id} value={register.name}>
              {register.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (kind === "int" || kind === "float") {
    const value =
      "Val" in selectedExpr && "Int" in selectedExpr.Val
        ? selectedExpr.Val.Int
        : "Val" in selectedExpr && "Float" in selectedExpr.Val
          ? selectedExpr.Val.Float
          : 0;
    return (
      <div style={fieldBlockStyle}>
        <div style={fieldLabelStyle}>{kind === "float" ? "Float Value" : "Integer Value"}</div>
        <input
          type="number"
          step={kind === "float" ? 0.001 : 1}
          value={value}
          onChange={(event) =>
            onChange(() => ({
              Val:
                kind === "float"
                  ? { Float: Number.parseFloat(event.target.value) || 0 }
                  : { Int: Number.parseInt(event.target.value, 10) || 0 },
            }))
          }
          style={inputStyle}
        />
      </div>
    );
  }

  if (kind === "bool") {
    return (
      <div style={fieldBlockStyle}>
        <div style={fieldLabelStyle}>Boolean Value</div>
        <select
          value={"Val" in selectedExpr && "Bool" in selectedExpr.Val && selectedExpr.Val.Bool ? "true" : "false"}
          onChange={(event) => onChange(() => ({ Val: { Bool: event.target.value === "true" } }))}
          style={selectStyle}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </div>
    );
  }

  return null;
}

function getExprKindMeta(kind: ReturnType<typeof getExprKind>) {
  switch (kind) {
    case "reg":
      return { label: "Register", symbol: "REG" };
    case "int":
      return { label: "Integer", symbol: "INT" };
    case "float":
      return { label: "Float", symbol: "FLOAT" };
    case "bool":
      return { label: "Boolean", symbol: "BOOL" };
    case "not":
      return { label: "NOT", symbol: "NOT" };
    case "and":
      return { label: "AND", symbol: "AND" };
    case "or":
      return { label: "OR", symbol: "OR" };
    case "xor":
      return { label: "XOR", symbol: "XOR" };
    case "add":
      return { label: "+", symbol: "+" };
    case "sub":
      return { label: "-", symbol: "-" };
    case "mul":
      return { label: "*", symbol: "*" };
    case "div":
      return { label: "/", symbol: "/" };
    case "rem":
      return { label: "%", symbol: "%" };
    case "eq":
      return { label: "==", symbol: "==" };
    case "lt":
      return { label: "<", symbol: "<" };
  }
}

function getExprNodeFill(expr: Expr) {
  if (validateExpression(expr).length > 0) {
    return UI_COLORS.rose50;
  }

  switch (inferExprType(expr)) {
    case "int":
      return UI_COLORS.blue50;
    case "float":
      return "#ecfdf5";
    case "bool":
      return UI_COLORS.yellow50;
    default:
      return UI_COLORS.white;
  }
}

function getNodeSize(expr: Expr) {
  return isLeafExpr(expr)
    ? { width: LEAF_NODE_WIDTH, height: LEAF_NODE_HEIGHT, shape: "rect" as const }
    : { width: OP_NODE_SIZE, height: OP_NODE_SIZE, shape: "circle" as const };
}

function describeLeafNodeValue(expr: Expr) {
  switch (getExprKind(expr)) {
    case "reg":
      return "Reg" in expr && expr.Reg ? expr.Reg : "unset";
    case "int":
      return "Val" in expr && "Int" in expr.Val ? String(expr.Val.Int) : "";
    case "float":
      return "Val" in expr && "Float" in expr.Val ? String(expr.Val.Float) : "";
    case "bool":
      return "Val" in expr && "Bool" in expr.Val && expr.Val.Bool ? "true" : "false";
    default:
      return "";
  }
}

function layoutExprTree(expr: Expr, path: string): TreeLayout {
  return layoutNode(expr, path, 0, 0);
}

function layoutNode(expr: Expr, path: string, originX: number, originY: number): TreeLayout {
  const nodeSize = getNodeSize(expr);
  const childOriginY = originY + nodeSize.height + V_GAP;

  if (getExprKind(expr) === "not") {
    const child = layoutNode(getNotOperand(expr)!, `${path}.expr`, 0, childOriginY);
    const width = Math.max(nodeSize.width, child.width);
    const currentNodeX = originX + (width - nodeSize.width) / 2;
    const childOffsetX = originX + (width - child.width) / 2;
    return {
      width,
      height: nodeSize.height + V_GAP + child.height,
      nodes: [
        { path, expr, x: currentNodeX, y: originY, ...nodeSize },
        ...offsetNodes(child.nodes, childOffsetX, 0),
      ],
      edges: [
        {
          fromX: currentNodeX + nodeSize.width / 2,
          fromY: originY + nodeSize.height,
          toX: childOffsetX + child.width / 2,
          toY: childOriginY,
        },
        ...offsetEdges(child.edges, childOffsetX, 0),
      ],
    };
  }

  const operands = getBinaryOperands(expr);
  if (operands) {
    const [leftExpr, rightExpr] = operands;
    const left = layoutNode(leftExpr, `${path}.left`, 0, childOriginY);
    const right = layoutNode(rightExpr, `${path}.right`, 0, childOriginY);
    const childrenWidth = left.width + H_GAP + right.width;
    const width = Math.max(nodeSize.width, childrenWidth);
    const currentNodeX = originX + (width - nodeSize.width) / 2;
    const leftOffsetX = originX + (width - childrenWidth) / 2;
    const rightOffsetX = leftOffsetX + left.width + H_GAP;

    return {
      width,
      height: nodeSize.height + V_GAP + Math.max(left.height, right.height),
      nodes: [
        { path, expr, x: currentNodeX, y: originY, ...nodeSize },
        ...offsetNodes(left.nodes, leftOffsetX, 0),
        ...offsetNodes(right.nodes, rightOffsetX, 0),
      ],
      edges: [
        {
          fromX: currentNodeX + nodeSize.width / 2,
          fromY: originY + nodeSize.height,
          toX: leftOffsetX + left.width / 2,
          toY: childOriginY,
        },
        {
          fromX: currentNodeX + nodeSize.width / 2,
          fromY: originY + nodeSize.height,
          toX: rightOffsetX + right.width / 2,
          toY: childOriginY,
        },
        ...offsetEdges(left.edges, leftOffsetX, 0),
        ...offsetEdges(right.edges, rightOffsetX, 0),
      ],
    };
  }

  return {
    width: nodeSize.width,
    height: nodeSize.height,
    nodes: [{ path, expr, x: originX, y: originY, ...nodeSize }],
    edges: [],
  };
}

function offsetNodes(nodes: TreeNode[], dx: number, dy: number): TreeNode[] {
  return nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy }));
}

function offsetEdges(edges: TreeEdge[], dx: number, dy: number): TreeEdge[] {
  return edges.map((edge) => ({
    fromX: edge.fromX + dx,
    fromY: edge.fromY + dy,
    toX: edge.toX + dx,
    toY: edge.toY + dy,
  }));
}

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 10,
  marginBottom: 12,
};

const summaryCardStyle: React.CSSProperties = {
  ...panelCardStyle(),
  background: UI_COLORS.panelBg,
  padding: "10px 12px",
  minWidth: 0,
};

const splitPaneStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) 320px",
  gap: 14,
  minHeight: 0,
  flex: 1,
};

const treePanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  ...panelCardStyle(),
};

const inspectorPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  ...panelCardStyle(),
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 14px",
  borderBottom: `1px solid ${UI_COLORS.borderLight}`,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: UI_COLORS.slate800,
  marginBottom: 3,
};

const panelSubtitleStyle: React.CSSProperties = {
  ...subtleTextStyle,
  lineHeight: 1.4,
};

const treeViewportStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  background: UI_COLORS.panelBg,
  overflow: "hidden",
};

const treeFooterStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderTop: `1px solid ${UI_COLORS.borderLight}`,
  fontSize: 11,
  color: UI_COLORS.slate700,
  display: "flex",
  justifyContent: "space-between",
};

const inspectorContentStyle: React.CSSProperties = {
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  overflowY: "auto",
  minHeight: 0,
};

const errorPanelStyle: React.CSSProperties = {
  ...modalDangerPanelStyle,
  padding: "8px 10px",
  marginBottom: 12,
  color: ERROR_COLORS.primary,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: UI_COLORS.slate500,
  marginBottom: 4,
  letterSpacing: 0.2,
};

const fieldBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

const fieldLabelStyle: React.CSSProperties = {
  ...modalFieldLabelStyle,
};

const selectStyle: React.CSSProperties = {
  ...controlStyle(),
  width: "100%",
  fontFamily: "monospace",
  fontSize: 12,
  boxSizing: "border-box",
};

const inputStyle: React.CSSProperties = {
  ...controlStyle(),
  width: "100%",
  fontFamily: "monospace",
  fontSize: 12,
  boxSizing: "border-box",
};
