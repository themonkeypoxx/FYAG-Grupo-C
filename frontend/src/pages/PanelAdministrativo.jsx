import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../Servicios/api';
import authService from '../Servicios/authService';
import presupuestosService from '../Servicios/presupuestosService';

import ModalNuevaFactura from '../components/ModalNuevaFactura';
import ModalRegistrarPago from '../components/ModalRegistrarPago';
import ModalExportarPDF from '../components/ModalExportarPDF';
import ModalCambioEstadoPago from '../components/ModalCambioEstadoPago';

import './PanelAdministrativo.css';

// Formato de moneda CLP
const formatearCLP = (monto) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto || 0);
};

// Badges de estado de factura
const BADGES_PAGO = {
  Pendiente: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  'Pago Parcial': { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Pagado: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
};

export default function PanelAdministrativo() {
  const navigate = useNavigate();
  const location = useLocation();

  const esGerencial = authService.tieneRol('Gerencial');

  // Pestañas y Alertas
  const [notificacion, setNotificacion] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState('clientes'); // 'clientes' | 'facturas' | 'presupuestos'

  // Modales
  const [modalPDF, setModalPDF] = useState(false);
  const [tipoPDF, setTipoPDF] = useState('presupuesto'); // 'presupuesto' | 'factura'
  const [modalNuevaFactura, setModalNuevaFactura] = useState(false);
  const [presupuestoSeleccionadoId, setPresupuestoSeleccionadoId] = useState('');
  const [modalPago, setModalPago] = useState(null); // Factura seleccionada
  const [modalCambioEstado, setModalCambioEstado] = useState(null);

  // Clientes
  const [clientes, setClientes] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [mensajeCliente, setMensajeCliente] = useState(null);
  const [nuevoCliente, setNuevoCliente] = useState({
    rut_empresa: '',
    razon_social: '',
    giro_comercial: '',
    direccion_matriz: '',
    comuna: '',
    ciudad: '',
    contacto_nombre: '',
    contacto_telefono: '',
    contacto_email: '',
    estado_cliente: 'Activo',
  });

  // Facturas
  const [facturas, setFacturas] = useState([]);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('TODOS');
  const [busquedaFactura, setBusquedaFactura] = useState('');

  // Presupuestos
  const [presupuestos, setPresupuestos] = useState([]);
  const [cargandoPresupuestos, setCargandoPresupuestos] = useState(false);
  const [presupuestosDisponibles, setPresupuestosDisponibles] = useState([]);
  const [procesandoPresupuestoId, setProcesandoPresupuestoId] = useState(null);

  // -------------------------------------------------------------
  // CARGA DE DATOS
  // -------------------------------------------------------------
  const cargarClientes = async () => {
    setCargandoClientes(true);
    try {
      const res = await api.get('/obras/fyag/v1/clientes/');
      setClientes(res.data);
    } catch (err) {
      console.error('Error cargando clientes:', err);
    } finally {
      setCargandoClientes(false);
    }
  };

  const cargarFacturas = async () => {
    setCargandoFacturas(true);
    try {
      const res = await api.get('/obras/fyag/v1/facturas/');
      setFacturas(res.data);
    } catch (err) {
      console.error('Error cargando facturas:', err);
    } finally {
      setCargandoFacturas(false);
    }
  };

  const cargarPresupuestos = async () => {
    setCargandoPresupuestos(true);
    try {
      const res = await api.get('/obras/fyag/v1/presupuestos/');
      setPresupuestos(res.data);
      setPresupuestosDisponibles(res.data);
    } catch (err) {
      console.error('Error cargando presupuestos:', err);
    } finally {
      setCargandoPresupuestos(false);
    }
  };

  useEffect(() => {
    cargarClientes();
    cargarFacturas();
    cargarPresupuestos();
  }, []);

  // Notificación entrante por navegación
  useEffect(() => {
    const notificacionRecibida = location.state?.notificacion;
    if (!notificacionRecibida) return;
    setNotificacion(notificacionRecibida);
    setPestanaActiva('presupuestos');
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!notificacion) return;
    const timer = setTimeout(() => setNotificacion(null), 5000);
    return () => clearTimeout(timer);
  }, [notificacion]);

  // -------------------------------------------------------------
  // HANDLERS: Clientes
  // -------------------------------------------------------------
  const handleClienteChange = (e) => {
    const { name, value } = e.target;
    setNuevoCliente((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitCliente = async (e) => {
    e.preventDefault();
    setGuardandoCliente(true);
    setMensajeCliente(null);
    try {
      await api.post('/obras/fyag/v1/clientes/', nuevoCliente);
      setMensajeCliente({ tipo: 'exito', texto: '¡Cliente registrado con éxito!' });
      setNuevoCliente({
        rut_empresa: '',
        razon_social: '',
        giro_comercial: '',
        direccion_matriz: '',
        comuna: '',
        ciudad: '',
        contacto_nombre: '',
        contacto_telefono: '',
        contacto_email: '',
        estado_cliente: 'Activo',
      });
      cargarClientes();
    } catch (err) {
      const dataErr = err.response?.data;
      const detalle = dataErr
        ? Object.entries(dataErr)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ')
        : 'Error al registrar el cliente.';
      setMensajeCliente({ tipo: 'error', texto: detalle });
    } finally {
      setGuardandoCliente(false);
    }
  };

  // -------------------------------------------------------------
  // HANDLERS: Aprobación y Rechazo de Presupuestos (Gerencia)
  // -------------------------------------------------------------
  const handleAprobarPresupuesto = async (idPresupuesto, numero) => {
    if (!window.confirm(`¿Confirma que desea APROBAR el presupuesto '${numero}' como Gerencia?`)) {
      return;
    }
    try {
      setProcesandoPresupuestoId(idPresupuesto);
      await presupuestosService.aprobarPresupuesto(idPresupuesto);
      setNotificacion({
        tipo: 'exito',
        mensaje: `Presupuesto '${numero}' aprobado exitosamente por Gerencia.`,
      });
      await cargarPresupuestos();
    } catch (err) {
      console.error('Error al aprobar presupuesto:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'No se pudo aprobar el presupuesto.';
      setNotificacion({ tipo: 'error', mensaje: errMsg });
    } finally {
      setProcesandoPresupuestoId(null);
    }
  };

  const handleRechazarPresupuesto = async (idPresupuesto, numero) => {
    const motivo = window.prompt(`Ingrese el motivo para RECHAZAR el presupuesto '${numero}':`, '');
    if (motivo === null) return;
    try {
      setProcesandoPresupuestoId(idPresupuesto);
      await presupuestosService.rechazarPresupuesto(idPresupuesto, motivo);
      setNotificacion({
        tipo: 'exito',
        mensaje: `Presupuesto '${numero}' rechazado por Gerencia.`,
      });
      await cargarPresupuestos();
    } catch (err) {
      console.error('Error al rechazar presupuesto:', err);
      const errMsg = err.response?.data?.detail || err.response?.data?.error || 'No se pudo rechazar el presupuesto.';
      setNotificacion({ tipo: 'error', mensaje: errMsg });
    } finally {
      setProcesandoPresupuestoId(null);
    }
  };

  // -------------------------------------------------------------
  // FILTRADO
  // -------------------------------------------------------------
  const clientesFiltrados = clientes.filter((c) => {
    if (!busquedaCliente) return true;
    const term = busquedaCliente.toLowerCase();
    return (
      c.razon_social?.toLowerCase().includes(term) ||
      c.rut_empresa?.toLowerCase().includes(term) ||
      c.ciudad?.toLowerCase().includes(term) ||
      c.contacto_nombre?.toLowerCase().includes(term)
    );
  });

  const facturasFiltradas = facturas.filter((f) => {
    const cumpleEstado = filtroEstadoPago === 'TODOS' || f.estado_pago === filtroEstadoPago;
    if (!cumpleEstado) return false;
    if (!busquedaFactura) return true;
    const term = busquedaFactura.toLowerCase();
    return (
      f.folio_factura?.toLowerCase().includes(term) ||
      f.cliente_razon_social?.toLowerCase().includes(term) ||
      f.cliente_rut?.toLowerCase().includes(term) ||
      f.numero_presupuesto?.toLowerCase().includes(term)
    );
  });

  return (
    <main className="main-content">
      {/* Encabezado Principal */}
      <div className="admin-header">
        <div>
          <h1 className="admin-header-title">Panel Administrativo</h1>
          <p className="admin-header-subtitle">
            Gestión de clientes, emisión y control de facturas, y presupuestos.
          </p>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            onClick={() => {
              setTipoPDF('presupuesto');
              setModalPDF(true);
            }}
            className="btn-secondary btn-export-pdf"
          >
            📥 Exportar a PDF
          </button>

          <button
            type="button"
            onClick={() => navigate('/nuevo-presupuesto')}
            className="btn-primary btn-registrar-presupuesto"
          >
            📄 + Registrar Presupuesto
          </button>
        </div>
      </div>

      {notificacion && (
        <div className={`admin-alert ${notificacion.tipo === 'exito' ? 'admin-alert-exito' : 'admin-alert-error'}`}>
          {notificacion.mensaje}
        </div>
      )}

      {/* Barra de Pestañas */}
      <div className="admin-tabs">
        <button
          type="button"
          onClick={() => setPestanaActiva('clientes')}
          className={`admin-tab ${pestanaActiva === 'clientes' ? 'active' : ''}`}
        >
          👥 Clientes ({clientes.length})
        </button>

        <button
          type="button"
          onClick={() => setPestanaActiva('facturas')}
          className={`admin-tab ${pestanaActiva === 'facturas' ? 'active' : ''}`}
        >
          🧾 Gestión de Facturas ({facturas.length})
        </button>

        <button
          type="button"
          onClick={() => setPestanaActiva('presupuestos')}
          className={`admin-tab ${pestanaActiva === 'presupuestos' ? 'active' : ''}`}
        >
          💰 Presupuestos ({presupuestos.length})
        </button>
      </div>

      {/* ============================================================= */}
      {/* PESTAÑA 1: CLIENTES                                           */}
      {/* ============================================================= */}
      {pestanaActiva === 'clientes' && (
        <div className="admin-clientes-layout">
          {/* Formulario para registrar cliente */}
          <div className="admin-card">
            <h2 className="admin-card-title">👤 Registrar Nuevo Cliente</h2>
            <p className="admin-card-subtitle">
              Ingrese los antecedentes legales y de contacto de la empresa.
            </p>

            {mensajeCliente && (
              <div className={`modal-alert ${mensajeCliente.tipo === 'exito' ? 'modal-alert-success' : 'modal-alert-danger'}`}>
                {mensajeCliente.texto}
              </div>
            )}

            <form onSubmit={handleSubmitCliente}>
              <div className="form-group">
                <label htmlFor="rut_empresa">RUT Empresa *</label>
                <input
                  type="text"
                  id="rut_empresa"
                  name="rut_empresa"
                  className="form-control"
                  placeholder="Ej: 76.123.456-7"
                  value={nuevoCliente.rut_empresa}
                  onChange={handleClienteChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="razon_social">Razón Social *</label>
                <input
                  type="text"
                  id="razon_social"
                  name="razon_social"
                  className="form-control"
                  placeholder="Ej: Agrícola del Valle SpA"
                  value={nuevoCliente.razon_social}
                  onChange={handleClienteChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="giro_comercial">Giro Comercial</label>
                <input
                  type="text"
                  id="giro_comercial"
                  name="giro_comercial"
                  className="form-control"
                  placeholder="Ej: Producción y almacenamiento agrícola"
                  value={nuevoCliente.giro_comercial}
                  onChange={handleClienteChange}
                />
              </div>

              <div className="admin-form-row">
                <div className="form-group">
                  <label htmlFor="ciudad">Ciudad</label>
                  <input
                    type="text"
                    id="ciudad"
                    name="ciudad"
                    className="form-control"
                    placeholder="Chillán"
                    value={nuevoCliente.ciudad}
                    onChange={handleClienteChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="comuna">Comuna</label>
                  <input
                    type="text"
                    id="comuna"
                    name="comuna"
                    className="form-control"
                    placeholder="Chillán Viejo"
                    value={nuevoCliente.comuna}
                    onChange={handleClienteChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="direccion_matriz">Dirección Matriz</label>
                <input
                  type="text"
                  id="direccion_matriz"
                  name="direccion_matriz"
                  className="form-control"
                  placeholder="Av. Principal 123"
                  value={nuevoCliente.direccion_matriz}
                  onChange={handleClienteChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="contacto_nombre">Nombre de Contacto</label>
                <input
                  type="text"
                  id="contacto_nombre"
                  name="contacto_nombre"
                  className="form-control"
                  placeholder="Ej: Juan Pérez"
                  value={nuevoCliente.contacto_nombre}
                  onChange={handleClienteChange}
                />
              </div>

              <div className="admin-form-row">
                <div className="form-group">
                  <label htmlFor="contacto_telefono">Teléfono</label>
                  <input
                    type="tel"
                    id="contacto_telefono"
                    name="contacto_telefono"
                    className="form-control"
                    placeholder="+56 9 1234 5678"
                    value={nuevoCliente.contacto_telefono}
                    onChange={handleClienteChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="contacto_email">Email Contacto</label>
                  <input
                    type="email"
                    id="contacto_email"
                    name="contacto_email"
                    className="form-control"
                    placeholder="contacto@empresa.cl"
                    value={nuevoCliente.contacto_email}
                    onChange={handleClienteChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="estado_cliente">Estado del Cliente</label>
                <select
                  id="estado_cliente"
                  name="estado_cliente"
                  className="form-control"
                  value={nuevoCliente.estado_cliente}
                  onChange={handleClienteChange}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                  <option value="Moroso">Moroso</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
                disabled={guardandoCliente}
              >
                {guardandoCliente ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </form>
          </div>

          {/* Listado de clientes registrados */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h2 className="admin-card-title" style={{ margin: 0 }}>Cartera de Clientes</h2>
                <span className="admin-card-count">{clientesFiltrados.length} clientes encontrados</span>
              </div>
              <input
                type="text"
                placeholder="Buscar por RUT, razón social, ciudad..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                className="form-control admin-search-input"
              />
            </div>

            {cargandoClientes ? (
              <p className="text-muted">Cargando clientes...</p>
            ) : clientesFiltrados.length === 0 ? (
              <p className="text-muted">No se encontraron clientes.</p>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Razón Social</th>
                      <th>RUT</th>
                      <th>Ubicación</th>
                      <th>Contacto</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((c) => (
                      <tr key={c.id_cliente}>
                        <td style={{ fontWeight: 600 }}>
                          {c.razon_social}
                          {c.giro_comercial && (
                            <div className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 400 }}>
                              {c.giro_comercial}
                            </div>
                          )}
                        </td>
                        <td className="admin-table-rut">{c.rut_empresa}</td>
                        <td>
                          {c.ciudad || c.comuna ? `${c.comuna || ''}${c.comuna && c.ciudad ? ', ' : ''}${c.ciudad || ''}` : '—'}
                        </td>
                        <td>
                          {c.contacto_nombre || c.contacto_email || '—'}
                          {c.contacto_telefono && (
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{c.contacto_telefono}</div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge-status ${
                              c.estado_cliente === 'Activo'
                                ? 'badge-cliente-activo'
                                : c.estado_cliente === 'Moroso'
                                  ? 'badge-cliente-moroso'
                                  : 'badge-cliente-inactivo'
                            }`}
                          >
                            ● {c.estado_cliente}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* PESTAÑA 2: GESTIÓN DE FACTURAS                                */}
      {/* ============================================================= */}
      {pestanaActiva === 'facturas' && (
        <div>
          {/* Barra superior de facturas */}
          <div className="admin-filters-bar">
            <div className="admin-filter-group">
              <span className="admin-filter-label">Filtrar por:</span>
              {['TODOS', 'Pendiente', 'Pago Parcial', 'Pagado'].map((est) => (
                <button
                  key={est}
                  type="button"
                  onClick={() => setFiltroEstadoPago(est)}
                  className={`admin-filter-pill ${filtroEstadoPago === est ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {est === 'TODOS' ? 'Todas las facturas' : est}
                </button>
              ))}
            </div>

            <div className="admin-search-container">
              <input
                type="text"
                placeholder="Buscar folio, cliente, RUT..."
                value={busquedaFactura}
                onChange={(e) => setBusquedaFactura(e.target.value)}
                className="form-control"
                style={{ minWidth: '220px' }}
              />

              <button
                type="button"
                onClick={() => {
                  setPresupuestoSeleccionadoId('');
                  setModalNuevaFactura(true);
                }}
                className="btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                + Emitir Factura
              </button>
            </div>
          </div>

          {/* Tabla de Facturas */}
          <div className="admin-card">
            {cargandoFacturas ? (
              <p className="text-muted">Cargando facturas...</p>
            ) : facturasFiltradas.length === 0 ? (
              <div className="admin-empty-state">
                <div className="admin-empty-icon">🧾</div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  No se encontraron facturas
                </h3>
                <p style={{ fontSize: '0.9rem' }}>
                  {busquedaFactura || filtroEstadoPago !== 'TODOS'
                    ? 'Pruebe ajustando los filtros de búsqueda.'
                    : 'Aún no se han emitido facturas. Puede crear la primera haciendo clic en "+ Emitir Factura".'}
                </p>
              </div>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Cliente</th>
                      <th>Presupuesto</th>
                      <th>Emisión / Venc.</th>
                      <th style={{ textAlign: 'right' }}>Monto Total</th>
                      <th style={{ textAlign: 'right' }}>Saldo Pendiente</th>
                      <th style={{ textAlign: 'center' }}>Estado Pago</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFiltradas.map((f) => {
                      const badge = BADGES_PAGO[f.estado_pago] || BADGES_PAGO.Pendiente;
                      return (
                        <tr key={f.id_factura}>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            {f.folio_factura}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{f.cliente_razon_social || 'Cliente'}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{f.cliente_rut}</div>
                          </td>
                          <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                            {f.numero_presupuesto || '—'}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <div>Em: {f.fecha_emision}</div>
                            <div className="text-muted">Venc: {f.fecha_vencimiento}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatearCLP(f.monto_total)}
                          </td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: Number(f.saldo_pendiente) > 0 ? '#dc2626' : '#16a34a',
                            }}
                          >
                            {formatearCLP(f.saldo_pendiente)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="badge-status"
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              ● {f.estado_pago}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="admin-table-actions">
                              {f.estado_pago !== 'Pagado' && (
                                <button
                                  type="button"
                                  onClick={() => setModalPago(f)}
                                  className="btn-primary"
                                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                                  title="Registrar abono de pago"
                                >
                                  💳 Registrar Abono
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setModalCambioEstado(f)}
                                className="btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                                title="Cambiar estado manualmente"
                              >
                                ✏️ Estado
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* PESTAÑA 3: PRESUPUESTOS                                       */}
      {/* ============================================================= */}
      {pestanaActiva === 'presupuestos' && (
        <div>
          <div className="admin-presupuestos-banner">
            <div>
              <h2 className="admin-banner-title">
                Registro y Cotización de Presupuestos
              </h2>
              <p className="admin-banner-desc">
                Acceda a la herramienta especializada de cotización para calcular subtotales, IVA automático (19%) y vincular presupuestos directamente a proyectos u obras activas.
              </p>
            </div>
          </div>

          <div className="admin-card">
            <h3 className="admin-card-title">Presupuestos en Sistema</h3>

            {cargandoPresupuestos ? (
              <p className="text-muted">Cargando presupuestos...</p>
            ) : presupuestos.length === 0 ? (
              <p className="text-muted">No hay presupuestos registrados aún.</p>
            ) : (
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>N° Presupuesto</th>
                      <th>Obra Asociada</th>
                      <th>Cliente</th>
                      <th style={{ textAlign: 'right' }}>Total (con IVA)</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                      <th style={{ textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presupuestos.map((p) => (
                      <tr key={p.id_presupuesto}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                          {p.numero_presupuesto}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.obra_codigo || '—'}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {p.obra_nombre || p.nombre_proyecto || 'Pendiente generación'}
                          </div>
                        </td>
                        <td>
                          <div>{p.cliente_razon_social}</div>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>{p.cliente_rut}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {formatearCLP(p.monto_total)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge-status ${
                              p.estado_presupuesto === 'Aprobado'
                                ? 'badge-presupuesto-aprobado'
                                : p.estado_presupuesto === 'Rechazado'
                                  ? 'badge-presupuesto-rechazado'
                                  : 'badge-presupuesto-pendiente'
                            }`}
                          >
                            ● {p.estado_presupuesto}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="admin-presupuesto-actions">
                            {esGerencial && p.estado_presupuesto !== 'Aprobado' && p.estado_presupuesto !== 'Rechazado' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAprobarPresupuesto(p.id_presupuesto, p.numero_presupuesto)}
                                  disabled={procesandoPresupuestoId === p.id_presupuesto}
                                  title="Aprobar presupuesto como Gerente"
                                  className="btn-aprobar-pres"
                                >
                                  ✓ Aprobar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRechazarPresupuesto(p.id_presupuesto, p.numero_presupuesto)}
                                  disabled={procesandoPresupuestoId === p.id_presupuesto}
                                  title="Rechazar presupuesto"
                                  className="btn-rechazar-pres"
                                >
                                  ✕ Rechazar
                                </button>
                              </>
                            )}
                            {p.estado_presupuesto === 'Aprobado' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPestanaActiva('facturas');
                                  setPresupuestoSeleccionadoId(p.id_presupuesto);
                                  setModalNuevaFactura(true);
                                }}
                                className="btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                title="Generar factura para este presupuesto aprobado"
                              >
                                🧾 Facturar
                              </button>
                            )}
                            {p.estado_presupuesto === 'Rechazado' && (
                              <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                                Rechazado
                              </span>
                            )}
                            {!esGerencial && p.estado_presupuesto !== 'Aprobado' && p.estado_presupuesto !== 'Rechazado' && (
                              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                Pendiente Gerencia
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODALES REUTILIZABLES                                         */}
      {/* ============================================================= */}
      <ModalNuevaFactura
        isOpen={modalNuevaFactura}
        onClose={() => setModalNuevaFactura(false)}
        presupuestosDisponibles={presupuestosDisponibles}
        presupuestoInicialId={presupuestoSeleccionadoId}
        onFacturaCreada={cargarFacturas}
        formatearCLP={formatearCLP}
      />

      <ModalRegistrarPago
        factura={modalPago}
        onClose={() => setModalPago(null)}
        onPagoRegistrado={cargarFacturas}
        formatearCLP={formatearCLP}
      />

      <ModalExportarPDF
        isOpen={modalPDF}
        onClose={() => setModalPDF(false)}
        tipoInicial={tipoPDF}
        presupuestos={presupuestos}
        facturas={facturas}
        formatearCLP={formatearCLP}
      />

      <ModalCambioEstadoPago
        factura={modalCambioEstado}
        onClose={() => setModalCambioEstado(null)}
        onEstadoActualizado={cargarFacturas}
      />
    </main>
  );
}
