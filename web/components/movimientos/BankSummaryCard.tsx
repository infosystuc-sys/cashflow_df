import { money } from "@/lib/format";
import type { Bank, BankSummary } from "@/lib/types";

export function BankSummaryCard({ summary, bank: b }: { summary: BankSummary; bank: Bank }) {
  const items: { k: string; v: number; cls?: string }[] = [
    { k: "Saldo Inicial", v: summary.inicial },
    { k: "Ingresos", v: summary.ingresos, cls: "pos" },
    { k: "Venta de USD", v: summary.ventaUSD, cls: "pos" },
    { k: "Pagos", v: summary.pagos, cls: "neg" },
    { k: "Transf entre cuentas", v: summary.transf },
    { k: "Transferencia a banco propio", v: summary.transfPropio },
  ];

  return (
    <div className="sumcard" style={{ "--bk": b.color } as React.CSSProperties}>
      <div className="sumcard-grid">
        {items.map((it) => (
          <div className="sumcard-item" key={it.k}>
            <span className="sumcard-k">{it.k}</span>
            <span className={"sumcard-v " + (it.cls || "")}>{money(it.v)}</span>
          </div>
        ))}
        <div className="sumcard-item sumcard-item--final">
          <span className="sumcard-k">Saldo final</span>
          <span className="sumcard-v big">{money(summary.final)}</span>
        </div>
      </div>
      <div className={"sumcard-control " + (Math.abs(summary.control) < 0.01 ? "ok" : "err")}>
        {Math.abs(summary.control) < 0.01 ? "✓ Control OK" : "⚠ Control: " + money(summary.control)}
      </div>
    </div>
  );
}
