import React, { useState, useEffect, useCallback } from 'react';
import {Bar,BarChart,CartesianGrid, Cell,Legend,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis,} from 'recharts';
import obrasService from '../Servicios/obrasService';
import dashboardService from '../Servicios/dashboardService';

const COLORES_ESTADO = {
  PENDIENTE: '#737373',
  EJECUCION: '#0284c7',
  SUSPENDIDA: '#f97316',
  FINALIZADA: '#16a34a',
  CANCELADA: '#dc2626',
};

const COLORES_MAQUINARIA = {
  DISPONIBLE: '#16a34a',
  ASIGNADA: '#2563eb',
};

export default function GraficoDashObras({ intervaloMs = 15000 }) {
  const [datosEstados, setDatosEstados] = useState([]);
  const [datosMongo, setDatosMongo] = useState({
    maquinarias_por_estado: [],
    actividad_reciente_24h: [],
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargarMetricas = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const [resEstados, resMongo] = await Promise.all([
        obrasService.getResumenEstados(),
        dashboardService.getAgregacionMongo().catch(() => ({
          maquinarias_por_estado: [],
          actividad_reciente_24h: [],
        })),
      ]);

      const estados = Array.isArray(resEstados) ? resEstados : resEstados?.estados;
      setDatosEstados(Array.isArray(estados) ? estados : []);
      setDatosMongo(resMongo);
      setError(false);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error('Error al cargar métricas en tiempo real:', err);
      if (!silencioso) setError(true);
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarMetricas(false);

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarMetricas(true);
      }
    }, intervaloMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') cargarMetricas(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cargarMetricas, intervaloMs]);

  if (cargando) {
    return (
      <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>
        Cargando métricas en tiempo real...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem' }}>
        <p role="alert" style={{ color: 'var(--estado-cancelada)', marginBottom: '0.5rem' }}>
          No se pudo cargar el resumen de obras por estado.
        </p>
        <button type="button" className="btn-secondary" onClick={() => cargarMetricas(false)}>
          Reintentar
        </button>
      </div>
    );
  }

  const datosGraficoEstados = datosEstados.map((item) => ({
    ...item,
    cantidad_obras: Number(item.cantidad_obras) || 0,
  }));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 600,
            color: '#16a34a',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#16a34a',
              display: 'inline-block',
            }}
          />
          En tiempo real (actualización cada {intervaloMs / 1000}s)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {ultimaActualizacion && (
            <span>Última sincronización: {ultimaActualizacion.toLocaleTimeString('es-CL')}</span>
          )}
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
            onClick={() => cargarMetricas(true)}
          >
            Refrescar
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Gráfico 1: Distribución de Obras por Estado */}
        <div style={{ width: '100%', height: 310 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Distribución de Obras
          </h3>
          {datosGraficoEstados.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No hay datos de obras por estado.</p>
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={datosGraficoEstados}
                  dataKey="cantidad_obras"
                  nameKey="descripcion"
                  cx="50%"
                  cy="50%"
                  outerRadius="72%"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine
                >
                  {datosGraficoEstados.map((item) => (
                    <Cell
                      key={item.id_estado_obra || item.codigo_estado}
                      fill={COLORES_ESTADO[item.codigo_estado] || '#64748b'}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(cantidad) => [`${cantidad} obras`, 'Cantidad']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico 2: Agregación MongoDB - Maquinarias por Estado */}
        <div style={{ width: '100%', height: 310 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Estado de Maquinarias (MongoDB)
          </h3>
          {datosMongo.maquinarias_por_estado.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Sin registros de maquinarias en MongoDB.</p>
          ) : (
            <ResponsiveContainer width="100%" height="90%">
              <BarChart
                data={datosMongo.maquinarias_por_estado}
                margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="estado" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(val) => [`${val} equipos`, 'Cantidad']} />
                <Bar dataKey="cantidad" name="Equipos" radius={[6, 6, 0, 0]}>
                  {datosMongo.maquinarias_por_estado.map((entry) => (
                    <Cell
                      key={entry.estado}
                      fill={COLORES_MAQUINARIA[entry.estado] || '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}