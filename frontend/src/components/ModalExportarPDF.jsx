import React, { useState, useEffect } from 'react';
import api from '../Servicios/api';

export default function ModalExportarPDF({
  isOpen,
  onClose,
  tipoInicial = 'presupuesto',
  presupuestos = [],
  facturas = [],
  formatearCLP,
}) {
  const [tipoPDF, setTipoPDF] = useState(tipoInicial);
  const [itemPDFSeleccionado, setItemPDFSeleccionado] = useState('');
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [errorPDF, setErrorPDF] = useState(null);

  useEffect(() => {
    setTipoPDF(tipoInicial);
    setItemPDFSeleccionado('');
    setErrorPDF(null);
  }, [tipoInicial, isOpen]);

  if (!isOpen) return null;

  const handleExportar = async () => {
    if (!itemPDFSeleccionado) {
      setErrorPDF('Debes seleccionar un elemento para exportar.');
      return;
    }
    setExportandoPDF(true);
    setErrorPDF(null);
    try {
      const endpoint =
        tipoPDF === 'presupuesto'
          ? `/obras/fyag/v1/presupuestos/${itemPDFSeleccionado}/pdf/`
          : `/obras/fyag/v1/facturas/${itemPDFSeleccionado}/pdf/`;

      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const nombre =
        tipoPDF === 'presupuesto'
          ? presupuestos.find((p) => p.id_presupuesto === itemPDFSeleccionado)?.numero_presupuesto || itemPDFSeleccionado
          : facturas.find((f) => f.id_factura === itemPDFSeleccionado)?.folio_factura || itemPDFSeleccionado;
      link.setAttribute('download', `${tipoPDF}_${nombre}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
      setItemPDFSeleccionado('');
    } catch (err) {
      setErrorPDF(
        err.response?.status === 404
          ? 'No se encontró el elemento seleccionado.'
          : 'Error al generar el PDF. Intente de nuevo.'
      );
    } finally {
      setExportandoPDF(false);
    }
  };

  const presupuestoSel = tipoPDF === 'presupuesto' && itemPDFSeleccionado
    ? presupuestos.find((x) => x.id_presupuesto === itemPDFSeleccionado)
    : null;

  const facturaSel = tipoPDF === 'factura' && itemPDFSeleccionado
    ? facturas.find((x) => x.id_factura === itemPDFSeleccionado)
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-exportar-pdf" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📥 Exportar a PDF</h3>
          <button type="button" onClick={onClose} className="modal-close-btn">
            &times;
          </button>
        </div>

        <div className="form-group">
          <label>¿Qué desea exportar?</label>
          <div className="pdf-type-selector">
            {[
              { valor: 'presupuesto', etiqueta: '📄 Presupuesto' },
              { valor: 'factura', etiqueta: '🧾 Factura' },
            ].map(({ valor, etiqueta }) => (
              <button
                key={valor}
                type="button"
                onClick={() => {
                  setTipoPDF(valor);
                  setItemPDFSeleccionado('');
                  setErrorPDF(null);
                }}
                className={`pdf-type-btn ${tipoPDF === valor ? 'active' : ''}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label htmlFor="pdf_item_select">
            {tipoPDF === 'presupuesto' ? 'Seleccionar presupuesto' : 'Seleccionar factura'}
          </label>
          <select
            id="pdf_item_select"
            className="form-control"
            value={itemPDFSeleccionado}
            onChange={(e) => {
              setItemPDFSeleccionado(e.target.value);
              setErrorPDF(null);
            }}
            style={{ marginTop: '0.4rem' }}
          >
            <option value="">— Seleccione —</option>
            {tipoPDF === 'presupuesto'
              ? presupuestos.map((p) => (
                  <option key={p.id_presupuesto} value={p.id_presupuesto}>
                    {p.numero_presupuesto} — {p.cliente_razon_social} ({formatearCLP ? formatearCLP(p.monto_total) : p.monto_total})
                  </option>
                ))
              : facturas.map((f) => (
                  <option key={f.id_factura} value={f.id_factura}>
                    {f.folio_factura} — {f.cliente_razon_social} · {f.estado_pago}
                  </option>
                ))}
          </select>
        </div>

        {presupuestoSel && (
          <div className="modal-info-box">
            <div><strong>{presupuestoSel.numero_presupuesto}</strong> · {presupuestoSel.estado_presupuesto}</div>
            <div className="text-muted">{presupuestoSel.obra_codigo} — {presupuestoSel.obra_nombre}</div>
            <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>
              Total: {formatearCLP ? formatearCLP(presupuestoSel.monto_total) : presupuestoSel.monto_total}
            </div>
          </div>
        )}

        {facturaSel && (
          <div className="modal-info-box">
            <div><strong>{facturaSel.folio_factura}</strong></div>
            <div className="text-muted">{facturaSel.cliente_razon_social} · {facturaSel.numero_presupuesto}</div>
            <div>
              Total: {formatearCLP ? formatearCLP(facturaSel.monto_total) : facturaSel.monto_total} · Saldo: {formatearCLP ? formatearCLP(facturaSel.saldo_pendiente) : facturaSel.saldo_pendiente}
            </div>
            <div style={{ fontWeight: 700, color: facturaSel.estado_pago === 'Pagado' ? '#16a34a' : '#dc2626', marginTop: '0.25rem' }}>
              {facturaSel.estado_pago}
            </div>
          </div>
        )}

        {errorPDF && (
          <div className="modal-alert modal-alert-danger" style={{ marginTop: '0.75rem' }}>
            {errorPDF}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={exportandoPDF}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExportar}
            className="btn-primary"
            disabled={exportandoPDF || !itemPDFSeleccionado}
          >
            {exportandoPDF ? 'Generando PDF...' : '📥 Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
