import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import presupuestosService from '../Servicios/presupuestosService';

export default function NuevoPresupuesto() {
  const navigate = useNavigate();
  const location = useLocation();

  const [obrasActivas, setObrasActivas] = useState([]);
  const [cargandoObras, setCargandoObras] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [obraSeleccionada, setObraSeleccionada] = useState(null);
  const [formData, setFormData] = useState({
    obra: '',
    numero_presupuesto: '',
    subtotal: '',
    estado_presupuesto: 'Borrador',
  });

  const [calculos, setCalculos] = useState({
    iva: 0,
    total: 0,
  });

  // Cargar proyectos (obras) activos
  useEffect(() => {
    async function cargarObras() {
      try {
        setCargandoObras(true);
        const data = await presupuestosService.getObrasActivas();
        setObrasActivas(data);

        // Preseleccionar obra si vino por navegación o primera disponible
        const obraPreviaId = location.state?.obraId;
        const encontrada = data.find((o) => o.id_obra === obraPreviaId) || data[0];

        if (encontrada) {
          setFormData((prev) => ({ ...prev, obra: encontrada.id_obra }));
          setObraSeleccionada(encontrada);
        }
      } catch (err) {
        console.error('Error al cargar obras activas:', err);
        setError('No se pudieron cargar los proyectos activos del servidor.');
      } finally {
        setCargandoObras(false);
      }
    }
    cargarObras();
  }, [location.state]);

  // Actualizar obra seleccionada y validar cliente vinculado
  const handleObraChange = (e) => {
    const obraId = e.target.value;
    const obra = obrasActivas.find((o) => o.id_obra === obraId) || null;
    setFormData((prev) => ({ ...prev, obra: obraId }));
    setObraSeleccionada(obra);
    setError(null);
  };

  // Recalcular IVA y Total automáticamente según subtotal
  const handleSubtotalChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, subtotal: val }));

    const sub = parseFloat(val);
    if (!isNaN(sub) && sub >= 0) {
      const ivaCalc = Math.round(sub * 0.19);
      const totalCalc = sub + ivaCalc;
      setCalculos({ iva: ivaCalc, total: totalCalc });
    } else {
      setCalculos({ iva: 0, total: 0 });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Formato chileno de moneda
  const formatearCLP = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(monto || 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.obra) {
      setError('Debe seleccionar un proyecto u obra activa.');
      return;
    }

    if (!formData.subtotal || parseFloat(formData.subtotal) <= 0) {
      setError('Debe ingresar un subtotal válido mayor a 0.');
      return;
    }

    try {
      setGuardando(true);
      setError(null);

      const payload = {
        obra: formData.obra,
        subtotal: formData.subtotal,
        estado_presupuesto: formData.estado_presupuesto,
      };

      if (formData.numero_presupuesto.trim()) {
        payload.numero_presupuesto = formData.numero_presupuesto.trim();
      }

      const respuesta = await presupuestosService.crearPresupuesto(payload);

      navigate('/dashboard', {
        state: {
          notificacion: {
            tipo: 'exito',
            mensaje: `Presupuesto '${respuesta.numero_presupuesto}' registrado exitosamente para el cliente ${respuesta.cliente_razon_social || ''}.`,
          },
        },
      });
    } catch (err) {
      console.error('Error al registrar presupuesto:', err);
      const dataErr = err.response?.data;
      if (dataErr) {
        if (typeof dataErr === 'object') {
          const mensajes = Object.entries(dataErr)
            .map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
            .join(' | ');
          setError(mensajes);
        } else {
          setError(String(dataErr));
        }
      } else {
        setError('Ocurrió un error al registrar el presupuesto. Verifique la conexión.');
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="main-content">
      <div className="form-card" style={{ maxWidth: '780px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2>Registrar Nuevo Presupuesto</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '-0.75rem' }}>
              Vinculación de presupuesto formal a cliente y proyecto activo
            </p>
          </div>
          <Link to="/dashboard" className="btn-secondary" style={{ textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #f87171',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              fontSize: '0.9rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {cargandoObras ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Cargando proyectos activos...</p>
          </div>
        ) : obrasActivas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              No hay proyectos activos disponibles para presupuestar actualmente.
            </p>
            <Link to="/nueva-obra" className="btn-primary" style={{ marginTop: '1rem' }}>
              + Crear Nueva Obra
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Selección de Proyecto Activo */}
            <div className="form-group">
              <label htmlFor="obra">
                Proyecto Activo <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                id="obra"
                name="obra"
                className="form-control"
                value={formData.obra}
                onChange={handleObraChange}
                required
              >
                {obrasActivas.map((obra) => (
                  <option key={obra.id_obra} value={obra.id_obra}>
                    {obra.codigo_obra} — {obra.nombre_obra} ({obra.estado_obra_descripcion || obra.estado_obra_codigo})
                  </option>
                ))}
              </select>
            </div>

            {/* Tarjeta Informativa del Cliente Vinculado */}
            {obraSeleccionada && (
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Cliente Vinculado al Proyecto
                    </span>
                    <h4 style={{ margin: '0.25rem 0 0 0', color: 'var(--text-main)', fontSize: '1rem' }}>
                      🏢 {obraSeleccionada.cliente_razon_social || 'Cliente no identificado'}
                    </h4>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      RUT: {obraSeleccionada.cliente_rut || 'Sin RUT'}
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      ● Proyecto Activo
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="form-grid">
              {/* Número de Presupuesto */}
              <div className="form-group">
                <label htmlFor="numero_presupuesto">Número de Presupuesto (Opcional)</label>
                <input
                  type="text"
                  id="numero_presupuesto"
                  name="numero_presupuesto"
                  className="form-control"
                  placeholder="Autogenerado ej: PRE-OBRA-XXXX"
                  value={formData.numero_presupuesto}
                  onChange={handleChange}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Dejar en blanco para asignación automática única.
                </span>
              </div>

              {/* Estado del Presupuesto */}
              <div className="form-group">
                <label htmlFor="estado_presupuesto">Estado Inicial</label>
                <select
                  id="estado_presupuesto"
                  name="estado_presupuesto"
                  className="form-control"
                  value={formData.estado_presupuesto}
                  onChange={handleChange}
                >
                  <option value="Borrador">Borrador</option>
                  <option value="Pendiente_Aprobacion">Pendiente de Aprobación</option>
                </select>
              </div>
            </div>

            {/* Subtotal y Cálculo de IVA / Total */}
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label htmlFor="subtotal">
                Monto Subtotal ($ CLP, Neto sin IVA) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                id="subtotal"
                name="subtotal"
                className="form-control"
                placeholder="Ej: 1500000"
                min="1"
                step="1"
                value={formData.subtotal}
                onChange={handleSubtotalChange}
                required
              />
            </div>

            {/* Resumen de Valores Financieros */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                margin: '1.25rem 0',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#334155' }}>
                Resumen de Liquidación
              </h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>Subtotal Neto:</span>
                <strong style={{ color: '#0f172a' }}>{formatearCLP(formData.subtotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                <span style={{ color: '#64748b' }}>IVA (19%):</span>
                <strong style={{ color: '#0f172a' }}>{formatearCLP(calculos.iva)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.05rem',
                  borderTop: '1px solid #cbd5e1',
                  paddingTop: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                <span style={{ fontWeight: 700, color: '#1e293b' }}>Total Presupuesto:</span>
                <strong style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  {formatearCLP(calculos.total)}
                </strong>
              </div>
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Link to="/dashboard" className="btn-secondary" style={{ textDecoration: 'none' }}>
                Cancelar
              </Link>
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? 'Registrando...' : '✓ Registrar Presupuesto'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
