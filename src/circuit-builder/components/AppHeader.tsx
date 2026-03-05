import { UI_COLORS } from "../constants";
import { HeaderButton, HeaderSeparator } from "./HeaderControls";

interface AppHeaderProps {
  nQ: number;
  nS: number;
  classicalRegisterCount: number;
  onAddQubit: () => void;
  onRemoveQubit: () => void;
  onImport: () => void;
  onExport: () => void;
  onClear: () => void;
}

export function AppHeader({
  nQ,
  nS,
  classicalRegisterCount,
  onAddQubit,
  onRemoveQubit,
  onImport,
  onExport,
  onClear,
}: AppHeaderProps) {
  return (
    <div
      style={{
        background: UI_COLORS.slate900,
        color: UI_COLORS.white,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: `1px solid ${UI_COLORS.slate700}`,
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.4, marginRight: 6 }}>
        Quasim Circuit Builder
      </span>
      <HeaderSeparator />
      <HeaderButton onClick={onAddQubit}>+ Qubit</HeaderButton>
      <HeaderButton onClick={onRemoveQubit} disabled={nQ <= 1}>
        − Qubit
      </HeaderButton>
      <HeaderSeparator />
      <HeaderButton onClick={onImport}>Import JSON</HeaderButton>
      <HeaderButton onClick={onExport} accent>
        Export JSON
      </HeaderButton>
      <HeaderButton onClick={onClear} danger>
        Clear
      </HeaderButton>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: UI_COLORS.slate400 }}>
        {nQ} qubits · {classicalRegisterCount} creg{classicalRegisterCount !== 1 ? "s" : ""} · {nS} cols
      </span>
    </div>
  );
}
