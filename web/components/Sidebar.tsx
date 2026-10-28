"use client";

import { useRouter, usePathname } from "next/navigation";
import { buildCashflow } from "@/lib/calc";
import { money } from "@/lib/format";
import { useCashflow } from "@/context/CashflowContext";

const NAV = [
  { href: "/movimientos", label: "Movimientos", icon: "↹" },
  { href: "/proyeccion", label: "Proyección", icon: "◳" },
  { href: "/cheques", label: "Cheques", icon: "▤" },
  { href: "/cashflow", label: "Cashflow", icon: "▦" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙" },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, db, vista, setVista } = useCashflow();
  // label: código corto (se usa con el menú replegado y en el pie); nombre: lo que se lee en el selector.
  const vistas = [
    ...(db?.empresas ?? []).map((e) => ({ id: e.id, label: e.codigo, nombre: e.nombre })),
    { id: "all", label: "Todas", nombre: "Todas" },
  ];
  const vistaActual = vistas.find((v) => v.id === vista);

  let cierre = 0;
  if (state) {
    const cf = buildCashflow(state);
    const last = cf.rows[cf.rows.length - 1];
    cierre = last ? last.cierreTotal : 0;
  }

  return (
    <aside className="sidebar">
      <div className="brand-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpeg" alt="Grupo Don Félix" />
      </div>
      <div className="brand">
        <div className="brand-txt">
          <strong>CASHFLOW</strong>
          <span>{db ? db.empresas.map((e) => e.codigo).join(" · ") : ""}</span>
        </div>
        <button
          className="collapse-btn"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expandir menú" : "Replegar menú"}
          aria-label="Replegar menú"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <div className="vista">
        <span className="vista-k">Empresa</span>
        <div className="vista-opts" role="tablist" aria-label="Empresa">
          {vistas.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={vista === v.id}
              className={"vista-opt" + (vista === v.id ? " active" : "")}
              onClick={() => setVista(v.id)}
              title={v.id === "all" ? "Todas las empresas (consolidado)" : v.nombre}
            >
              <span className="vista-opt-name">{v.nombre}</span>
              <span className="vista-opt-code">{v.label}</span>
            </button>
          ))}
        </div>
      </div>
      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.href}
            className={"nav-item" + (pathname === n.href ? " active" : "")}
            onClick={() => {
              router.push(n.href);
              onNavigate?.();
            }}
            title={n.label}
          >
            <span className="nav-ico">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="foot-k">Cierre Banco + FCI{vistaActual && vista !== "all" ? ` · ${vistaActual.label}` : ""}</span>
        <span className="foot-v">{money(cierre, false)}</span>
      </div>
    </aside>
  );
}
