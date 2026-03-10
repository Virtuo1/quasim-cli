import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRef, useState } from "react";

import { UI_COLORS } from "../constants";
import type { ClassicalRegister, DebugClassicalRegisterValues, DebugStateVector } from "../types";
import { DebugValueTrackerPanel } from "./DebugValueTrackerPanel";
import { StateVectorPlot, type StateVectorPlotDatum } from "./StateVectorPlot";

interface DockPanelProps {
  nQ: number;
  classicalRegs: ClassicalRegister[];
  debugStateVector: DebugStateVector | null;
  debugClassicalRegisterValues: DebugClassicalRegisterValues;
}

const MIN_DOCK_HEIGHT = 160;
const MAX_DOCK_HEIGHT = 480;
const MIN_LEFT_PANE_WIDTH = 240;
const MIN_RIGHT_PANE_WIDTH = 180;

export function DockPanel({ nQ, classicalRegs, debugStateVector, debugClassicalRegisterValues }: DockPanelProps) {
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
          <StateVectorPanel debugStateVector={debugStateVector} qubitCount={nQ} />
        </div>

        <div
          onPointerDown={startSplitResize}
          style={{
            width: 8,
            cursor: "ew-resize",
            background: `linear-gradient(90deg, ${UI_COLORS.white} 0, ${UI_COLORS.white} 3px, ${UI_COLORS.borderLight} 3px, ${UI_COLORS.borderLight} 4px, ${UI_COLORS.white} 4px, ${UI_COLORS.white} 100%)`,
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0, background: UI_COLORS.white }}>
          <DebugValueTrackerPanel
            nQ={nQ}
            classicalRegs={classicalRegs}
            debugClassicalRegisterValues={debugClassicalRegisterValues}
            debugStateVector={debugStateVector}
          />
        </div>
      </div>
    </div>
  );
}

function StateVectorPanel({
  debugStateVector,
  qubitCount,
}: {
  debugStateVector: DebugStateVector | null;
  qubitCount: number;
}) {
  const [viewMode, setViewMode] = useState<"state" | "sorted">("state");
  const amplitudes = debugStateVector?.amplitudes ?? [];

  let bars: StateVectorPlotDatum[] = [];
  let emptyMessage: string | undefined;

  if (qubitCount > 8) {
    emptyMessage = "State vector hidden above 8 qubits";
  } else if (amplitudes.length === 0) {
    emptyMessage = "No debug amplitudes";
  } else {
    bars = buildPlotData(amplitudes, qubitCount, viewMode);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      <select
        value={viewMode}
        onChange={(event) => setViewMode(event.target.value === "sorted" ? "sorted" : "state")}
        style={selectStyle}
      >
        <option value="state">State vector in bar diagram</option>
        <option value="sorted">Sorted most probable states</option>
      </select>
      <div style={{ flex: 1, minHeight: 0 }}>
        <StateVectorPlot bars={bars} emptyMessage={emptyMessage} />
      </div>
    </div>
  );
}

const selectStyle = {
  width: 260,
  maxWidth: "100%",
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${UI_COLORS.borderMid}`,
  background: UI_COLORS.white,
  color: UI_COLORS.slate800,
  fontSize: 11,
  fontWeight: 600,
} satisfies CSSProperties;

function buildPlotData(
  amplitudes: DebugStateVector["amplitudes"],
  qubitCount: number,
  viewMode: "state" | "sorted",
): StateVectorPlotDatum[] {
  const bars = amplitudes.map((amplitude, index) => ({
    index,
    label: `|${index.toString(2).padStart(qubitCount, "0")}>`,
    probability: magnitudeSquared(amplitude.real, amplitude.imag),
    phase: Math.atan2(amplitude.imag, amplitude.real),
    real: amplitude.real,
    imag: amplitude.imag,
  }));

  return viewMode === "sorted"
    ? [...bars].sort((a, b) => b.probability - a.probability).slice(0, 32)
    : bars;
}

function magnitudeSquared(real: number, imag: number) {
  return real * real + imag * imag;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
