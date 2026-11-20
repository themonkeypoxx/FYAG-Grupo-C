import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import authService from '../Servicios/authService';

export default function ObraCard({ obra, onSolicitarTransicion, onAsignarTecnico, onDesasignarTecnico, onEditarObra, onGestionarMateriales }) {
  const transiciones = obra.transiciones_posibles || [];
  const tecnicosAsignados = obra.tecnicos_asignados || [];
  const esTerminal = ['FINALIZADA', 'CANCELADA'].includes(obra.estado_obra_codigo);
  const puedePresupuestar = authService.tieneRol('Gerencial', 'Supervisor', 'Administrativo');

  // Formato para técnicos asignados
  const formatear = (a) =>
    `${a.fecha} · ${a.hora_inicio?.slice(0, 5)}–${a.hora_termino?.slice(0, 5)}`;

  // Agrupación por técnico
  const resumenPorTecnico = useMemo(() => {
    const grupos = {};
    tecnicosAsignados.forEach((a) => {
      const clave = a.tecnico;
      if (!grupos[clave]) grupos[clave] = { nombre: a.tecnico_nombre, asignaciones: [] };
      grupos[clave].asignaciones.push(a);
    });

    return Object.entries(grupos).map(([tecnicoId, grupo]) => {
      const { nombre, asignaciones } = grupo;
      const ordenadas = [...asignaciones].sort((a, b) =>
        `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`)
      );
      return {
        tecnicoId,
        nombre,
        primera: ordenadas[0],
        ultima: ordenadas[ordenadas.length - 1],
        total: ordenadas.length,
      };
    });
  }, [tecnicosAsignados]);

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

        {/* Técnicos asignados */}
        <div className="tecnicos-asignados">
          <strong>Técnicos asignados</strong>
          {resumenPorTecnico.length > 0 ? (
            <ul>
              {resumenPorTecnico.map((t) => (
                <li key={t.nombre} className="tecnico-item">
                  <span>
                    {t.nombre} <small>({t.total} {t.total === 1 ? 'día' : 'días'})</small>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                    <small>
                      {t.total === 1
                        ? formatear(t.primera)
                        : `${t.primera.fecha} → ${t.ultima.fecha}`}
                    </small>
                    {onDesasignarTecnico && (
                      <button type="button" className="btn-secondary" onClick={() => onDesasignarTecnico(obra, t.tecnicoId, t.nombre)}>
                        Desasignar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <span className="sin-tecnicos">Sin técnicos asignados</span>
          )}
        </div>

        {/* Maquinarias asignadas (MongoDB) */}
        <div className="tecnicos-asignados" style={{ marginTop: '0.75rem' }}>
          <strong>🚜 Maquinarias asignadas</strong>
          {obra.maquinarias_asignadas && obra.maquinarias_asignadas.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
              {obra.maquinarias_asignadas.map((m) => (
                <span
                  key={m.codigo}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                    color: 'var(--primary, #2563eb)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  title={`Código: ${m.codigo} · Tipo: ${m.tipo || ''}${m.patente ? ' · Patente: ' + m.patente : ''}`}
                >
                  ⚙️ <strong>{m.codigo}:</strong> {m.nombre}
                </span>
              ))}
            </div>
          ) : (
            <span className="sin-tecnicos">Sin maquinarias asignadas</span>
          )}
        </div>

        {/* Alerta de motivo en caso de suspensión o cancelación */}
                {/* Materiales asignados */}
        <div className="tecnicos-asignados" style={{ marginTop: '0.75rem' }}>
          <strong>📦 Materiales asignados</strong>
          {obra.materiales_asignados && obra.materiales_asignados.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                {obra.materiales_asignados.map((m) => (
                  <span
                    key={m.id_asignacion_material}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      color: '#047857',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                    title={`${m.material_codigo} · ${formatearMonto(m.precio_unitario)} por ${m.unidad_medida}`}
                  >
                    <strong>{Number(m.cantidad)} {m.unidad_medida}</strong> {m.material_nombre}
                  </span>
                ))}
              </div>
              <small style={{ display: 'block', marginTop: '0.4rem', color: 'var(--text-muted)' }}>
                Costo en materiales: {formatearMonto(obra.costo_materiales)}
              </small>
            </>
          ) : (
            <span className="sin-tecnicos">Sin materiales asignados</span>
          )}
        </div>
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

      {/* Barra inferior de transición de estados operativos y acciones */}
      <div className="card-actions">
        {onEditarObra && (
          <button type="button" className="btn-secondary" onClick={() => onEditarObra(obra)}>
            Editar detalles
          </button>
        )}
        {onAsignarTecnico && (
          <button type="button" className="btn-primary" onClick={() => onAsignarTecnico(obra)}>
            Asignar técnico
          </button>
        )}
        {onGestionarMateriales && (
          <button type="button" className="btn-secondary" onClick={() => onGestionarMateriales(obra)}>
            📦 Materiales
          </button>
        )}
        {!esTerminal && puedePresupuestar && (
          <Link
            to="/nuevo-presupuesto"
            state={{ obraId: obra.id_obra }}
            className="transicion-btn"
            style={{
              textDecoration: 'none',
              background: '#eff6ff',
              color: '#1d4ed8',
              borderColor: '#bfdbfe',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            💰 + Presupuesto
          </Link>
        )}
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
