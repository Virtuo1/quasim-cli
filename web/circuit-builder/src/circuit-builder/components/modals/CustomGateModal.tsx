import { useEffect, useState } from "react";

import { UI_COLORS } from "../../constants";
import type { CustomGateModalState } from "../../types";
import { ModalFrame } from "./ModalFrame";
import {
  modalActionsStyle,
  modalDangerPanelStyle,
  modalFieldLabelStyle,
  modalInputStyle,
  modalPrimaryButtonStyle,
  modalSecondaryButtonStyle,
  modalSubtitleStyle,
  modalTitleStyle,
} from "./modalStyles";

interface CustomGateModalProps {
  modal: CustomGateModalState | null;
  existingClassifiers: string[];
  validationError: string | null;
  onCancel: () => void;
  onCreate: (name: string) => void;
}

export function CustomGateModal({
  modal,
  existingClassifiers,
  validationError,
  onCancel,
  onCreate,
}: CustomGateModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName(modal?.suggestedName ?? "");
  }, [modal]);

  if (!modal) {
    return null;
  }

  const duplicate = existingClassifiers.includes(name.trim());

  return (
    <ModalFrame width={360}>
      <div style={modalTitleStyle}>Create Custom Gate</div>
      <div style={modalSubtitleStyle}>
        Group the current quantum selection into a reusable gate.
      </div>
      {validationError ? <div style={modalDangerPanelStyle}>{validationError}</div> : null}
      <div style={modalFieldLabelStyle}>Unique classifier</div>
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name.trim() && !duplicate && !validationError) {
            onCreate(name);
          }
        }}
        placeholder="e.g. qft_block"
        style={{
          ...modalInputStyle,
          fontSize: 13,
          marginBottom: 10,
        }}
      />
      {duplicate ? (
        <div style={{ color: UI_COLORS.red600, fontSize: 11, marginBottom: 14 }}>
          That classifier already exists.
        </div>
      ) : (
        <div style={{ color: UI_COLORS.slate400, fontSize: 11, marginBottom: 14 }}>
          This name is used in the toolbox and export metadata.
        </div>
      )}
      <div style={modalActionsStyle}>
        <button onClick={onCancel} style={modalSecondaryButtonStyle}>
          Cancel
        </button>
        <button
          onClick={() => onCreate(name)}
          disabled={!name.trim() || duplicate || !!validationError}
          style={{
            ...modalPrimaryButtonStyle,
            opacity: !name.trim() || duplicate || !!validationError ? 0.5 : 1,
          }}
        >
          Create
        </button>
      </div>
    </ModalFrame>
  );
}
