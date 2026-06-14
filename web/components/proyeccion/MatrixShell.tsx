import type { ReactNode } from "react";
import { monthLabel } from "@/lib/dates";

export function MatrixShell({
  months,
  children,
  firstColLabel,
}: {
  months: string[];
  children: ReactNode;
  firstColLabel: string;
}) {
  return (
    <div className="table-wrap matrix-wrap proj-wrap">
      <table className="grid matrix">
        <thead>
          <tr>
            <th className="c-rowhead sticky-col">{firstColLabel}</th>
            <th className="c-mon c-total">Total</th>
            {months.map((mk) => (
              <th key={mk} className="c-mon">{monthLabel(mk)}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
