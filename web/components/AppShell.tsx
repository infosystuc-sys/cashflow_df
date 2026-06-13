"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

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
    <div className={"app" + (collapsed ? " collapsed" : "")}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main className="main">{children}</main>
    </div>
  );
}
