"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("cf_sidebar_collapsed") === "1");
    } catch {
      // localStorage unavailable, keep default
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("cf_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // localStorage unavailable, ignore
      }
      return next;
    });
  };

  return (
    <div className={"app" + (collapsed ? " collapsed" : "") + (mobileOpen ? " mobile-open" : "")}>
      {/* Solo visible en mobile (oculto en desktop vía CSS). */}
      <div className="mobile-topbar">
        <button className="mobile-burger" onClick={() => setMobileOpen(true)} aria-label="Abrir menú">
          ☰
        </button>
        <div className="mobile-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mobile-brand-logo" src="/logo.jpeg" alt="Grupo Don Félix" />
          <strong>CASHFLOW</strong>
        </div>
      </div>
      <div className="mobile-backdrop" onClick={() => setMobileOpen(false)} />
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onNavigate={() => setMobileOpen(false)} />
      <main className="main">{children}</main>
    </div>
  );
}
