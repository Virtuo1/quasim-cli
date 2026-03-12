import type { CSSProperties, ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { UI_COLORS } from "../constants";
import type {
  ClassicalRegister,
  DebugClassicalRegisterValue,
  DebugClassicalRegisterValues,
  StateVector,
} from "../types";
import { buttonStyle, controlStyle, subtleTextStyle } from "../ui/styles";

interface DebugValueTrackerPanelProps {
  nQ: number;
  classicalRegs: ClassicalRegister[];
  debugClassicalRegisterValues: DebugClassicalRegisterValues;
  stateVector: StateVector | null;
}

type TrackerEntry =
  | { id: number; kind: "creg"; registerName: string }
  | { id: number; kind: "basis"; basisIndex: number };

type TrackerDraftKind = TrackerEntry["kind"];

export function DebugValueTrackerPanel({
  nQ,
  classicalRegs,
  debugClassicalRegisterValues,
  stateVector,
}: DebugValueTrackerPanelProps) {
  const nextEntryIdRef = useRef(1);
  const [draftKind, setDraftKind] = useState<TrackerDraftKind>("creg");
  const [draftRegisterName, setDraftRegisterName] = useState(classicalRegs[0]?.name ?? "");
  const [draftBasisInput, setDraftBasisInput] = useState("");
  const [entries, setEntries] = useState<TrackerEntry[]>([]);

  useEffect(() => {
    if (classicalRegs.length === 0) {
      setDraftRegisterName("");
      return;
    }

    if (!classicalRegs.some((register) => register.name === draftRegisterName)) {
      setDraftRegisterName(classicalRegs[0].name);
    }
  }, [classicalRegs, draftRegisterName]);

  const amplitudeCount = stateVector?.amplitudes.length ?? 2 ** nQ;
  const basisInputError = useMemo(
    () => validateBasisInput(draftBasisInput, amplitudeCount),
    [amplitudeCount, draftBasisInput],
  );

  const addTrackedValue = () => {
    if (draftKind === "creg") {
      if (!draftRegisterName || entries.some((entry) => entry.kind === "creg" && entry.registerName === draftRegisterName)) {
        return;
      }

      setEntries((current) => [
        ...current,
        { id: nextEntryIdRef.current++, kind: "creg", registerName: draftRegisterName },
      ]);
      return;
    }

    const basisIndex = parseBasisInput(draftBasisInput, amplitudeCount);
    if (basisIndex == null || entries.some((entry) => entry.kind === "basis" && entry.basisIndex === basisIndex)) {
      return;
    }

    setEntries((current) => [...current, { id: nextEntryIdRef.current++, kind: "basis", basisIndex }]);
    setDraftBasisInput("");
  };

  const removeEntry = (entryId: number) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
  };

  return (
    <div style={panelStyle}>
      <div style={controlsStyle}>
        <select value={draftKind} onChange={handleDraftKindChange(setDraftKind)} style={compactSelectStyle}>
          <option value="creg">Classical register</option>
          <option value="basis">Basis amplitude</option>
        </select>

        {draftKind === "creg" ? (
          <select
            value={draftRegisterName}
            onChange={(event) => setDraftRegisterName(event.target.value)}
            style={fieldStyle}
          >
            {classicalRegs.length === 0 ? <option value="">No cregs</option> : null}
            {classicalRegs.map((register) => (
              <option key={register.id} value={register.name}>
                {register.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={draftBasisInput}
            onChange={(event) => setDraftBasisInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") {
                return;
              }

              const basisIndex = parseBasisInput(draftBasisInput, amplitudeCount);
              if (basisIndex == null || entries.some((entry) => entry.kind === "basis" && entry.basisIndex === basisIndex)) {
                return;
              }

              event.preventDefault();
              addTrackedValue();
            }}
            placeholder="basis: 5 or 0101"
            style={fieldStyle}
          />
        )}

        <button
          type="button"
          onClick={addTrackedValue}
          disabled={
            draftKind === "creg"
              ? !draftRegisterName || classicalRegs.length === 0
              : basisInputError != null || parseBasisInput(draftBasisInput, amplitudeCount) == null
          }
          style={addButtonStyle}
        >
          Track
        </button>
      </div>

      {draftKind === "basis" && basisInputError ? <div style={hintStyle}>{basisInputError}</div> : null}

      <div style={entriesStyle}>
        {entries.length === 0 ? (
          <div style={emptyStyle}>Track cregs or basis amplitudes here.</div>
        ) : (
          entries.map((entry) => (
            <TrackedValueRow
              key={entry.id}
              entry={entry}
              nQ={nQ}
              stateVector={stateVector}
              debugClassicalRegisterValues={debugClassicalRegisterValues}
              onRemove={() => removeEntry(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TrackedValueRow({
  entry,
  nQ,
  stateVector,
  debugClassicalRegisterValues,
  onRemove,
}: {
  entry: TrackerEntry;
  nQ: number;
  stateVector: StateVector | null;
  debugClassicalRegisterValues: DebugClassicalRegisterValues;
  onRemove: () => void;
}) {
  if (entry.kind === "creg") {
    const value = debugClassicalRegisterValues[entry.registerName];

    return (
      <div style={rowStyle}>
        <div style={nameCellStyle}>
          <div style={labelStyle}>{entry.registerName}</div>
          <div style={kindBadgeStyle}>creg</div>
        </div>
        <div style={valueCellStyle}>
          <div style={valueLineStyle}>
            <span style={metricLabelStyle}>value</span>
            <span style={valueStyle}>{value ? formatRegisterValue(value) : "Unavailable"}</span>
          </div>
          <div style={metaLineStyle}>
            <span style={metricLabelStyle}>type</span>
            <span style={metaValueStyle}>{value ? formatRegisterValueType(value) : "Unavailable"}</span>
          </div>
        </div>
        <button type="button" onClick={onRemove} style={removeButtonStyle}>
          Remove
        </button>
      </div>
    );
  }

  const amplitude = stateVector?.amplitudes[entry.basisIndex] ?? null;

  return (
    <div style={rowStyle}>
      <div style={nameCellStyle}>
        <div style={labelStyle}>{formatBasisLabel(entry.basisIndex, nQ)}</div>
        <div style={kindBadgeStyle}>amp</div>
      </div>
      <div style={valueCellStyle}>
        <div style={valueLineStyle}>
          <span style={metricLabelStyle}>value</span>
          <span style={valueStyle}>
            {amplitude ? `${formatComplex(amplitude.re)} ${formatComplex(amplitude.im, "i")}` : "Unavailable"}
          </span>
        </div>
        <div style={metaLineStyle}>
          <span style={metricLabelStyle}>P</span>
          <span style={metaValueStyle}>
            {amplitude
              ? (amplitude.re * amplitude.re + amplitude.im * amplitude.im).toFixed(6)
              : "State vector unavailable"}
          </span>
        </div>
      </div>
      <button type="button" onClick={onRemove} style={removeButtonStyle}>
        Remove
      </button>
    </div>
  );
}

function handleDraftKindChange(setDraftKind: (kind: TrackerDraftKind) => void) {
  return (event: ChangeEvent<HTMLSelectElement>) => {
    setDraftKind(event.target.value === "basis" ? "basis" : "creg");
  };
}

function validateBasisInput(input: string, amplitudeCount: number) {
  if (!input.trim()) {
    return null;
  }

  const index = parseBasisInput(input, amplitudeCount);
  if (index == null) {
    return `Enter a basis state between 0 and ${Math.max(0, amplitudeCount - 1)}.`;
  }

  return null;
}

function parseBasisInput(input: string, amplitudeCount: number) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const radix = /^[01]+$/.test(trimmed) ? 2 : 10;
  if (!/^\d+$/.test(trimmed) && radix === 10) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, radix);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed >= amplitudeCount) {
    return null;
  }

  return parsed;
}

function formatRegisterValue(value: DebugClassicalRegisterValue) {
  if ("Int" in value) {
    return String(value.Int);
  }

  if ("Float" in value) {
    return String(value.Float);
  }

  return String(value.Bool);
}

function formatRegisterValueType(value: DebugClassicalRegisterValue) {
  if ("Int" in value) {
    return "int";
  }

  if ("Float" in value) {
    return "float";
  }

  return "bool";
}

function formatBasisLabel(index: number, qubitCount: number) {
  return `|${index.toString(2).padStart(qubitCount, "0")}>`;
}

function formatComplex(value: number, suffix = "") {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}${suffix}`;
}

const panelStyle = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  padding: "10px 12px",
  background: UI_COLORS.white,
} satisfies CSSProperties;

const controlsStyle = {
  display: "grid",
  gridTemplateColumns: "136px minmax(0, 1fr) auto",
  gap: 8,
  alignItems: "center",
} satisfies CSSProperties;

const compactSelectStyle = {
  ...controlStyle(),
  fontWeight: 600,
  minWidth: 0,
} satisfies CSSProperties;

const fieldStyle = {
  ...controlStyle(),
  minWidth: 0,
} satisfies CSSProperties;

const addButtonStyle = {
  ...buttonStyle({ tone: "primary", variant: "solid" }),
} satisfies CSSProperties;

const hintStyle = {
  ...subtleTextStyle,
  marginTop: 8,
} satisfies CSSProperties;

const entriesStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
  marginTop: 10,
  minHeight: 0,
  overflow: "auto",
  paddingRight: 2,
} satisfies CSSProperties;

const emptyStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  minHeight: 120,
  border: `1px dashed ${UI_COLORS.borderLight}`,
  borderRadius: 10,
  color: UI_COLORS.slate500,
  fontSize: 12,
} satisfies CSSProperties;

const rowStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(96px, 140px) minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "start",
  padding: "9px 0",
  background: UI_COLORS.white,
  borderBottom: `1px solid ${UI_COLORS.borderLight}`,
} satisfies CSSProperties;

const nameCellStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
} satisfies CSSProperties;

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: UI_COLORS.slate700,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
} satisfies CSSProperties;

const kindBadgeStyle = {
  fontSize: 10,
  color: UI_COLORS.slate500,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
} satisfies CSSProperties;

const valueCellStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
} satisfies CSSProperties;

const valueLineStyle = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr)",
  columnGap: 14,
  alignItems: "baseline",
} satisfies CSSProperties;

const metaLineStyle = {
  display: "grid",
  gridTemplateColumns: "22px minmax(0, 1fr)",
  columnGap: 14,
  alignItems: "baseline",
  marginTop: 2,
} satisfies CSSProperties;

const metricLabelStyle = {
  fontSize: 10,
  color: UI_COLORS.slate500,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  textTransform: "uppercase",
} satisfies CSSProperties;

const valueStyle = {
  fontSize: 12,
  color: UI_COLORS.slate900,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
} satisfies CSSProperties;

const metaValueStyle = {
  fontSize: 11,
  color: UI_COLORS.slate500,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
} satisfies CSSProperties;

const removeButtonStyle = {
  border: "none",
  background: "transparent",
  color: UI_COLORS.slate500,
  fontSize: 11,
  cursor: "pointer",
  padding: 0,
  alignSelf: "start",
} satisfies CSSProperties;
