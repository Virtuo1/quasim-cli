import type { ReactNode } from "react";
import { modalSurfaceStyle } from "./modalStyles";

interface ModalFrameProps {
  children: ReactNode;
  width: number;
}

export function ModalFrame({ children, width }: ModalFrameProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 300,
      }}
    >
      <div
        style={{
          ...modalSurfaceStyle,
          width: `min(${width}px, calc(100vw - 32px))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
