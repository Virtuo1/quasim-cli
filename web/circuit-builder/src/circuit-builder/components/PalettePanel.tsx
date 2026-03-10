import { CONNECTOR_BLACK, CLASSICAL_OP_DEFS, CLASSICAL_OP_KINDS, UI_COLORS, UNITARY_OP_DEFS, UNITARY_GATE_KINDS, unitaryGateSupportsParam } from "../constants";
import type { CanvasElement, ClassicalRegister, CustomGateDefinition, PaletteDragSpec } from "../types";
import { describeExpr, exprRegisters } from "../utils/conditions";
import { fmt } from "../utils/layout";

interface PalettePanelProps {
  width: number;
  classicalRegs: ClassicalRegister[];
  customGateDefinitions: CustomGateDefinition[];
  selectedElement: CanvasElement | null;
  selectedCount: number;
  customGateCreationError: string | null;
  newRegName: string;
  onNewRegNameChange: (value: string) => void;
  onAddRegister: () => void;
  onDeleteRegister: (id: number) => void;
  onStartPaletteDrag: (event: React.PointerEvent, spec: PaletteDragSpec) => void;
  onEditSelectedParam: (id: number, values: number[]) => void;
  onEditSelectedCreg: (id: number) => void;
  onEditSelectedAssign: (id: number) => void;
  onEditSelectedCondition: (id: number) => void;
  onEditSelectedJump: (id: number) => void;
  onCreateCustomGate: () => void;
  onDeleteSelected: (id: number) => void;
  onDeleteSelectedSet: () => void;
}

export function PalettePanel({
  width,
  classicalRegs,
  customGateDefinitions,
  selectedElement,
  selectedCount,
  customGateCreationError,
  newRegName,
  onNewRegNameChange,
  onAddRegister,
  onDeleteRegister,
  onStartPaletteDrag,
  onEditSelectedParam,
  onEditSelectedCreg,
  onEditSelectedAssign,
  onEditSelectedCondition,
  onEditSelectedJump,
  onCreateCustomGate,
  onDeleteSelected,
  onDeleteSelectedSet,
}: PalettePanelProps) {
  const duplicateRegName = classicalRegs.some((reg) => reg.name === newRegName.trim());
  const canCreateCustomGate = selectedCount > 1 && !customGateCreationError;

  return (
    <div
      style={{
        width,
        background: UI_COLORS.white,
        borderRight: `1px solid ${UI_COLORS.borderLight}`,
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: "8px 10px 5px",
          fontSize: 10,
          color: UI_COLORS.slate400,
          letterSpacing: 0.3,
          borderBottom: `1px solid ${UI_COLORS.appBg}`,
        }}
      >
        Drag elements onto the circuit
      </div>

      <div>
        <SectionTitle>Gates</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 8px 8px" }}>
          {UNITARY_GATE_KINDS.map((kind) => {
            const definition = UNITARY_OP_DEFS[kind];
            return (
              <button
                key={kind}
                title={definition.description}
                onPointerDown={(event) => onStartPaletteDrag(event, { type: "unitary", kind })}
                style={{
                  padding: "5px 8px",
                  cursor: "grab",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 12,
                  borderRadius: 3,
                  background: definition.color,
                  color: UI_COLORS.white,
                  border: `1.5px solid ${definition.color}`,
                  minWidth: 35,
                  width: "auto",
                  flex: "0 0 auto",
                }}
              >
                {definition.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>Classical Ops</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 8px 8px" }}>
          {CLASSICAL_OP_KINDS.map((type) => {
            const definition = CLASSICAL_OP_DEFS[type];
            return (
              <button
                key={type}
                title={definition.description}
                onPointerDown={(event) => onStartPaletteDrag(event, { type })}
                style={{
                  padding: "5px 8px",
                  cursor: "grab",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  fontSize: 12,
                  borderRadius: 3,
                  background: definition.color,
                  color: UI_COLORS.white,
                  border: `1.5px solid ${definition.color}`,
                  minWidth: 35,
                  width: "auto",
                  flex: "0 0 auto",
                }}
              >
                {definition.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>Connectors</SectionTitle>
        <div style={{ padding: "6px 8px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
          <button
            title="Control node — drag onto a qubit line for quantum control, or onto a classical register line for a conditional"
            onPointerDown={(event) => onStartPaletteDrag(event, { type: "ctrl" })}
            style={connectorButtonStyle(CONNECTOR_BLACK)}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = CONNECTOR_BLACK;
              event.currentTarget.style.color = UI_COLORS.white;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = UI_COLORS.white;
              event.currentTarget.style.color = CONNECTOR_BLACK;
            }}
          >
            <svg width={14} height={14} style={{ flexShrink: 0 }}>
              <circle cx={7} cy={7} r={6} fill="currentColor" />
            </svg>
            Control
          </button>
          <button
            title="SWAP node — place exactly 2 per column"
            onPointerDown={(event) => onStartPaletteDrag(event, { type: "swap" })}
            style={connectorButtonStyle(CONNECTOR_BLACK)}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = CONNECTOR_BLACK;
              event.currentTarget.style.color = UI_COLORS.white;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = UI_COLORS.white;
              event.currentTarget.style.color = CONNECTOR_BLACK;
            }}
          >
            <svg width={14} height={14} style={{ flexShrink: 0 }}>
              <line x1={2} y1={2} x2={12} y2={12} stroke="currentColor" strokeWidth={2.5} />
              <line x1={12} y1={2} x2={2} y2={12} stroke="currentColor" strokeWidth={2.5} />
            </svg>
            SWAP node
          </button>
        </div>
      </div>

      <div>
        <SectionTitle>Custom Gates</SectionTitle>
        <div style={{ padding: "8px" }}>
          {customGateDefinitions.length === 0 ? (
            <div style={{ fontSize: 10, color: UI_COLORS.slate400, fontStyle: "italic" }}>No custom gates yet</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {customGateDefinitions.map((definition) => (
                <button
                  key={definition.id}
                  onPointerDown={(event) => onStartPaletteDrag(event, { type: "custom", classifier: definition.classifier })}
                  style={{
                    padding: "5px 8px",
                    cursor: "grab",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 12,
                    borderRadius: 3,
                    background: CONNECTOR_BLACK,
                    color: UI_COLORS.white,
                    border: `1.5px solid ${CONNECTOR_BLACK}`,
                    minWidth: 35,
                    width: "auto",
                    flex: "0 0 auto",
                  }}
                >
                  {definition.classifier}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <SectionTitle>Classical Registers</SectionTitle>
        <div style={{ padding: "8px 8px 4px" }}>
          {classicalRegs.length === 0 && (
            <div style={{ fontSize: 10, color: UI_COLORS.slate400, marginBottom: 8, fontStyle: "italic" }}>
              No registers yet
            </div>
          )}

          {classicalRegs.map((reg) => (
            <div
              key={reg.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginBottom: 4,
                padding: "4px 6px",
                background: UI_COLORS.panelBg,
                border: `1px solid ${UI_COLORS.borderLight}`,
                borderRadius: 3,
              }}
            >
              <span style={{ fontFamily: "monospace", fontSize: 11, flex: 1, color: UI_COLORS.slate700 }}>
                <span style={{ color: UI_COLORS.slate400, marginRight: 3 }}>c/</span>
                {reg.name}
              </span>
              <button
                onClick={() => onDeleteRegister(reg.id)}
                title="Delete register"
                style={{
                  padding: "1px 5px",
                  fontSize: 11,
                  border: `1px solid ${UI_COLORS.red100}`,
                  background: UI_COLORS.rose50,
                  color: UI_COLORS.red600,
                  borderRadius: 2,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}

          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <input
              value={newRegName}
              onChange={(event) => onNewRegNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onAddRegister();
                }
              }}
              placeholder="name, e.g. c0"
              style={{
                flex: 1,
                padding: "4px 6px",
                border: `1px solid ${UI_COLORS.borderMid}`,
                borderRadius: 3,
                fontFamily: "monospace",
                fontSize: 11,
                minWidth: 0,
              }}
            />
            <button
              onClick={onAddRegister}
              disabled={!newRegName.trim() || duplicateRegName}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                fontWeight: 600,
                background: UI_COLORS.slate900,
                color: UI_COLORS.white,
                border: "none",
                borderRadius: 3,
                cursor: "pointer",
                opacity: !newRegName.trim() || duplicateRegName ? 0.5 : 1,
              }}
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      {selectedCount > 1 ? (
        <div
          style={{
            margin: 8,
            padding: 9,
            background: UI_COLORS.yellow50,
            border: `1px solid ${UI_COLORS.yellow200}`,
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          <div style={{ fontWeight: 700, color: UI_COLORS.yellow800, marginBottom: 3 }}>
            {selectedCount} elements selected
          </div>
          <div style={{ color: UI_COLORS.yellow900, lineHeight: 1.7, marginBottom: 7 }}>
            Drag on the canvas to marquee-select multiple items, then delete them together.
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={onDeleteSelectedSet} style={actionChipStyle(UI_COLORS.red600, UI_COLORS.rose50, UI_COLORS.red600)}>
              Delete selected
            </button>
            {canCreateCustomGate ? (
              <button onClick={onCreateCustomGate} style={actionChipStyle(UI_COLORS.slate900, UI_COLORS.white, UI_COLORS.slate900)}>
                Create group
              </button>
            ) : null}
          </div>
        </div>
      ) : selectedElement ? (
        <SelectedElementCard
          element={selectedElement}
          onEditSelectedParam={onEditSelectedParam}
          onEditSelectedCreg={onEditSelectedCreg}
          onEditSelectedAssign={onEditSelectedAssign}
          onEditSelectedCondition={onEditSelectedCondition}
          onEditSelectedJump={onEditSelectedJump}
          onDeleteSelected={onDeleteSelected}
        />
      ) : null}
    </div>
  );
}

function SelectedElementCard({
  element,
  onEditSelectedParam,
  onEditSelectedCreg,
  onEditSelectedAssign,
  onEditSelectedCondition,
  onEditSelectedJump,
  onDeleteSelected,
}: {
  element: CanvasElement;
  onEditSelectedParam: (id: number, values: number[]) => void;
  onEditSelectedCreg: (id: number) => void;
  onEditSelectedAssign: (id: number) => void;
  onEditSelectedCondition: (id: number) => void;
  onEditSelectedJump: (id: number) => void;
  onDeleteSelected: (id: number) => void;
}) {
  return (
    <div
      style={{
        margin: 8,
        padding: 9,
        background: UI_COLORS.yellow50,
        border: `1px solid ${UI_COLORS.yellow200}`,
        borderRadius: 4,
        fontSize: 11,
      }}
    >
      <div style={{ fontWeight: 700, color: UI_COLORS.yellow800, marginBottom: 3 }}>{selectedTitle(element)}</div>
      <div style={{ color: UI_COLORS.yellow900, lineHeight: 1.7 }}>{selectedDetails(element)}</div>
      <div style={{ display: "flex", gap: 4, marginTop: 7, flexWrap: "wrap" }}>
        {element.type === "unitary" && unitaryGateSupportsParam(element.kind) ? (
          <button
            onClick={() => onEditSelectedParam(element.id, element.params ?? [])}
            style={actionChipStyle("#d97706", UI_COLORS.yellow50, UI_COLORS.amber700)}
          >
            Edit param(s)
          </button>
        ) : null}
        {element.type === "measurement" ? (
          <button onClick={() => onEditSelectedCreg(element.id)} style={actionChipStyle(UI_COLORS.blue600, UI_COLORS.blue50, UI_COLORS.blue700)}>
            Edit
          </button>
        ) : null}
        {element.type === "assign" ? (
          <button onClick={() => onEditSelectedAssign(element.id)} style={actionChipStyle(UI_COLORS.blue600, UI_COLORS.blue50, UI_COLORS.blue700)}>
            Edit
          </button>
        ) : null}
        {element.type === "cctrl" ? (
          <button onClick={() => onEditSelectedCondition(element.id)} style={actionChipStyle(UI_COLORS.blue600, UI_COLORS.blue50, UI_COLORS.blue700)}>
            Edit
          </button>
        ) : null}
        {element.type === "jump" ? (
          <button onClick={() => onEditSelectedJump(element.id)} style={actionChipStyle(UI_COLORS.blue600, UI_COLORS.blue50, UI_COLORS.blue700)}>
            Edit
          </button>
        ) : null}
        <button onClick={() => onDeleteSelected(element.id)} style={actionChipStyle(UI_COLORS.red600, UI_COLORS.rose50, UI_COLORS.red600)}>
          Delete
        </button>
      </div>
    </div>
  );
}

function selectedTitle(element: CanvasElement) {
  if (element.type === "ctrl") {
    return "Control node";
  }
  if (element.type === "swap") {
    return "SWAP node";
  }
  if (element.type === "unitary") {
    return UNITARY_OP_DEFS[element.kind].description;
  }
  if (element.type === "measurement") {
    return CLASSICAL_OP_DEFS.measurement.description;
  }
  if (element.type === "assign") {
    return CLASSICAL_OP_DEFS.assign.description;
  }
  if (element.type === "reset") {
    return CLASSICAL_OP_DEFS.reset.description;
  }
  if (element.type === "jump") {
    return CLASSICAL_OP_DEFS.jump.description;
  }
  if (element.type === "custom") {
    return `Custom gate: ${element.classifier}`;
  }
  if (element.type === "cctrl") {
    return "Condition";
  }
  return "Element";
}

function selectedDetails(element: CanvasElement) {
  if (element.type === "cctrl") {
    const registers = exprRegisters(element.condition);
    return (
      <>
        regs: <b>{registers.length > 0 ? registers.join(", ") : "none"}</b>
        <br />
        condition: <b>{describeExpr(element.condition)}</b>
        <br />
        col {element.step}
      </>
    );
  }

  if (element.type === "jump") {
    return (
      <>
        col {element.step}
        <hr style={selectionDividerStyle} />
        target: <b>{element.targetStep == null ? <span style={{ color: UI_COLORS.red600 }}>unassigned</span> : `col ${element.targetStep}`}</b>
      </>
    );
  }

  return (
    <>
      qubit {element.qubit} · col {element.step}
      <hr style={selectionDividerStyle} />
      {element.type === "unitary" && element.params && element.params.length > 0 ? (
        <>
          params = {element.params.map((value) => fmt(value)).join(", ")} rad
        </>
      ) : null}
      {element.type === "measurement" ? (
        <>
          reg: <b>{element.registerName ?? <span style={{ color: UI_COLORS.red600 }}>unassigned</span>}</b>
          <br />
          bit: <b>{element.bitIndex ?? <span style={{ color: UI_COLORS.red600 }}>unassigned</span>}</b>
        </>
      ) : null}
      {element.type === "assign" ? (
        <>
          reg: <b>{element.registerName ?? <span style={{ color: UI_COLORS.red600 }}>unassigned</span>}</b>
          <br />
          expr: <b>{describeExpr(element.expr)}</b>
        </>
      ) : null}
    </>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: "7px 10px 3px",
        fontSize: 10,
        fontWeight: 700,
        color: UI_COLORS.slate400,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        borderBottom: `1px solid ${UI_COLORS.appBg}`,
      }}
    >
      {children}
    </div>
  );
}

function connectorButtonStyle(borderColor: string): React.CSSProperties {
  return {
    padding: "6px 8px",
    cursor: "grab",
    borderRadius: 3,
    border: `1.5px solid ${borderColor}`,
    background: "#fff",
    color: borderColor,
    fontFamily: "monospace",
    fontWeight: 700,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 7,
    transition: "background .1s,color .1s",
  };
}

function actionChipStyle(borderColor: string, background: string, color: string): React.CSSProperties {
  return {
    flex: 1,
    padding: "3px 0",
    fontSize: 10,
    cursor: "pointer",
    border: `1px solid ${borderColor}`,
    background,
    color,
    borderRadius: 3,
  };
}

const selectionDividerStyle: React.CSSProperties = {
  border: "none",
  borderTop: `1px solid ${UI_COLORS.yellow200}`,
  margin: "6px 0",
};
