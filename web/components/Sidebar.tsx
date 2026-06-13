"use client";

import { useRouter, usePathname } from "next/navigation";
import { buildCashflow } from "@/lib/calc";
import { money } from "@/lib/format";
import { useCashflow } from "@/context/CashflowContext";

const NAV = [
  { href: "/movimientos", label: "Movimientos", icon: "↹" },
  { href: "/proyeccion", label: "Proyección", icon: "◳" },
  { href: "/cashflow", label: "Cashflow", icon: "▦" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙" },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useCashflow();

  let cierre = 0;
  if (state) {
    const cf = buildCashflow(state);
    const last = cf.rows[cf.rows.length - 1];
    cierre = last ? last.cierreTotal : 0;
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">$</div>
        <div className="brand-txt">
          <strong>CASHFLOW</strong>
          <span>Galicia · Nación</span>
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
      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.href}
            className={"nav-item" + (pathname === n.href ? " active" : "")}
            onClick={() => router.push(n.href)}
            title={n.label}
          >
            <span className="nav-ico">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="foot-k">Cierre Banco + FCI</span>
        <span className="foot-v">{money(cierre, false)}</span>
      </div>
    </aside>
  );
}
