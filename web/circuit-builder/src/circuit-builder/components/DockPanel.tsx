import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";

import { MAX_FULL_STATEVECTOR_QUBITS, SORTED_STATEVECTOR_TOP_N, UI_COLORS } from "../constants";
import type { ClassicalRegister, DebuggerState, StateVectorResponse } from "../types";
import { controlStyle, splitHandleStyle, subtleTextStyle } from "../ui/styles";
import { DebugValueTrackerPanel } from "./DebugValueTrackerPanel";
import { StateVectorPlot, type StateVectorPlotDatum } from "./StateVectorPlot";

interface DockPanelProps {
  nQ: number;
  classicalRegs: ClassicalRegister[];
  debugger: DebuggerState;
  viewMode: "state" | "sorted";
  onViewModeChange: (mode: "state" | "sorted") => void;
  onLoadTrackedBasisAmplitude: (basis: number) => void;
}

const MIN_DOCK_HEIGHT = 50;
const MAX_DOCK_HEIGHT = 600;
const MIN_LEFT_PANE_WIDTH = 280;
const MIN_RIGHT_PANE_WIDTH = 400;

export function DockPanel({
  nQ,
  classicalRegs,
  debugger: debuggerState,
  viewMode,
  onViewModeChange,
  onLoadTrackedBasisAmplitude,
}: DockPanelProps) {
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [dockHeight, setDockHeight] = useState(240);
  const [leftPaneWidth, setLeftPaneWidth] = useState(520);

  const startHeightResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = dockHeight;

    const onMove = (moveEvent: PointerEvent) => {
      setDockHeight(clamp(startHeight - (moveEvent.clientY - startY), MIN_DOCK_HEIGHT, MAX_DOCK_HEIGHT));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startSplitResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dockRect = dockRef.current?.getBoundingClientRect();
    if (!dockRect) {
      return;
    }

    const onMove = (moveEvent: PointerEvent) => {
      setLeftPaneWidth(
        clamp(moveEvent.clientX - dockRect.left, MIN_LEFT_PANE_WIDTH, dockRect.width - MIN_RIGHT_PANE_WIDTH),
      );
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={dockRef}
      style={{
        position: "relative",
        flexShrink: 0,
        height: dockHeight,
        borderTop: `1px solid ${UI_COLORS.borderLight}`,
        background: UI_COLORS.white,
        overflow: "hidden",
      }}
    >
      <div
        onPointerDown={startHeightResize}
        style={{
          position: "absolute",
          top: -4,
          left: 0,
          right: 0,
          height: 8,
          cursor: "ns-resize",
          zIndex: 3,
        }}
      />

      <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
        <div
          style={{
            width: leftPaneWidth,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            background: UI_COLORS.white,
            padding: "10px 12px",
          }}
        >
          <StateVectorPanel
            stateVector={debuggerState.stateVector}
            qubitCount={nQ}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
        </div>

        <div
          onPointerDown={startSplitResize}
          style={{
            ...splitHandleStyle(),
            background: `linear-gradient(90deg, ${UI_COLORS.white} 0, ${UI_COLORS.white} 3px, ${UI_COLORS.borderLight} 3px, ${UI_COLORS.borderLight} 4px, ${UI_COLORS.white} 4px, ${UI_COLORS.white} 100%)`,
          }}
        />

        <div style={{ flex: 1, minWidth: 0, background: UI_COLORS.white }}>
          <DebugValueTrackerPanel
            nQ={nQ}
            classicalRegs={classicalRegs}
            sessionId={debuggerState.sessionId}
            debugClassicalRegisterValues={debuggerState.debugClassicalRegisterValues}
            stateVector={debuggerState.stateVector}
            trackedBasisAmplitudes={debuggerState.basisAmplitudeCache}
            onLoadBasisAmplitude={onLoadTrackedBasisAmplitude}
          />
        </div>
      </div>
    </div>
  );
}

function StateVectorPanel({
  stateVector,
  qubitCount,
  viewMode,
  onViewModeChange,
}: {
  stateVector: StateVectorResponse | null;
  qubitCount: number;
  viewMode: "state" | "sorted";
  onViewModeChange: (mode: "state" | "sorted") => void;
}) {
  const amplitudes = stateVector?.amplitudes ?? [];
  const stateVectorHidden = viewMode === "state" && qubitCount > MAX_FULL_STATEVECTOR_QUBITS;

  let bars: StateVectorPlotDatum[] = [];
  let emptyMessage: string | undefined;

  if (stateVectorHidden) {
    emptyMessage = `State vector hidden above ${MAX_FULL_STATEVECTOR_QUBITS} qubits`;
  } else if (amplitudes.length === 0) {
    emptyMessage = "No debug amplitudes";
  } else {
    bars = buildPlotData(amplitudes, qubitCount, viewMode);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      <div style={controlRowStyle}>
        <select
          value={viewMode}
          onChange={(event) => onViewModeChange(event.target.value === "sorted" ? "sorted" : "state")}
          style={selectStyle}
        >
          <option value="state" disabled={qubitCount > MAX_FULL_STATEVECTOR_QUBITS}>
            Statevector diagram
          </option>
          <option value="sorted">Most probable states</option>
        </select>
        <div style={selectHintStyle}>
          {viewMode === "state"
            ? qubitCount > MAX_FULL_STATEVECTOR_QUBITS
              ? `Raw basis-order plot is limited to ${MAX_FULL_STATEVECTOR_QUBITS} qubits`
              : "Basis states in computational order"
            : `Top ${SORTED_STATEVECTOR_TOP_N} states by probability`}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <StateVectorPlot bars={bars} emptyMessage={emptyMessage} />
      </div>
    </div>
  );
}

const selectStyle = {
  ...controlStyle(),
  flexShrink: 0,
  maxWidth: "100%",
  fontWeight: 600,
} satisfies CSSProperties;

const controlRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
} satisfies CSSProperties;

const selectHintStyle = {
  ...subtleTextStyle,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} satisfies CSSProperties;

function buildPlotData(
  amplitudes: StateVectorResponse["amplitudes"],
  qubitCount: number,
  viewMode: "state" | "sorted",
): StateVectorPlotDatum[] {
  const sortedAmplitudes =
    viewMode === "sorted"
      ? [...amplitudes].sort(
          (left, right) =>
            magnitudeSquared(right.amplitude.re, right.amplitude.im) - magnitudeSquared(left.amplitude.re, left.amplitude.im),
        )
      : [...amplitudes].sort((left, right) => left.basis - right.basis);

  return sortedAmplitudes.map((entry, index) => ({
    index,
    label: `|${entry.basis.toString(2).padStart(qubitCount, "0")}>`,
    probability: magnitudeSquared(entry.amplitude.re, entry.amplitude.im),
    phase: Math.atan2(entry.amplitude.im, entry.amplitude.re),
    real: entry.amplitude.re,
    imag: entry.amplitude.im,
  }));
}

function magnitudeSquared(real: number, imag: number) {
  return real * real + imag * imag;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
