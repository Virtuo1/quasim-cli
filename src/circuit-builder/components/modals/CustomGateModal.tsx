import { useEffect, useState } from "react";

import { UI_COLORS } from "../../constants";
import type { CustomGateModalState } from "../../types";
import { ModalFrame } from "./ModalFrame";

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
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Create Custom Gate</div>
      <div style={{ fontSize: 12, color: UI_COLORS.slate500, marginBottom: 16 }}>
        Group the current single-column quantum selection into a reusable gate.
      </div>
      {validationError ? (
        <div
          style={{
            padding: "10px 12px",
            marginBottom: 16,
            background: UI_COLORS.rose50,
            border: `1px solid ${UI_COLORS.red100}`,
            borderRadius: 4,
            color: UI_COLORS.red600,
            fontSize: 12,
          }}
        >
          {validationError}
        </div>
      ) : null}
      <div style={{ fontSize: 11, fontWeight: 600, color: UI_COLORS.slate700, marginBottom: 6 }}>
        Unique classifier
      </div>
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
          width: "100%",
          padding: "7px 9px",
          border: `1px solid ${UI_COLORS.borderMid}`,
          borderRadius: 4,
          fontFamily: "monospace",
          fontSize: 13,
          boxSizing: "border-box",
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
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 16px",
            border: `1px solid ${UI_COLORS.borderMid}`,
            borderRadius: 4,
            background: UI_COLORS.white,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onCreate(name)}
          disabled={!name.trim() || duplicate || !!validationError}
          style={{
            padding: "6px 16px",
            border: "none",
            borderRadius: 4,
            background: UI_COLORS.slate900,
            color: UI_COLORS.white,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 13,
            opacity: !name.trim() || duplicate || !!validationError ? 0.5 : 1,
          }}
        >
          Create
        </button>
      </div>
    </ModalFrame>
  );
}
