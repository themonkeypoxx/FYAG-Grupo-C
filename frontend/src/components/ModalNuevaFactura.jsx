import React, { useState, useEffect } from 'react';
import api from '../Servicios/api';

export default function ModalNuevaFactura({
  isOpen,
  onClose,
  presupuestosDisponibles = [],
  presupuestoInicialId = '',
  onFacturaCreada,
  formatearCLP,
}) {
  const [nuevaFactura, setNuevaFactura] = useState({
    folio_factura: '',
    presupuesto: '',
    cliente: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    monto_total: '',
    estado_pago: 'Pendiente',
  });
  const [guardandoFactura, setGuardandoFactura] = useState(false);
  const [mensajeFactura, setMensajeFactura] = useState(null);

  // Filtrar únicamente los presupuestos aprobados por Gerencia y sin factura previa
  const presupuestosFacturables = presupuestosDisponibles.filter(
    (p) => (p.estado_presupuesto === 'Aprobado' || p.estado_presupuesto === 'APROBADO') && !p.factura_asociada
  );

  const handlePresupuestoSeleccionado = (presupuestoId) => {
    const pres = presupuestosDisponibles.find((p) => p.id_presupuesto === presupuestoId);
    if (pres) {
      setNuevaFactura((prev) => ({
        ...prev,
        presupuesto: pres.id_presupuesto,
        cliente: pres.cliente,
        monto_total: pres.monto_total || '',
        folio_factura: prev.folio_factura || `FAC-${pres.numero_presupuesto?.replace('PRE-', '') || Date.now().toString().slice(-5)}`,
      }));
    } else {
      setNuevaFactura((prev) => ({
        ...prev,
        presupuesto: '',
        cliente: '',
        monto_total: '',
      }));
    }
  };

  useEffect(() => {
    if (presupuestoInicialId && presupuestosDisponibles.length > 0) {
      handlePresupuestoSeleccionado(presupuestoInicialId);
    }
  }, [presupuestoInicialId, presupuestosDisponibles]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nuevaFactura.presupuesto) {
      setMensajeFactura({ tipo: 'error', texto: 'Debe seleccionar un presupuesto asociado.' });
      return;
    }
    setGuardandoFactura(true);
    setMensajeFactura(null);
    try {
      await api.post('/obras/fyag/v1/facturas/', nuevaFactura);
      setMensajeFactura({ tipo: 'exito', texto: '¡Factura creada exitosamente!' });
      if (onFacturaCreada) onFacturaCreada();
      setTimeout(() => {
        onClose();
        setMensajeFactura(null);
        setNuevaFactura({
          folio_factura: '',
          presupuesto: '',
          cliente: '',
          fecha_emision: new Date().toISOString().split('T')[0],
          fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          monto_total: '',
          estado_pago: 'Pendiente',
        });
      }, 1000);
    } catch (err) {
      const dataErr = err.response?.data;
      const detalle = dataErr
        ? Object.entries(dataErr)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ')
        : 'Error al emitir la factura.';
      setMensajeFactura({ tipo: 'error', texto: detalle });
    } finally {
      setGuardandoFactura(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-nueva-factura" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🧾 Emitir Nueva Factura</h3>
          <button type="button" onClick={onClose} className="modal-close-btn">
            &times;
          </button>
        </div>

        {mensajeFactura && (
          <div className={`modal-alert ${mensajeFactura.tipo === 'exito' ? 'modal-alert-success' : 'modal-alert-danger'}`}>
            {mensajeFactura.texto}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="folio_factura">Folio Factura *</label>
            <input
              type="text"
              id="folio_factura"
              className="form-control"
              placeholder="Ej: FAC-2026-001"
              value={nuevaFactura.folio_factura}
              onChange={(e) => setNuevaFactura({ ...nuevaFactura, folio_factura: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="presupuesto_select">Presupuesto Vinculado *</label>
            <select
              id="presupuesto_select"
              className="form-control"
              value={nuevaFactura.presupuesto}
              onChange={(e) => handlePresupuestoSeleccionado(e.target.value)}
              required
            >
              <option value="">— Seleccione un presupuesto aprobado —</option>
              {presupuestosFacturables.map((p) => (
                <option key={p.id_presupuesto} value={p.id_presupuesto}>
                  {p.numero_presupuesto} — {p.cliente_razon_social} ({formatearCLP ? formatearCLP(p.monto_total) : p.monto_total})
                </option>
              ))}
              {presupuestosFacturables.length === 0 && (
                <option value="" disabled>No hay presupuestos aprobados pendientes de facturación</option>
              )}
            </select>
          </div>

          <div className="modal-form-grid">
            <div className="form-group">
              <label htmlFor="fecha_emision">Fecha Emisión *</label>
              <input
                type="date"
                id="fecha_emision"
                className="form-control"
                value={nuevaFactura.fecha_emision}
                onChange={(e) => setNuevaFactura({ ...nuevaFactura, fecha_emision: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="fecha_vencimiento">Fecha Vencimiento *</label>
              <input
                type="date"
                id="fecha_vencimiento"
                className="form-control"
                value={nuevaFactura.fecha_vencimiento}
                onChange={(e) => setNuevaFactura({ ...nuevaFactura, fecha_vencimiento: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="monto_total">Monto Total Facturado (CLP) *</label>
            <input
              type="number"
              step="0.01"
              min="1"
              id="monto_total"
              className="form-control"
              placeholder="1000000"
              value={nuevaFactura.monto_total}
              onChange={(e) => setNuevaFactura({ ...nuevaFactura, monto_total: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="estado_pago_inicial">Estado Inicial</label>
            <select
              id="estado_pago_inicial"
              className="form-control"
              value={nuevaFactura.estado_pago}
              onChange={(e) => setNuevaFactura({ ...nuevaFactura, estado_pago: e.target.value })}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Pago Parcial">Pago Parcial</option>
              <option value="Pagado">Pagado</option>
            </select>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={guardandoFactura}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardandoFactura}>
              {guardandoFactura ? 'Emitiendo...' : 'Emitir Factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
