import React from 'react';

export default function ObraCard({ obra, onSolicitarTransicion, onAsignarTecnico }) {
  const transiciones = obra.transiciones_posibles || [];
  const esTerminal = ['FINALIZADA', 'CANCELADA'].includes(obra.estado_obra_codigo);

  // Formato chileno de moneda
  const formatearMonto = (monto) => {
    if (!monto && monto !== 0) return 'No especificado';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(monto);
  };

  return (
    <article className={`obra-card ${obra.estado_obra_codigo || ''}`}>
      <div>
        <div className="card-header">
          <span className="codigo-tag">{obra.codigo_obra}</span>
          <div className="badges-group">
            <span className={`badge-tipo ${obra.tipo_servicio_codigo}`}>
              {obra.tipo_servicio_nombre}
            </span>
            <span className={`badge-estado ${obra.estado_obra_codigo}`}>
              ● {obra.estado_obra_descripcion}
            </span>
          </div>
        </div>

        <h3 className="card-title">{obra.nombre_obra}</h3>

        <div className="card-details">
          <div className="detail-item">
            <span>🏢</span>
            <span>
              Cliente: <strong>{obra.cliente_razon_social || 'No asignado'}</strong>
            </span>
          </div>
          <div className="detail-item">
            <span>📍</span>
            <span>Ubicación: {obra.ubicacion_faena}</span>
          </div>
          <div className="detail-item">
            <span>📅</span>
            <span>
              Inicio: {obra.fecha_inicio} | Estimado:{' '}
              {obra.fecha_termino_estimada || 'Pendiente'}
            </span>
          </div>
          {obra.costo_estimado > 0 && (
            <div className="detail-item">
              <span>💰</span>
              <span>Presupuesto: {formatearMonto(obra.costo_estimado)}</span>
            </div>
          )}
        </div>

        {/* Alerta de motivo en caso de suspensión o cancelación */}
        {obra.motivo_suspension_cancelacion && (
          <div className="motivo-alerta">
            ⚠️ <strong>Motivo:</strong> {obra.motivo_suspension_cancelacion}
          </div>
        )}

        {/* Alerta de cierre definitivo en caso de obra finalizada */}
        {obra.fecha_cierre_real && (
          <div className="cierre-alerta">
            ✅ <strong>Cierre real de faena:</strong> {obra.fecha_cierre_real}
          </div>
        )}
      </div>

      {/* Barra inferior de transición de estados operativos */}
      <div className="card-actions">
        {onAsignarTecnico && <button type="button" className="btn-primary" onClick={() => onAsignarTecnico(obra)}>Asignar técnico</button>}
        {transiciones.length > 0 ? (
          transiciones.map((tr) => (
            <button
              key={tr.codigo_estado}
              type="button"
              className={`transicion-btn ${tr.codigo_estado}`}
              onClick={() => onSolicitarTransicion(obra, tr)}
            >
              {tr.accion}
            </button>
          ))
        ) : (
          <span className="no-actions">
            {esTerminal ? 'Estado terminal cerrado (sin más transiciones)' : 'Sin transiciones configuradas'}
          </span>
        )}
      </div>
    </article>
  );
}

