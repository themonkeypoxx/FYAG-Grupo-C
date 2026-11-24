import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import presupuestosService from '../Servicios/presupuestosService';
import obrasService from '../Servicios/obrasService';
import usuariosService from '../Servicios/usuariosService';
import authService from '../Servicios/authService';

export default function NuevoPresupuesto() {
  const navigate = useNavigate();
  const location = useLocation();

  // El Administrativo vuelve a su panel y el resto al dashboard de obras.
  const rutaVolver = authService.tieneRol('Administrativo') && !authService.tieneRol('Gerencial')
    ? '/vista-administrativo'
    : '/dashboard-obras';

  const [clientes, setClientes] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [formData, setFormData] = useState({
    cliente: '',
    nombre_proyecto: '',
    tipo_servicio: '',
    ubicacion_faena: '',
    fecha_estimada_inicio: '',
    fecha_estimada_termino: '',
    supervisor_asignado: '',
    numero_presupuesto: '',
    subtotal: '',
    estado_presupuesto: 'Pendiente_Aprobacion',
  });

  const [calculos, setCalculos] = useState({
    iva: 0,
    total: 0,
  });

  // Cargar catálogos iniciales: Clientes activos, Tipos de servicio y Supervisores
  useEffect(() => {
    async function cargarCatalogos() {
      try {
        setCargandoCatalogos(true);
        setError(null);

        const [clientesData, tiposData, usuariosData] = await Promise.all([
          obrasService.getClientes(),
          obrasService.getTiposServicio(),
          usuariosService.listar().catch(() => []),
        ]);

        // Filtrar clientes activos
        const clientesActivos = (clientesData || []).filter(
          (c) => !c.soft_deleted && (c.estado_cliente === 'Activo' || !c.estado_cliente)
        );
        setClientes(clientesActivos);

        setTiposServicio(tiposData || []);

        // Filtrar usuarios con rol Supervisor
        const listaSupervisores = (usuariosData || []).filter((u) => {
          const roles = Array.isArray(u.roles) ? u.roles.map((r) => String(r).toUpperCase()) : [];
          return roles.includes('SUPERVISOR') || String(u.rol).toUpperCase() === 'SUPERVISOR';
        });
        setSupervisores(listaSupervisores.length > 0 ? listaSupervisores : usuariosData || []);

        // Preseleccionar primer cliente si está disponible
        if (clientesActivos.length > 0) {
          const primerCliente = clientesActivos[0];
          setFormData((prev) => ({
            ...prev,
            cliente: primerCliente.id_cliente,
            tipo_servicio: tiposData?.[0]?.id_tipo_servicio || '',
          }));
          setClienteSeleccionado(primerCliente);
        }
      } catch (err) {
        console.error('Error al cargar catálogos para presupuesto:', err);
        setError('No se pudieron cargar los datos necesarios desde el servidor.');
      } finally {
        setCargandoCatalogos(false);
      }
    }

    cargarCatalogos();
  }, []);

  // Manejo de selección de Cliente
  const handleClienteChange = (e) => {
    const clienteId = e.target.value;
    const cliente = clientes.find((c) => String(c.id_cliente) === String(clienteId)) || null;
    setFormData((prev) => ({ ...prev, cliente: clienteId }));
    setClienteSeleccionado(cliente);
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
    if (!formData.cliente) {
      setError('Debe seleccionar un cliente activo.');
      return;
    }

    if (!formData.nombre_proyecto.trim()) {
      setError('Debe ingresar el nombre del proyecto u obra a presupuestar.');
      return;
    }

    if (!formData.subtotal || parseFloat(formData.subtotal) <= 0) {
      setError('Debe ingresar un monto subtotal válido mayor a 0.');
      return;
    }

    try {
      setGuardando(true);
      setError(null);

      const payload = {
        cliente: formData.cliente,
        nombre_proyecto: formData.nombre_proyecto.trim(),
        tipo_servicio: formData.tipo_servicio || null,
        ubicacion_faena: formData.ubicacion_faena.trim(),
        fecha_estimada_inicio: formData.fecha_estimada_inicio || null,
        fecha_estimada_termino: formData.fecha_estimada_termino || null,
        supervisor_asignado: formData.supervisor_asignado || null,
        subtotal: formData.subtotal,
        estado_presupuesto: formData.estado_presupuesto,
      };

      if (formData.numero_presupuesto.trim()) {
        payload.numero_presupuesto = formData.numero_presupuesto.trim();
      }

      const respuesta = await presupuestosService.crearPresupuesto(payload);

      navigate(rutaVolver, {
        state: {
          notificacion: {
            tipo: 'exito',
            mensaje: `Presupuesto '${respuesta.numero_presupuesto}' creado exitosamente. Se notificó a Gerencia para su aprobación.`,
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
      <div className="form-card" style={{ maxWidth: '820px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2>Registrar Nuevo Presupuesto</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '-0.5rem' }}>
              El presupuesto será enviado a Gerencia para su aprobación antes de generar la Obra y habilitar su facturación.
            </p>
          </div>
          <Link to={rutaVolver} className="btn-secondary" style={{ textDecoration: 'none' }}>
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

        {cargandoCatalogos ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Cargando información del sistema...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              No existen clientes activos registrados para generar presupuestos.
            </p>
            <Link to="/panel-administrativo" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
              Ir a Administración de Clientes
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Sección 1: Cliente y Datos del Proyecto */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                1. Cliente y Datos del Proyecto
              </h3>

              <div className="form-group">
                <label htmlFor="cliente">
                  Cliente <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  id="cliente"
                  name="cliente"
                  className="form-control"
                  value={formData.cliente}
                  onChange={handleClienteChange}
                  required
                >
                  {clientes.map((c) => (
                    <option key={c.id_cliente} value={c.id_cliente}>
                      {c.razon_social} — RUT: {c.rut_empresa}
                    </option>
                  ))}
                </select>
              </div>

              {clienteSeleccionado && (
                <div
                  style={{
                    background: 'var(--bg, #f8fafc)',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '0.85rem 1rem',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <strong>🏢 {clienteSeleccionado.razon_social}</strong> · RUT: {clienteSeleccionado.rut_empresa}
                  {clienteSeleccionado.direccion && <span> · Dirección: {clienteSeleccionado.direccion}</span>}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="nombre_proyecto">
                  Nombre del Proyecto / Trabajo <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  id="nombre_proyecto"
                  name="nombre_proyecto"
                  className="form-control"
                  placeholder="Ej: Mantención Preventiva Climatización Edificio Corporativo"
                  value={formData.nombre_proyecto}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="tipo_servicio">
                    Tipo de Servicio <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    id="tipo_servicio"
                    name="tipo_servicio"
                    className="form-control"
                    value={formData.tipo_servicio}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Seleccione tipo de servicio</option>
                    {tiposServicio.map((t) => (
                      <option key={t.id_tipo_servicio} value={t.id_tipo_servicio}>
                        {t.nombre_servicio} ({t.codigo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ubicacion_faena">Ubicación / Dirección de la Faena</label>
                  <input
                    type="text"
                    id="ubicacion_faena"
                    name="ubicacion_faena"
                    className="form-control"
                    placeholder="Ej: Av. Las Condes 1234, Santiago"
                    value={formData.ubicacion_faena}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Sección 2: Planificación y Supervisión */}
            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                2. Planificación y Supervisión (Preliminar)
              </h3>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="fecha_estimada_inicio">Fecha Estimada de Inicio</label>
                  <input
                    type="date"
                    id="fecha_estimada_inicio"
                    name="fecha_estimada_inicio"
                    className="form-control"
                    value={formData.fecha_estimada_inicio}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fecha_estimada_termino">Fecha Estimada de Término</label>
                  <input
                    type="date"
                    id="fecha_estimada_termino"
                    name="fecha_estimada_termino"
                    className="form-control"
                    value={formData.fecha_estimada_termino}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="supervisor_asignado">Supervisor a Cargo (Opcional)</label>
                <select
                  id="supervisor_asignado"
                  name="supervisor_asignado"
                  className="form-control"
                  value={formData.supervisor_asignado}
                  onChange={handleChange}
                >
                  <option value="">Seleccionar Supervisor (opcional)</option>
                  {supervisores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name || s.last_name
                        ? `${s.first_name} ${s.last_name} (${s.username})`
                        : s.username}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Si no se especifica, el supervisor se asignará al momento de la aprobación.
                </span>
              </div>
            </div>

            {/* Sección 3: Costos y Estado del Presupuesto */}
            <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>
                3. Costos y Formalización
              </h3>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="numero_presupuesto">Número de Presupuesto (Opcional)</label>
                  <input
                    type="text"
                    id="numero_presupuesto"
                    name="numero_presupuesto"
                    className="form-control"
                    placeholder="Autogenerado ej: PRE-2026-XXXX"
                    value={formData.numero_presupuesto}
                    onChange={handleChange}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Dejar en blanco para correlativo automático único.
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="estado_presupuesto">Estado Inicial</label>
                  <select
                    id="estado_presupuesto"
                    name="estado_presupuesto"
                    className="form-control"
                    value={formData.estado_presupuesto}
                    onChange={handleChange}
                  >
                    <option value="Pendiente_Aprobacion">Pendiente de Aprobación (Enviar a Gerencia)</option>
                    <option value="Borrador">Borrador</option>
                  </select>
                </div>
              </div>

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

              {/* Resumen de Liquidación */}
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
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <Link to={rutaVolver} className="btn-secondary" style={{ textDecoration: 'none' }}>
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
