import React, { useState, useEffect } from 'react';
import obrasService from '../Servicios/obrasService';

const COLORES_ESTADO = {
  PENDIENTE: '#737373',
  EJECUCION: '#0284c7',
  SUSPENDIDA: '#f97316',
  FINALIZADA: '#16a34a',
  CANCELADA: '#dc2626',
};

export default function GraficoDashObras() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function cargarResumen() {
      try {
        const res = await obrasService.getResumenEstados();
        setDatos(res || []);
      } catch (err) {
        console.error('Error al cargar resumen de estados:', err);
      } finally {
        setCargando(false);
      }
    }
    cargarResumen();
  }, []);

  if (cargando) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Cargando métricas...</div>;
  }

  const total = datos.reduce((acc, curr) => acc + (curr.cantidad_obras || 0), 0);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.75rem',
        margin: '1rem 0',
      }}
    >
      {datos.map((item) => {
        const color = COLORES_ESTADO[item.codigo_estado] || '#64748b';
        return (
          <div
            key={item.id_estado_obra || item.codigo_estado}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem',
              textAlign: 'center',
              borderTop: `4px solid ${color}`,
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {item.descripcion}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '0.2rem' }}>
              {item.cantidad_obras}
            </div>
            <div style={{ fontSize: '0.75rem', color: color, fontWeight: 600 }}>
              {item.porcentaje}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
