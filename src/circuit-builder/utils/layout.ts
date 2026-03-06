import { CH, CREG_GAP, CRH, CW, LW, PX, PY } from "../constants";
import type { CanvasHit, ClassicalRegister } from "../types";

let currentId = 0;
const INSERT_GAP_HITBOX = 10;

export const uid = () => {
  currentId += 1;
  return currentId;
};

export const wireX = (step: number) => PX + LW + step * CW + CW / 2;
export const wireY = (qubit: number) => PY + qubit * CH + CH / 2;
export const cregY = (idx: number, nQ: number) => PY + nQ * CH + CREG_GAP + idx * CRH + CRH / 2;

export const fmt = (rad?: number | null) => {
  if (rad == null) {
    return "";
  }

  const pi = rad / Math.PI;
  if (Math.abs(pi - Math.round(pi)) < 0.001) {
    return `${Math.round(pi)}π`;
  }
  if (Math.abs(pi * 2 - Math.round(pi * 2)) < 0.001) {
    return `${Math.round(pi * 2)}/2π`;
  }
  if (Math.abs(pi * 4 - Math.round(pi * 4)) < 0.001) {
    return `${Math.round(pi * 4)}/4π`;
  }
  return rad.toFixed(3);
};

interface ClientToCanvasConfig {
  svg: SVGSVGElement | null;
  nQ: number;
  nS: number;
  classicalRegs: ClassicalRegister[];
}

export const clientToCanvasHit = (
  clientX: number,
  clientY: number,
  config: ClientToCanvasConfig,
): CanvasHit | null => {
  const rect = config.svg?.getBoundingClientRect();
  if (!rect) {
    return null;
  }

  const rx = clientX - rect.left - PX - LW;
  const ry = clientY - rect.top - PY;
  if (rx < 0 || rx > config.nS * CW + INSERT_GAP_HITBOX) {
    return null;
  }

  const boundaryIndex = Math.round(rx / CW);
  const insertAt =
    boundaryIndex >= 0 &&
    boundaryIndex <= config.nS &&
    Math.abs(rx - boundaryIndex * CW) <= INSERT_GAP_HITBOX
      ? boundaryIndex
      : undefined;

  const step = Math.min(Math.max(Math.floor(rx / CW), 0), config.nS - 1);

  const qubit = Math.floor(ry / CH);
  if (qubit >= 0 && qubit < config.nQ) {
    return { zone: "qubit", step, qubit, insertAt };
  }

  if (config.classicalRegs.length > 0) {
    const cregAreaTop = config.nQ * CH + CREG_GAP;
    const relY = ry - cregAreaTop;
    if (relY >= 0) {
      const cregIdx = Math.floor(relY / CRH);
      if (cregIdx >= 0 && cregIdx < config.classicalRegs.length) {
        return {
          zone: "creg",
          step,
          cregIdx,
          cregName: config.classicalRegs[cregIdx].name,
          insertAt,
        };
      }
    }
  }

  return null;
};
