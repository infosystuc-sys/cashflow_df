import { money } from "@/lib/format";

export function ChequeSummaryCard({
  resumen,
}: {
  resumen: { totalCartera: number; totalDepositado: number; totalCedido: number; cantidadRechazados: number };
}) {
  const items: { k: string; v: string; cls?: string }[] = [
    { k: "En cartera", v: money(resumen.totalCartera) },
    { k: "Depositado", v: money(resumen.totalDepositado) },
    { k: "Cedido", v: money(resumen.totalCedido), cls: "pos" },
    { k: "En cartera por rechazo", v: String(resumen.cantidadRechazados) },
  ];

  return (
    <div className="sumcard">
      <div className="sumcard-grid">
        {items.map((it) => (
          <div className="sumcard-item" key={it.k}>
            <span className="sumcard-k">{it.k}</span>
            <span className={"sumcard-v " + (it.cls || "")}>{it.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
