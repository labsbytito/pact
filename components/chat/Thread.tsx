import type { ReactNode } from "react";

export function Thread({ children }: { children: ReactNode }) {
  return <div className="thread">{children}</div>;
}
