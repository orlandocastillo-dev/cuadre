import { useMoney } from "../app/hooks";
import type { Account, Category, Transaction } from "../domain/types";
import { Icon } from "./Icon";
import { useSheet } from "./sheet";

interface Props {
  tx: Transaction;
  category?: Category;
  account?: Account;
}

/** Una fila de movimiento. Tocarla abre el formulario para editarla. */
export function TxRow({ tx, category, account }: Props) {
  const money = useMoney();
  const { open } = useSheet();
  return (
    <li>
      <button type="button" className="tx" onClick={() => open({ edit: tx })}>
        <span className={`tx__icon cat--c${category?.color ?? 9}`}>
          <Icon name={category?.icon ?? "dots"} size={18} />
        </span>
        <span className="tx__main">
          <span className="tx__title">{tx.note || category?.name || "Sin categoría"}</span>
          <span className="tx__meta">
            {tx.note ? category?.name : null}
            {tx.note && account ? ", " : null}
            {account?.name}
          </span>
        </span>
        <span className={`tx__amount ${tx.kind === "ingreso" ? "is-in" : ""}`}>
          {tx.kind === "ingreso" ? "+" : "−"}
          {money(tx.amount).replace("-", "")}
        </span>
      </button>
    </li>
  );
}
