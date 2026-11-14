import React, { useState } from 'react';

export default function ModalCambiarEstado({
  obra,
  transicion,
  isOpen,
  onClose,
  onConfirmar,
  cargando,
}) {
  const [motivo, setMotivo] = useState('');
  const [errorValidacion, setErrorValidacion] = useState('');

  if (!isOpen || !obra || !transicion) return null;

  const requiereMotivo = transicion.requiere_motivo;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (requiereMotivo && !motivo.trim()) {
      setErrorValidacion('Debe ingresar obligatoriamente el motivo para continuar.');
      return;
    }
    setErrorValidacion('');
    onConfirmar(transicion.codigo_estado, motivo.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-cambiar-estado"
        style={{ backgroundColor: '#ffffff', background: '#ffffff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Transición de Estado Operativo</h3>
          <button className="modal-close" onClick={onClose} disabled={cargando}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p>
              Estás a punto de cambiar el estado de la obra:{' '}
              <strong>{obra.codigo_obra} - {obra.nombre_obra}</strong>
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                margin: '1rem 0',
                padding: '0.75rem',
                backgroundColor: 'var(--bg)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                fontSize: '0.9rem',
              }}
            >
              <span>Estado actual: <strong>{obra.estado_obra_descripcion}</strong></span>
              <span>&rarr;</span>
              <span>Nuevo estado: <strong>{transicion.descripcion}</strong></span>
            </div>

            {transicion.codigo_estado === 'FINALIZADA' && (
              <div className="cierre-alerta" style={{ marginBottom: '1rem' }}>
                ℹ️ Al finalizar la obra, el sistema asignará automáticamente la fecha de cierre de hoy y no se permitirán modificaciones operativas posteriores.
              </div>
            )}

            {requiereMotivo && (
              <div className="form-group">
                <label htmlFor="motivo-input">
                  Motivo de {transicion.codigo_estado === 'SUSPENDIDA' ? 'Suspensión' : 'Cancelación'} *
                </label>
                <textarea
                  id="motivo-input"
                  rows={3}
                  className="form-control"
                  placeholder="Explique detalladamente la causa (ej. falta de repuestos, solicitud de cliente)..."
                  value={motivo}
                  onChange={(e) => {
                    setMotivo(e.target.value);
                    if (errorValidacion) setErrorValidacion('');
                  }}
                  autoFocus
                />
                {errorValidacion && (
                  <span style={{ color: 'var(--estado-cancelada)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                    {errorValidacion}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={cargando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`btn-primary ${transicion.codigo_estado === 'CANCELADA' ? 'transicion-btn CANCELADA' : ''}`}
              disabled={cargando}
            >
              {cargando ? 'Guardando...' : `Confirmar: ${transicion.accion}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

