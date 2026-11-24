import React, { useState } from 'react';
import api from '../Servicios/api';

export default function ModalCambioEstadoPago({
  factura,
  onClose,
  onEstadoActualizado,
}) {
  const [nuevoEstado, setNuevoEstado] = useState(factura?.estado_pago || 'Pagado');
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  if (!factura) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardandoEstado(true);
    try {
      await api.post(`/obras/fyag/v1/facturas/${factura.id_factura}/actualizar-estado-pago/`, {
        estado_pago: nuevoEstado,
      });
      if (onEstadoActualizado) onEstadoActualizado();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo actualizar el estado de pago.');
    } finally {
      setGuardandoEstado(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-cambio-estado-pago" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Actualizar Estado de Pago: {factura.folio_factura}</h3>
          <button type="button" onClick={onClose} className="modal-close-btn">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="nuevo_estado">Nuevo Estado de Pago</label>
            <select
              id="nuevo_estado"
              className="form-control"
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value)}
            >
              <option value="Pendiente">Pendiente (restablece saldo al total)</option>
              <option value="Pago Parcial">Pago Parcial</option>
              <option value="Pagado">Pagado (deja saldo en $0)</option>
            </select>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={guardandoEstado}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardandoEstado}>
              {guardandoEstado ? 'Guardando...' : 'Actualizar Estado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
