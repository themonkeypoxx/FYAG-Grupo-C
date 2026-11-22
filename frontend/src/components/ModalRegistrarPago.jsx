import React, { useState } from 'react';
import api from '../Servicios/api';

export default function ModalRegistrarPago({
  factura,
  onClose,
  onPagoRegistrado,
  formatearCLP,
}) {
  const [datosPago, setDatosPago] = useState({
    monto_abono: factura?.saldo_pendiente || '',
    metodo_pago: 'Transferencia',
    nro_comprobante: '',
    notas: '',
  });
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [mensajePago, setMensajePago] = useState(null);

  if (!factura) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardandoPago(true);
    setMensajePago(null);
    try {
      await api.post(`/obras/fyag/v1/facturas/${factura.id_factura}/actualizar-estado-pago/`, {
        monto_abono: datosPago.monto_abono,
        metodo_pago: datosPago.metodo_pago,
        nro_comprobante: datosPago.nro_comprobante,
        notas: datosPago.notas,
      });
      setMensajePago({ tipo: 'exito', texto: '¡Pago registrado y saldo actualizado!' });
      if (onPagoRegistrado) onPagoRegistrado();
      setTimeout(() => {
        onClose();
        setDatosPago({ monto_abono: '', metodo_pago: 'Transferencia', nro_comprobante: '', notas: '' });
        setMensajePago(null);
      }, 1000);
    } catch (err) {
      const errMsj = err.response?.data?.error || 'Error al registrar el abono.';
      setMensajePago({ tipo: 'error', texto: errMsj });
    } finally {
      setGuardandoPago(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-registrar-pago" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>💳 Registrar Pago a Factura</h3>
          <button type="button" onClick={onClose} className="modal-close-btn">
            &times;
          </button>
        </div>

        <div className="modal-info-box">
          <div>Factura: <strong>{factura.folio_factura}</strong></div>
          <div>Cliente: <strong>{factura.cliente_razon_social}</strong></div>
          <div>Total: <strong>{formatearCLP ? formatearCLP(factura.monto_total) : factura.monto_total}</strong></div>
          <div className="modal-info-saldo">
            Saldo Pendiente: {formatearCLP ? formatearCLP(factura.saldo_pendiente) : factura.saldo_pendiente}
          </div>
        </div>

        {mensajePago && (
          <div className={`modal-alert ${mensajePago.tipo === 'exito' ? 'modal-alert-success' : 'modal-alert-danger'}`}>
            {mensajePago.texto}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="monto_abono">Monto a Abonar (CLP) *</label>
            <input
              type="number"
              step="0.01"
              min="1"
              max={factura.saldo_pendiente}
              id="monto_abono"
              className="form-control"
              value={datosPago.monto_abono}
              onChange={(e) => setDatosPago({ ...datosPago, monto_abono: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="metodo_pago">Método de Pago</label>
            <select
              id="metodo_pago"
              className="form-control"
              value={datosPago.metodo_pago}
              onChange={(e) => setDatosPago({ ...datosPago, metodo_pago: e.target.value })}
            >
              <option value="Transferencia">Transferencia Electrónica</option>
              <option value="Cheque">Cheque al Día / Plazo</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
              <option value="Otro">Otro</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="nro_comprobante">N° Comprobante / Transacción</label>
            <input
              type="text"
              id="nro_comprobante"
              className="form-control"
              placeholder="Ej: TRX-987654"
              value={datosPago.nro_comprobante}
              onChange={(e) => setDatosPago({ ...datosPago, nro_comprobante: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="notas">Notas / Observaciones</label>
            <textarea
              id="notas"
              rows={2}
              className="form-control"
              placeholder="Detalles adicionales del pago..."
              value={datosPago.notas}
              onChange={(e) => setDatosPago({ ...datosPago, notas: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={guardandoPago}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardandoPago}>
              {guardandoPago ? 'Procesando...' : 'Confirmar Abono'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
