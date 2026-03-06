import { useEffect, useState } from "react";

import { UI_COLORS } from "../../constants";
import type { ClassicalRegister, ClassicalRegisterModalState, MeasurementElement } from "../../types";
import { ModalFrame } from "./ModalFrame";

interface ClassicalRegisterModalProps {
  modal: ClassicalRegisterModalState | null;
  element: MeasurementElement | null;
  classicalRegs: ClassicalRegister[];
  onCancel: () => void;
  onAssign: (regName: string) => void;
  onCreateAndAssign: (name: string) => void;
}

export function ClassicalRegisterModal({
  modal,
  element,
  classicalRegs,
  onCancel,
  onAssign,
  onCreateAndAssign,
}: ClassicalRegisterModalProps) {
  const [selectedReg, setSelectedReg] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!modal || !element) {
      setSelectedReg("");
      setNewName("");
      return;
    }

    setSelectedReg(element.registerName ?? classicalRegs[0]?.name ?? "");
    setNewName("");
  }, [classicalRegs, element, modal]);

  if (!modal || !element) {
    return null;
  }

  const duplicateName = classicalRegs.some((reg) => reg.name === newName.trim());

  return (
    <ModalFrame width={360}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Assign Classical Register</div>
      <div style={{ fontSize: 12, color: UI_COLORS.slate500, marginBottom: 16 }}>
        Measurement on q{element.qubit}, step {element.step}
      </div>

      {classicalRegs.length > 0 ? (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Select existing register</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
            {classicalRegs.map((reg) => (
              <label
                key={reg.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: selectedReg === reg.name ? UI_COLORS.blue50 : UI_COLORS.panelBg,
                  border: `1.5px solid ${selectedReg === reg.name ? UI_COLORS.blue600 : UI_COLORS.borderLight}`,
                }}
              >
                <input
                  type="radio"
                  name="creg"
                  value={reg.name}
                  checked={selectedReg === reg.name}
                  onChange={() => setSelectedReg(reg.name)}
                  style={{ accentColor: UI_COLORS.blue600 }}
                />
                <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600 }}>{reg.name}</span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div
          style={{
            padding: 10,
            background: "#fef9c3",
            border: `1px solid ${UI_COLORS.yellow200}`,
            borderRadius: 4,
            fontSize: 11,
            color: UI_COLORS.yellow800,
            marginBottom: 16,
          }}
        >
          No classical registers yet. Create one below.
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Or create a new register</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onCreateAndAssign(newName);
            }
          }}
          placeholder="name, e.g. c0"
          style={{
            flex: 1,
            padding: "6px 9px",
            border: `1px solid ${UI_COLORS.borderMid}`,
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 12,
          }}
        />
        <button
          onClick={() => onCreateAndAssign(newName)}
          disabled={!newName.trim() || duplicateName}
          style={{
            padding: "6px 12px",
            background: UI_COLORS.slate900,
            color: UI_COLORS.white,
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            opacity: !newName.trim() || duplicateName ? 0.5 : 1,
          }}
        >
          Create &amp; assign
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
        <button
          onClick={() => onAssign(selectedReg)}
          disabled={!selectedReg || classicalRegs.length === 0}
          style={{
            ...primaryButtonStyle,
            opacity: !selectedReg || classicalRegs.length === 0 ? 0.5 : 1,
          }}
        >
          Assign
        </button>
      </div>
    </ModalFrame>
  );
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: "6px 16px",
  border: `1px solid ${UI_COLORS.borderMid}`,
  borderRadius: 4,
  background: UI_COLORS.white,
  cursor: "pointer",
  fontSize: 13,
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "6px 16px",
  border: "none",
  borderRadius: 4,
  background: UI_COLORS.blue600,
  color: UI_COLORS.white,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
};
