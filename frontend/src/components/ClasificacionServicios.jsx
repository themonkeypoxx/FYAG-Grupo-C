import React from 'react';

// Los 6 tipos de servicio de FYAG
const SERVICIOS_INFO = [
  { codigo: 'TODOS', nombre: 'Todos los Servicios', icon: '📋' },
  { codigo: 'MANTENCION', nombre: 'Mantención', icon: '🔧' },
  { codigo: 'CLIMATIZACION', nombre: 'Climatización', icon: '❄️' },
  { codigo: 'PROY_ELECTRICO', nombre: 'Proyecto eléctrico', icon: '⚡' },
  { codigo: 'EMERGENCIA', nombre: 'Emergencia', icon: '🚨' },
  { codigo: 'GARANTIA', nombre: 'Garantía', icon: '🛡️' },
  { codigo: 'PROYECTO', nombre: 'Proyecto', icon: '🏗️' },
];

export default function ClasificacionServicios({
  tipoSeleccionado,
  onSeleccionarTipo,
  conteoPorTipo = {},
  totalObras = 0,
}) {
  return (
    <section className="servicios-bar">
      <div className="servicios-header">
        <h2>Clasificación por Tipo de Servicio</h2>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Total en sistema: <strong>{totalObras}</strong> {totalObras === 1 ? 'obra' : 'obras'}
        </span>
      </div>

      <div className="servicios-chips">
        {SERVICIOS_INFO.map((srv) => {
          const isActive = tipoSeleccionado === srv.codigo;
          const count =
            srv.codigo === 'TODOS'
              ? totalObras
              : conteoPorTipo[srv.codigo] || 0;

          return (
            <button
              key={srv.codigo}
              type="button"
              className={`chip-servicio ${isActive ? 'active' : ''}`}
              onClick={() => onSeleccionarTipo(srv.codigo)}
            >
              <span>{srv.icon}</span>
              <span>{srv.nombre}</span>
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

