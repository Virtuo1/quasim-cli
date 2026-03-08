import type { ReactNode } from "react";

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
          background: "#fff",
          borderRadius: 6,
          padding: 24,
          width: `min(${width}px, calc(100vw - 32px))`,
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,.3)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
