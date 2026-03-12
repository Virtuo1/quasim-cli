import { UI_COLORS } from "../constants";
import { shellSurfaceStyle } from "../ui/styles";
import { HeaderButton, HeaderSeparator } from "./HeaderControls";

interface AppHeaderProps {
  nQ: number;
  nS: number;
  classicalRegisterCount: number;
  onRun: () => void;
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
  onRun,
  onAddQubit,
  onRemoveQubit,
  onImport,
  onExport,
  onClear,
}: AppHeaderProps) {
  return (
    <div
      style={{
        ...shellSurfaceStyle,
        color: UI_COLORS.slate900,
        padding: "8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3, marginRight: 6 }}>
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
      <HeaderButton onClick={onRun}>Run</HeaderButton>
      <HeaderButton onClick={onClear} danger>
        Clear
      </HeaderButton>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: UI_COLORS.slate500 }}>
        {nQ} qubits · {classicalRegisterCount} creg{classicalRegisterCount !== 1 ? "s" : ""} · {nS} cols
      </span>
    </div>
  );
}
