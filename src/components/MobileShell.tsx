import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface Props {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  hideNav?: boolean;
}

export function MobileShell({ title, subtitle, right, children, hideNav }: Props) {
  return (
    <div className="mobile-shell bg-background relative">
      {(title || right) && (
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between">
          <div>
            {title && <h1 className="text-lg font-semibold tracking-tight">{title}</h1>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <main className={`px-5 pt-4 ${hideNav ? "pb-6" : "pb-28"}`}>{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
