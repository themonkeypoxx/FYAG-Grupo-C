import React, { useState, useEffect } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
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
  const [error, setError] = useState(false);

  useEffect(() => {
    async function cargarResumen() {
      try {
        const res = await obrasService.getResumenEstados();
        // El endpoint entrega { total_obras, estados }, aunque otros
        // consumidores puedan entregar directamente una lista.
        const estados = Array.isArray(res) ? res : res?.estados;
        setDatos(Array.isArray(estados) ? estados : []);
      } catch (err) {
        console.error('Error al cargar resumen de estados:', err);
        setDatos([]);
        setError(true);
      } finally {
        setCargando(false);
      }
    }
    cargarResumen();
  }, []);

  if (cargando) {
    return <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Cargando métricas...</div>;
  }

  if (error) {
    return <p role="alert" style={{ color: 'var(--text-muted)' }}>No se pudo cargar el resumen de obras por estado.</p>;
  }

  const lista = datos;
  if (lista.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No hay datos de obras por estado para mostrar.</p>;
  }

  const datosGrafico = lista.map((item) => ({
    ...item,
    cantidad_obras: Number(item.cantidad_obras) || 0,
  }));

  return (
    <div style={{ width: '100%', height: 320, margin: '1rem 0' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datosGrafico}
            dataKey="cantidad_obras"
            nameKey="descripcion"
            cx="50%"
            cy="50%"
            outerRadius="75%"
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            labelLine
          >
            {datosGrafico.map((item) => (
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
    </div>
  );
}
