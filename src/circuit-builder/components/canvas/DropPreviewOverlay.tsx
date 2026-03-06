import { CH, CRH, CW, ERROR_COLORS, LW, PX, PY } from "../../constants";
import type { DropPreview } from "../../types";
import { cregY } from "../../utils/layout";

export function DropPreviewOverlay({ dropPreview, nQ }: { dropPreview: DropPreview | null; nQ: number }) {
  if (!dropPreview) {
    return null;
  }

  if (dropPreview.zone === "qubit") {
    const previewHeight = CH * (dropPreview.qubitSpan ?? 1) - 10;

    if (dropPreview.insertAt != null) {
      return (
        <rect
          x={PX + LW + dropPreview.insertAt * CW - 5}
          y={PY + dropPreview.qubit * CH + 5}
          width={10}
          height={previewHeight}
          rx={3}
          fill={dropPreview.valid ? "rgba(34,197,94,.18)" : ERROR_COLORS.previewFill}
          stroke={dropPreview.valid ? "#16a34a" : ERROR_COLORS.primary}
          strokeWidth={1.5}
          strokeDasharray="4"
        />
      );
    }

    return (
      <rect
        x={PX + LW + dropPreview.step * CW + 5}
        y={PY + dropPreview.qubit * CH + 5}
        width={CW - 10}
        height={previewHeight}
        rx={3}
        fill={dropPreview.valid ? "rgba(34,197,94,.12)" : ERROR_COLORS.previewFill}
        stroke={dropPreview.valid ? "#16a34a" : ERROR_COLORS.primary}
        strokeWidth={1.5}
        strokeDasharray="4"
      />
    );
  }

  if (dropPreview.insertAt != null) {
    return (
      <rect
        x={PX + LW + dropPreview.insertAt * CW - 5}
        y={cregY(dropPreview.cregIdx, nQ) - CRH / 2 + 5}
        width={10}
        height={CRH - 10}
        rx={3}
        fill={dropPreview.valid ? "rgba(124,58,237,.14)" : ERROR_COLORS.previewFill}
        stroke={dropPreview.valid ? "#7c3aed" : ERROR_COLORS.primary}
        strokeWidth={1.5}
        strokeDasharray="4"
      />
    );
  }

  return (
    <rect
      x={PX + LW + dropPreview.step * CW + 5}
      y={cregY(dropPreview.cregIdx, nQ) - CRH / 2 + 5}
      width={54}
      height={CRH - 10}
      rx={3}
      fill={dropPreview.valid ? "rgba(124,58,237,.1)" : ERROR_COLORS.previewFill}
      stroke={dropPreview.valid ? "#7c3aed" : ERROR_COLORS.primary}
      strokeWidth={1.5}
      strokeDasharray="4"
    />
  );
}
