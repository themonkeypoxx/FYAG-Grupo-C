import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dashboardService from '../Servicios/dashboardService';

const formatearCLP = (valor) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);

export default function GraficosFinancieros({ intervaloMs = 20000 }) {
  const [facturacionData, setFacturacionData] = useState({
    evolucion_mensual: [],
    presupuesto_vs_real: [],
  });
  const [morosidadData, setMorosidadData] = useState({
    top_clientes_morosos: [],
    resumen: null,
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [sincronizadoEn, setSincronizadoEn] = useState(null);

  const cargarDatos = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const [resFact, resMor] = await Promise.all([
        dashboardService.getAgregacionFacturacion(),
        dashboardService.getAgregacionMorosidad(),
      ]);
      setFacturacionData(resFact);
      setMorosidadData(resMor);
      setError('');
      setSincronizadoEn(new Date());
    } catch (err) {
      if (!silencioso) {
        setError('No se pudieron cargar los gráficos de agregación financiera.');
      }
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos(false);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarDatos(true);
      }
    }, intervaloMs);
    return () => window.clearInterval(interval);
  }, [cargarDatos, intervaloMs]);

  if (cargando) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Cargando gráficos financieros en tiempo real...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: '#dc2626' }}>
        {error}
      </div>
    );
  }

  return (
    <section
      aria-label="Análisis gráfico financiero y de morosidad"
      style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
          Analítica Financiera y Morosidad en Tiempo Real
        </h2>
        {sincronizadoEn && (
          <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
            ● Actualizado: {sincronizadoEn.toLocaleTimeString('es-CL')}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Gráfico 1: Evolución Mensual Facturado vs Cobrado vs Pendiente */}
        <article
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Facturación vs Cobranza Mensual
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Comparativa agregada por mes de emisión de facturas.
          </p>
          {facturacionData.evolucion_mensual.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Aún no hay facturas registradas para graficar.</p>
          ) : (
            <div style={{ width: '100%', height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={facturacionData.evolucion_mensual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatearCLP(value)} />
                  <Legend />
                  <Bar dataKey="facturado" name="Facturado" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cobrado" name="Cobrado" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendiente" name="Pendiente" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        {/* Gráfico 2: Morosidad por Cliente */}
        <article
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Clientes con Deuda Vencida (Morosidad)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Clientes con facturas vencidas y saldo pendiente de pago.
          </p>
          {morosidadData.top_clientes_morosos.length === 0 ? (
            <p style={{ color: '#16a34a', fontWeight: 600 }}>
              Sin clientes morosos a la fecha.
            </p>
          ) : (
            <div style={{ width: '100%', height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={morosidadData.top_clientes_morosos}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="cliente" width={120} />
                  <Tooltip formatter={(value) => formatearCLP(value)} />
                  <Legend />
                  <Bar dataKey="deuda_vencida" name="Deuda Vencida" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        {/* Gráfico 3: Presupuesto Estimado vs Costo Real por Tipo de Servicio */}
        <article
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Costo Estimado vs Real por Servicio
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Desviación presupuestaria agrupada por tipo de servicio.
          </p>
          {facturacionData.presupuesto_vs_real.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No hay obras registradas por servicio.</p>
          ) : (
            <div style={{ width: '100%', height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={facturacionData.presupuesto_vs_real}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="servicio" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value) => formatearCLP(value)} />
                  <Legend />
                  <Bar dataKey="costo_estimado" name="Estimado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costo_real" name="Costo Real" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}