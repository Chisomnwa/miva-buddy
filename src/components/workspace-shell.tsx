import type { ReactNode } from "react";
import { AppNavigation } from "@/components/app-navigation";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="workspace-shell">
      <AppNavigation />
      <main className="workspace-main">
        <div className="workspace-topline">
          <span className="workspace-session">Saved in this browser</span>
        </div>
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}
