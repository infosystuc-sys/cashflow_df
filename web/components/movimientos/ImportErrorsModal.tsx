"use client";

import { Modal } from "@/components/ui";
import type { ImportRowError } from "@/lib/import";

export function ImportErrorsModal({
  errors,
  onClose,
}: {
  errors: ImportRowError[];
  onClose: () => void;
}) {
  return (
    <Modal
      title="No se pudo importar el archivo"
      width={520}
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <p className="form-tip">
        Corregí estos problemas en el Excel y volvé a intentar la importación. No se cargó ningún movimiento.
      </p>
      <ul className="import-errors">
        {errors.map((e, i) => (
          <li key={i}>
            {e.row > 0 ? <strong>Fila {e.row}: </strong> : null}
            {e.message}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
