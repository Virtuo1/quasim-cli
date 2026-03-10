import { useEffect, useRef, useState } from "react";

import { UI_COLORS } from "../constants";

export interface StateVectorPlotDatum {
  index: number;
  label: string;
  probability: number;
  phase: number;
  real: number;
  imag: number;
}

interface StateVectorPlotProps {
  bars: StateVectorPlotDatum[];
  emptyMessage?: string;
}

interface PlotMetrics {
  frameWidth: number;
  frameHeight: number;
  plotLeft: number;
  plotTop: number;
  plotWidth: number;
  plotHeight: number;
}

interface HoveredBarState {
  datum: StateVectorPlotDatum;
  index: number;
  indicatorX: number;
  clientX: number;
  clientY: number;
}

const MIN_FRAME_WIDTH = 320;
const MIN_FRAME_HEIGHT = 120;
const MAX_BAR_WIDTH = 40;
const HOVER_CARD_WIDTH = 168;
const HOVER_CARD_HEIGHT = 96;
const HOVER_CARD_GAP = 16;
const FRAME_PADDING = {
  top: 8,
  right: 8,
  bottom: 24,
  left: 44,
} as const;
const Y_TICKS = [1, 0.8, 0.6, 0.4, 0.2, 0] as const;

export function StateVectorPlot({ bars, emptyMessage }: StateVectorPlotProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: MIN_FRAME_WIDTH, height: MIN_FRAME_HEIGHT });
  const [hoveredBar, setHoveredBar] = useState<HoveredBarState | null>(null);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setFrameSize({
        width: Math.max(MIN_FRAME_WIDTH, Math.floor(entry.contentRect.width)),
        height: Math.max(MIN_FRAME_HEIGHT, Math.floor(entry.contentRect.height)),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const metrics = createPlotMetrics(frameSize.width, frameSize.height);
  const slotWidth = bars.length > 0 ? metrics.plotWidth / bars.length : metrics.plotWidth;
  const showEmptyMessage = bars.length === 0 && emptyMessage;

  const updateHover = (clientX: number, clientY: number) => {
    const frameRect = frameRef.current?.getBoundingClientRect();
    if (!frameRect || bars.length === 0) {
      return;
    }

    const localPlotX = clamp(clientX - frameRect.left - metrics.plotLeft, 0, metrics.plotWidth);
    const index = resolveHoveredIndex(localPlotX, metrics.plotWidth, bars.length);
    const indicatorX = metrics.plotLeft + getSlotCenter(index, slotWidth);

    setHoveredBar({
      datum: bars[index],
      index,
      indicatorX,
      clientX: frameRect.left + indicatorX,
      clientY,
    });
  };

  return (
    <div
      ref={frameRef}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: MIN_FRAME_HEIGHT, overflow: "visible" }}
    >
      <svg width={metrics.frameWidth} height={metrics.frameHeight} style={{ display: "block" }}>
        <g transform={`translate(${metrics.plotLeft}, ${metrics.plotTop})`}>
          {Y_TICKS.map((tick) => {
            const y = probabilityToY(tick, metrics.plotHeight);

            return (
              <g key={`tick-${tick.toFixed(1)}`}>
                <line
                  x1={0}
                  y1={y}
                  x2={metrics.plotWidth}
                  y2={y}
                  stroke={tick === 1 ? UI_COLORS.slate400 : UI_COLORS.borderLight}
                  strokeWidth={1}
                />
              </g>
            );
          })}

          <line x1={0} y1={0} x2={0} y2={metrics.plotHeight} stroke={UI_COLORS.borderMid} strokeWidth={1} />
          <line
            x1={0}
            y1={metrics.plotHeight}
            x2={metrics.plotWidth}
            y2={metrics.plotHeight}
            stroke={UI_COLORS.borderMid}
            strokeWidth={1}
          />

          {!showEmptyMessage
            ? bars.map((bar, index) => {
                const geometry = getBarGeometry(index, bar.probability, slotWidth, metrics.plotHeight);

                return (
                  <rect
                    key={`${bar.index}-${bar.label}`}
                    x={geometry.x}
                    y={geometry.y}
                    width={geometry.width}
                    height={geometry.height}
                    rx={2}
                    ry={2}
                    fill={phaseColor(bar.phase)}
                  />
                );
              })
            : null}

          {!showEmptyMessage && hoveredBar ? (
            <line
              x1={getSlotCenter(hoveredBar.index, slotWidth)}
              y1={0}
              x2={getSlotCenter(hoveredBar.index, slotWidth)}
              y2={metrics.plotHeight}
              stroke={UI_COLORS.slate900}
              strokeWidth={2}
              opacity={0.7}
            />
          ) : null}

          {!showEmptyMessage ? (
            <rect
              x={0}
              y={0}
              width={metrics.plotWidth}
              height={metrics.plotHeight}
              fill="transparent"
              onPointerMove={(event) => updateHover(event.clientX, event.clientY)}
              onPointerEnter={(event) => updateHover(event.clientX, event.clientY)}
              onPointerLeave={() => setHoveredBar(null)}
            />
          ) : (
            <text
              x={metrics.plotWidth / 2}
              y={metrics.plotHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fill={UI_COLORS.slate500}
            >
              {emptyMessage}
            </text>
          )}
        </g>

        {Y_TICKS.map((tick) => {
          const y = metrics.plotTop + probabilityToY(tick, metrics.plotHeight);

          return (
            <text
              key={`label-${tick.toFixed(1)}`}
              x={metrics.plotLeft - 8}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={UI_COLORS.slate500}
            >
              {formatTick(tick)}
            </text>
          );
        })}
      </svg>

      {hoveredBar ? (
        <div
          style={{
            position: "fixed",
            left: resolveHoverCardLeft(hoveredBar.clientX),
            top: resolveHoverCardTop(hoveredBar.clientY),
            width: HOVER_CARD_WIDTH,
            padding: "9px 10px",
            borderRadius: 8,
            border: `1px solid ${UI_COLORS.borderLight}`,
            background: UI_COLORS.white,
            boxShadow: "0 14px 30px rgba(15,23,42,0.12)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: UI_COLORS.slate900 }}>{hoveredBar.datum.label}</div>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: phaseColor(hoveredBar.datum.phase),
                flexShrink: 0,
              }}
            />
          </div>
          <div style={{ marginTop: 7, fontSize: 11, color: UI_COLORS.slate600, lineHeight: 1.45 }}>
            <div>{`P = ${hoveredBar.datum.probability.toFixed(6)}`}</div>
            <div>{`A = ${formatSigned(hoveredBar.datum.real)} ${formatImag(hoveredBar.datum.imag)}`}</div>
            <div>{`phase = ${hoveredBar.datum.phase.toFixed(4)} rad`}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function createPlotMetrics(frameWidth: number, frameHeight: number): PlotMetrics {
  return {
    frameWidth,
    frameHeight,
    plotLeft: FRAME_PADDING.left,
    plotTop: FRAME_PADDING.top,
    plotWidth: Math.max(1, frameWidth - FRAME_PADDING.left - FRAME_PADDING.right),
    plotHeight: Math.max(1, frameHeight - FRAME_PADDING.top - FRAME_PADDING.bottom),
  };
}

function resolveHoveredIndex(localPlotX: number, plotWidth: number, count: number) {
  const scaledIndex = (localPlotX / plotWidth) * count;
  return clamp(Math.floor(scaledIndex), 0, count - 1);
}

function getSlotCenter(index: number, slotWidth: number) {
  return (index + 0.5) * slotWidth;
}

function getBarGeometry(index: number, probability: number, slotWidth: number, plotHeight: number) {
  const width = Math.max(2, Math.min(MAX_BAR_WIDTH, slotWidth));
  const x = index * slotWidth + (slotWidth - width) / 2;
  const height = Math.max(2, probability * plotHeight);
  const y = plotHeight - height;

  return { x, y, width, height };
}

function probabilityToY(probability: number, plotHeight: number) {
  return (1 - probability) * plotHeight;
}

function resolveHoverCardLeft(clientX: number) {
  const rightSide = clientX + HOVER_CARD_GAP;
  if (rightSide + HOVER_CARD_WIDTH <= window.innerWidth - 8) {
    return rightSide;
  }

  return Math.max(8, clientX - HOVER_CARD_WIDTH - HOVER_CARD_GAP);
}

function resolveHoverCardTop(clientY: number) {
  const preferredTop = clientY - HOVER_CARD_HEIGHT / 2;
  return clamp(preferredTop, 8, window.innerHeight - HOVER_CARD_HEIGHT - 8);
}

function formatTick(tick: number) {
  if (tick === 0) {
    return "0";
  }

  return tick.toFixed(1);
}

function phaseColor(phase: number) {
  const hue = ((phase + Math.PI) / (Math.PI * 2)) * 360;
  return `hsl(${hue.toFixed(1)} 70% 50%)`;
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function formatImag(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}i`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
