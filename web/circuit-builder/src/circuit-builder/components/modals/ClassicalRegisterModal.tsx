import { useEffect, useState } from "react";

import { MAX_CREG_BIT_INDEX, UI_COLORS } from "../../constants";
import { buttonStyle } from "../../ui/styles";
import type { ClassicalRegister, ClassicalRegisterModalState, MeasurementElement } from "../../types";
import { ModalFrame } from "./ModalFrame";
import {
  modalActionsStyle,
  modalFieldLabelStyle,
  modalInputStyle,
  modalPrimaryButtonStyle,
  modalSecondaryButtonStyle,
  modalSubtitleStyle,
  modalTitleStyle,
  modalWarningPanelStyle,
} from "./modalStyles";

interface ClassicalRegisterModalProps {
  modal: ClassicalRegisterModalState | null;
  element: MeasurementElement | null;
  classicalRegs: ClassicalRegister[];
  onCancel: () => void;
  onAssign: (regName: string, bitIndex: number) => void;
  onCreateAndAssign: (name: string, bitIndex: number) => void;
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
  const [bitIndexInput, setBitIndexInput] = useState("");

  useEffect(() => {
    if (!modal || !element) {
      setSelectedReg("");
      setNewName("");
      setBitIndexInput("");
      return;
    }

    setSelectedReg(element.registerName ?? classicalRegs[0]?.name ?? "");
    setNewName("");
    setBitIndexInput(element.bitIndex == null ? "" : String(element.bitIndex));
  }, [classicalRegs, element, modal]);

  if (!modal || !element) {
    return null;
  }

  const duplicateName = classicalRegs.some((reg) => reg.name === newName.trim());
  const parsedBitIndex = Number(bitIndexInput);
  const bitIndexIsValid =
    bitIndexInput.trim() !== "" &&
    Number.isInteger(parsedBitIndex) &&
    parsedBitIndex >= 0 &&
    parsedBitIndex <= MAX_CREG_BIT_INDEX;

  return (
    <ModalFrame width={360}>
      <div style={modalTitleStyle}>Assign Classical Register</div>
      <div style={modalSubtitleStyle}>
        Measurement on q{element.qubit}, step {element.step}
      </div>

      <div style={modalFieldLabelStyle}>Target bit index</div>
      <input
        value={bitIndexInput}
        onChange={(event) => setBitIndexInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && selectedReg && classicalRegs.length > 0 && bitIndexIsValid) {
            onAssign(selectedReg, parsedBitIndex);
          }
        }}
        placeholder={`0-${MAX_CREG_BIT_INDEX}`}
        inputMode="numeric"
        style={{
          ...modalInputStyle,
          border: `1px solid ${bitIndexInput.trim() === "" || bitIndexIsValid ? UI_COLORS.borderMid : UI_COLORS.red600}`,
          marginBottom: 16,
        }}
      />
      <div style={{ fontSize: 11, color: bitIndexInput.trim() === "" || bitIndexIsValid ? UI_COLORS.slate500 : UI_COLORS.red600, marginTop: -10, marginBottom: 16 }}>
        Bit index must be an integer between 0 and {MAX_CREG_BIT_INDEX}.
      </div>

      {classicalRegs.length > 0 ? (
        <>
          <div style={modalFieldLabelStyle}>Select existing register</div>
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
        <div style={{ ...modalWarningPanelStyle, marginBottom: 16 }}>
          No classical registers yet. Create one below.
        </div>
      )}

      <div style={modalFieldLabelStyle}>Or create a new register</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && bitIndexIsValid) {
              onCreateAndAssign(newName, parsedBitIndex);
            }
          }}
          placeholder="name, e.g. c0"
          style={{
            flex: 1,
            ...modalInputStyle,
          }}
        />
        <button
          onClick={() => onCreateAndAssign(newName, parsedBitIndex)}
          disabled={!newName.trim() || duplicateName || !bitIndexIsValid}
          style={{ ...buttonStyle({ tone: "primary", variant: "solid", disabled: !newName.trim() || duplicateName || !bitIndexIsValid }), fontSize: 12, padding: "6px 12px" }}
        >
          Create &amp; assign
        </button>
      </div>

      <div style={modalActionsStyle}>
        <button onClick={onCancel} style={modalSecondaryButtonStyle}>
          Cancel
        </button>
        <button
          onClick={() => onAssign(selectedReg, parsedBitIndex)}
          disabled={!selectedReg || classicalRegs.length === 0 || !bitIndexIsValid}
          style={{
            ...modalPrimaryButtonStyle,
            opacity: !selectedReg || classicalRegs.length === 0 || !bitIndexIsValid ? 0.5 : 1,
          }}
        >
          Assign
        </button>
      </div>
    </ModalFrame>
  );
}
