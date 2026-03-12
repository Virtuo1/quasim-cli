import { UI_COLORS } from "../constants";
import { shellSurfaceStyle } from "../ui/styles";
import { HeaderButton, HeaderSeparator } from "./HeaderControls";

interface AppHeaderProps {
  nQ: number;
  nS: number;
  classicalRegisterCount: number;
  debuggerSessionActive: boolean;
  debuggerBusy: boolean;
  debuggerPc: number | null;
  debuggerError: string | null;
  onBuild: () => void;
  onNext: () => void;
  onContinue: () => void;
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
  debuggerSessionActive,
  debuggerBusy,
  debuggerPc,
  debuggerError,
  onBuild,
  onNext,
  onContinue,
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
      <HeaderButton onClick={onBuild} disabled={debuggerBusy}>Build</HeaderButton>
      {debuggerSessionActive ? (
        <>
          <HeaderButton onClick={onNext} disabled={debuggerBusy}>Next</HeaderButton>
          <HeaderButton onClick={onContinue} disabled={debuggerBusy}>Continue</HeaderButton>
        </>
      ) : null}
      <HeaderButton onClick={onClear} danger>
        Clear
      </HeaderButton>
      <div style={{ flex: 1 }} />
      {debuggerSessionActive ? (
        <span style={{ fontSize: 11, color: UI_COLORS.slate500 }}>
          PC {debuggerPc ?? "?"}
        </span>
      ) : null}
      {debuggerError ? (
        <span style={{ fontSize: 11, color: UI_COLORS.red600, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {debuggerError}
        </span>
      ) : null}
      <span style={{ fontSize: 11, color: UI_COLORS.slate500 }}>
        {nQ} qubits · {classicalRegisterCount} creg{classicalRegisterCount !== 1 ? "s" : ""} · {nS} cols
      </span>
    </div>
  );
}
