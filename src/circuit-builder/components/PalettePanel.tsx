import { CONNECTOR_BLACK, GATE_DEFS, PALETTE_GROUPS, UI_COLORS, gateSupportsParam } from "../constants";
import type { CircuitElement, ClassicalRegister, PaletteDragSpec } from "../types";
import { fmt } from "../utils/layout";

interface PalettePanelProps {
  classicalRegs: ClassicalRegister[];
  selectedElement: CircuitElement | null;
  newRegName: string;
  onNewRegNameChange: (value: string) => void;
  onAddRegister: () => void;
  onDeleteRegister: (id: number) => void;
  onStartPaletteDrag: (event: React.PointerEvent, spec: PaletteDragSpec) => void;
  onEditSelectedParam: (id: number, value: number) => void;
  onEditSelectedCreg: (id: number) => void;
  onEditSelectedCondition: (id: number) => void;
  onDeleteSelected: (id: number) => void;
}

export function PalettePanel({
  classicalRegs,
  selectedElement,
  newRegName,
  onNewRegNameChange,
  onAddRegister,
  onDeleteRegister,
  onStartPaletteDrag,
  onEditSelectedParam,
  onEditSelectedCreg,
  onEditSelectedCondition,
  onDeleteSelected,
}: PalettePanelProps) {
  const duplicateRegName = classicalRegs.some((reg) => reg.name === newRegName.trim());

  return (
    <div
      style={{
        width: 200,
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

      {PALETTE_GROUPS.map(({ group, keys }) => (
        <div key={group}>
          <SectionTitle>{group}</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, padding: "6px 8px 8px" }}>
            {keys.map((key) => {
              const def = GATE_DEFS[key];
              return (
                <button
                  key={key}
                  title={def.desc}
                  onPointerDown={(event) => onStartPaletteDrag(event, { type: "gate", gateType: key })}
                  style={{
                    padding: "5px 2px",
                    cursor: "grab",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    fontSize: 12,
                    borderRadius: 3,
                    background: UI_COLORS.white,
                    color: def.c,
                    border: `1.5px solid ${def.c}`,
                    transition: "background .1s,color .1s",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = def.c;
                    event.currentTarget.style.color = UI_COLORS.white;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = UI_COLORS.white;
                    event.currentTarget.style.color = def.c;
                  }}
                >
                  {def.l}
                </button>
              );
            })}
          </div>
        </div>
      ))}

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

      {selectedElement ? (
        <SelectedElementCard
          element={selectedElement}
          onEditSelectedParam={onEditSelectedParam}
          onEditSelectedCreg={onEditSelectedCreg}
          onEditSelectedCondition={onEditSelectedCondition}
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
  onEditSelectedCondition,
  onDeleteSelected,
}: {
  element: CircuitElement;
  onEditSelectedParam: (id: number, value: number) => void;
  onEditSelectedCreg: (id: number) => void;
  onEditSelectedCondition: (id: number) => void;
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
        {element.type === "gate" && gateSupportsParam(element.gateType) ? (
          <button
            onClick={() => onEditSelectedParam(element.id, element.param ?? 0)}
            style={actionChipStyle("#d97706", UI_COLORS.yellow50, UI_COLORS.amber700)}
          >
            Edit θ
          </button>
        ) : null}
        {element.type === "gate" && element.gateType === "M" ? (
          <button onClick={() => onEditSelectedCreg(element.id)} style={actionChipStyle(UI_COLORS.blue600, UI_COLORS.blue50, UI_COLORS.blue700)}>
            Assign reg
          </button>
        ) : null}
        {element.type === "cctrl" ? (
          <button onClick={() => onEditSelectedCondition(element.id)} style={actionChipStyle(UI_COLORS.slate700, UI_COLORS.panelBg, "#374151")}>
            Edit condition
          </button>
        ) : null}
        <button onClick={() => onDeleteSelected(element.id)} style={actionChipStyle(UI_COLORS.red600, UI_COLORS.rose50, UI_COLORS.red600)}>
          Delete
        </button>
      </div>
    </div>
  );
}

function selectedTitle(element: CircuitElement) {
  if (element.type === "ctrl") {
    return "Control node";
  }
  if (element.type === "swap") {
    return "SWAP node";
  }
  if (element.type === "cctrl") {
    return `Condition: ${element.cregName} ${element.op} ${element.val}`;
  }
  return GATE_DEFS[element.gateType].desc;
}

function selectedDetails(element: CircuitElement) {
  if (element.type === "cctrl") {
    return (
      <>
        reg: <b>{element.cregName}</b>
        <br />
        condition: <b>{element.cregName} {element.op} {element.val}</b>
        <br />
        col {element.step}
      </>
    );
  }

  return (
    <>
      qubit {element.qubit} · col {element.step}
      {element.type === "gate" && element.param != null ? (
        <>
          <br />θ = {fmt(element.param)} rad
        </>
      ) : null}
      {element.type === "gate" && element.gateType === "M" ? (
        <>
          <br />
          reg: <b>{element.creg ?? <span style={{ color: UI_COLORS.red600 }}>unassigned</span>}</b>
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
