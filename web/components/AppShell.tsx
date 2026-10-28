"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useCashflow } from "@/context/CashflowContext";

// Cartel con la empresa activa, arriba de todas las pantallas, para no cargar
// datos en la empresa equivocada.
function EmpresaBanner() {
  const { db, vista } = useCashflow();
  if (!db) return null;
  const nombres = db.empresas.map((e) => e.nombre);
  const empresa = db.empresas.find((e) => e.id === vista);
  const titulo = empresa ? empresa.nombre : "Consolidado";
  const detalle = empresa ? `Estás viendo y cargando datos de ${empresa.nombre}` : nombres.join(" + ");
  return (
    <div className={"empresa-banner empresa-banner--" + (empresa ? empresa.id : "all")} role="status">
      <span className="empresa-banner-k">{empresa ? "Empresa" : "Vista"}</span>
      <strong className="empresa-banner-v">{titulo}</strong>
      <span className="empresa-banner-d">{detalle}</span>
    </div>
  );
}

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
      <main className="main">
        <EmpresaBanner />
        {children}
      </main>
    </div>
  );
}
