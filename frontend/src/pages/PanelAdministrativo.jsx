import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../Servicios/api';

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
  const [notificacion, setNotificacion] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState('clientes'); // 'clientes' | 'facturas' | 'presupuestos'

  // -------------------------------------------------------------
  // ESTADOS: Modal PDF
  // -------------------------------------------------------------
  const [modalPDF, setModalPDF] = useState(false);
  const [tipoPDF, setTipoPDF] = useState('presupuesto'); // 'presupuesto' | 'factura'
  const [itemPDFSeleccionado, setItemPDFSeleccionado] = useState('');
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [errorPDF, setErrorPDF] = useState(null);

  // -------------------------------------------------------------
  // ESTADOS: Clientes
  // -------------------------------------------------------------
  const [clientes, setClientes] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');
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
  const [guardandoCliente, setGuardandoCliente] = useState(false);
  const [mensajeCliente, setMensajeCliente] = useState(null);

  // -------------------------------------------------------------
  // ESTADOS: Facturas
  // -------------------------------------------------------------
  const [facturas, setFacturas] = useState([]);
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [filtroEstadoPago, setFiltroEstadoPago] = useState('TODOS');
  const [busquedaFactura, setBusquedaFactura] = useState('');
  const [modalNuevaFactura, setModalNuevaFactura] = useState(false);
  const [presupuestosDisponibles, setPresupuestosDisponibles] = useState([]);
  const [nuevaFactura, setNuevaFactura] = useState({
    folio_factura: '',
    presupuesto: '',
    cliente: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    monto_total: '',
    estado_pago: 'Pendiente',
  });
  const [guardandoFactura, setGuardandoFactura] = useState(false);
  const [mensajeFactura, setMensajeFactura] = useState(null);

  // Modal para registrar abono / pago a factura
  const [modalPago, setModalPago] = useState(null); // Factura seleccionada
  const [datosPago, setDatosPago] = useState({
    monto_abono: '',
    metodo_pago: 'Transferencia',
    nro_comprobante: '',
    notas: '',
  });
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [mensajePago, setMensajePago] = useState(null);

  // Modal para cambio directo de estado de pago
  const [modalCambioEstado, setModalCambioEstado] = useState(null);
  const [nuevoEstadoSeleccionado, setNuevoEstadoSeleccionado] = useState('Pagado');
  const [guardandoEstado, setGuardandoEstado] = useState(false);

  // -------------------------------------------------------------
  // ESTADOS: Presupuestos (Resumen)
  // -------------------------------------------------------------
  const [presupuestos, setPresupuestos] = useState([]);
  const [cargandoPresupuestos, setCargandoPresupuestos] = useState(false);

  // -------------------------------------------------------------
  // HANDLER: Exportar PDF
  // -------------------------------------------------------------
  const handleExportarPDF = async () => {
    if (!itemPDFSeleccionado) {
      setErrorPDF('Debes seleccionar un elemento para exportar.');
      return;
    }
    setExportandoPDF(true);
    setErrorPDF(null);
    try {
      const endpoint =
        tipoPDF === 'presupuesto'
          ? `/obras/fyag/v1/presupuestos/${itemPDFSeleccionado}/pdf/`
          : `/obras/fyag/v1/facturas/${itemPDFSeleccionado}/pdf/`;

      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const nombre =
        tipoPDF === 'presupuesto'
          ? presupuestos.find((p) => p.id_presupuesto === itemPDFSeleccionado)?.numero_presupuesto || itemPDFSeleccionado
          : facturas.find((f) => f.id_factura === itemPDFSeleccionado)?.folio_factura || itemPDFSeleccionado;
      link.setAttribute('download', `${tipoPDF}_${nombre}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setModalPDF(false);
      setItemPDFSeleccionado('');
    } catch (err) {
      setErrorPDF(
        err.response?.status === 404
          ? 'No se encontró el elemento seleccionado.'
          : 'Error al generar el PDF. Intente de nuevo.'
      );
    } finally {
      setExportandoPDF(false);
    }
  };

  // -------------------------------------------------------------
  // EFECTOS DE CARGA
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

  // Aviso que llega desde NuevoPresupuesto al registrar un presupuesto 
  useEffect(() => {
    const notificacionRecibida = location.state?.notificacion;
    if (!notificacionRecibida) return;
    setNotificacion(notificacionRecibida);
    setPestanaActiva('presupuestos');
    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!notificacion) return;
    const temporizador = setTimeout(() => {
      setNotificacion(null);
    }, 5000);
    return () => clearTimeout(temporizador);
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
  // HANDLERS: Facturas
  // -------------------------------------------------------------
  const handlePresupuestoSeleccionado = (presupuestoId) => {
    const pres = presupuestosDisponibles.find((p) => p.id_presupuesto === presupuestoId);
    if (pres) {
      setNuevaFactura((prev) => ({
        ...prev,
        presupuesto: pres.id_presupuesto,
        cliente: pres.cliente,
        monto_total: pres.monto_total || '',
        folio_factura: prev.folio_factura || `FAC-${pres.numero_presupuesto?.replace('PRE-', '') || Date.now().toString().slice(-5)}`,
      }));
    } else {
      setNuevaFactura((prev) => ({
        ...prev,
        presupuesto: '',
        cliente: '',
        monto_total: '',
      }));
    }
  };

  const handleSubmitFactura = async (e) => {
    e.preventDefault();
    if (!nuevaFactura.presupuesto) {
      setMensajeFactura({ tipo: 'error', texto: 'Debe seleccionar un presupuesto asociado.' });
      return;
    }
    setGuardandoFactura(true);
    setMensajeFactura(null);
    try {
      await api.post('/obras/fyag/v1/facturas/', nuevaFactura);
      setMensajeFactura({ tipo: 'exito', texto: '¡Factura creada exitosamente!' });
      cargarFacturas();
      setTimeout(() => {
        setModalNuevaFactura(false);
        setMensajeFactura(null);
        setNuevaFactura({
          folio_factura: '',
          presupuesto: '',
          cliente: '',
          fecha_emision: new Date().toISOString().split('T')[0],
          fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          monto_total: '',
          estado_pago: 'Pendiente',
        });
      }, 1000);
    } catch (err) {
      const dataErr = err.response?.data;
      const detalle = dataErr
        ? Object.entries(dataErr)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ')
        : 'Error al emitir la factura.';
      setMensajeFactura({ tipo: 'error', texto: detalle });
    } finally {
      setGuardandoFactura(false);
    }
  };

  const handleRegistrarPago = async (e) => {
    e.preventDefault();
    if (!modalPago) return;
    setGuardandoPago(true);
    setMensajePago(null);
    try {
      await api.post(`/obras/fyag/v1/facturas/${modalPago.id_factura}/actualizar-estado-pago/`, {
        monto_abono: datosPago.monto_abono,
        metodo_pago: datosPago.metodo_pago,
        nro_comprobante: datosPago.nro_comprobante,
        notas: datosPago.notas,
      });
      setMensajePago({ tipo: 'exito', texto: '¡Pago registrado y saldo actualizado!' });
      cargarFacturas();
      setTimeout(() => {
        setModalPago(null);
        setDatosPago({ monto_abono: '', metodo_pago: 'Transferencia', nro_comprobante: '', notas: '' });
        setMensajePago(null);
      }, 1000);
    } catch (err) {
      const errMsj = err.response?.data?.error || 'Error al registrar el abono.';
      setMensajePago({ tipo: 'error', texto: errMsj });
    } finally {
      setGuardandoPago(false);
    }
  };

  const handleActualizarEstadoDirecto = async (e) => {
    e.preventDefault();
    if (!modalCambioEstado) return;
    setGuardandoEstado(true);
    try {
      await api.post(`/obras/fyag/v1/facturas/${modalCambioEstado.id_factura}/actualizar-estado-pago/`, {
        estado_pago: nuevoEstadoSeleccionado,
      });
      cargarFacturas();
      setModalCambioEstado(null);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo actualizar el estado de pago.');
    } finally {
      setGuardandoEstado(false);
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Panel Administrativo
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>
            Gestión de clientes, emisión y control de facturas, y presupuestos.
          </p>
        </div>

        {/* BOTÓN REQUERIDO: Registrar Presupuesto (lleva a la vista existente) */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setTipoPDF('presupuesto');
              setItemPDFSeleccionado('');
              setErrorPDF(null);
              setModalPDF(true);
            }}
            className="btn-secondary"
            style={{
              fontSize: '1rem',
              padding: '0.75rem 1.4rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            📥 Exportar a PDF
          </button>

          <button
            type="button"
            onClick={() => navigate('/nuevo-presupuesto')}
            className="btn-primary"
            style={{
              fontSize: '1rem',
              padding: '0.75rem 1.4rem',
              boxShadow: '0 4px 6px -1px rgba(30, 64, 175, 0.25)',
              cursor: 'pointer',
            }}
          >
            📄 + Registrar Presupuesto
          </button>
        </div>
      </div>

      {notificacion && (
        <div
          style={{
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            borderRadius: '8px',
            background: notificacion.tipo === 'exito' ? 'var(--estado-finalizada-bg)' : 'var(--estado-cancelada-bg)',
            color: notificacion.tipo === 'exito' ? 'var(--estado-finalizada)' : 'var(--estado-cancelada)',
            border: `1px solid ${notificacion.tipo === 'exito' ? '#bbf7d0' : '#fecaca'}`,
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          {notificacion.mensaje}
        </div>
      )}

      {/* Barra de Pestañas / Navegación Interna */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border)',
          marginBottom: '1.75rem',
        }}
      >
        <button
          type="button"
          onClick={() => setPestanaActiva('clientes')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: 'none',
            border: 'none',
            borderBottom: pestanaActiva === 'clientes' ? '3px solid var(--primary)' : '3px solid transparent',
            color: pestanaActiva === 'clientes' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          👥 Clientes ({clientes.length})
        </button>

        <button
          type="button"
          onClick={() => setPestanaActiva('facturas')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: 'none',
            border: 'none',
            borderBottom: pestanaActiva === 'facturas' ? '3px solid var(--primary)' : '3px solid transparent',
            color: pestanaActiva === 'facturas' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          🧾 Gestión de Facturas ({facturas.length})
        </button>

        <button
          type="button"
          onClick={() => setPestanaActiva('presupuestos')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            background: 'none',
            border: 'none',
            borderBottom: pestanaActiva === 'presupuestos' ? '3px solid var(--primary)' : '3px solid transparent',
            color: pestanaActiva === 'presupuestos' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          💰 Presupuestos ({presupuestos.length})
        </button>
      </div>

      {/* ============================================================= */}
      {/* PESTAÑA 1: CLIENTES (Registrar Cliente y Listado)               */}
      {/* ============================================================= */}
      {pestanaActiva === 'clientes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Formulario para registrar cliente */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              👤 Registrar Nuevo Cliente
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Ingrese los antecedentes legales y de contacto de la empresa.
            </p>

            {mensajeCliente && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: mensajeCliente.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
                  color: mensajeCliente.tipo === 'exito' ? '#15803d' : '#dc2626',
                  border: `1px solid ${mensajeCliente.tipo === 'exito' ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Cartera de Clientes
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {clientesFiltrados.length} clientes encontrados
                </span>
              </div>
              <input
                type="text"
                placeholder="Buscar por RUT, razón social, ciudad..."
                value={busquedaCliente}
                onChange={(e) => setBusquedaCliente(e.target.value)}
                className="form-control"
                style={{ maxWidth: '280px' }}
              />
            </div>

            {cargandoClientes ? (
              <p style={{ color: 'var(--text-muted)' }}>Cargando clientes...</p>
            ) : clientesFiltrados.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No se encontraron clientes.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Razón Social</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>RUT</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Ubicación</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Contacto</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesFiltrados.map((c) => (
                      <tr key={c.id_cliente} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                          {c.razon_social}
                          {c.giro_comercial && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                              {c.giro_comercial}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{c.rut_empresa}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {c.ciudad || c.comuna ? `${c.comuna || ''}${c.comuna && c.ciudad ? ', ' : ''}${c.ciudad || ''}` : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {c.contacto_nombre || c.contacto_email || '—'}
                          {c.contacto_telefono && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.contacto_telefono}</div>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: c.estado_cliente === 'Activo' ? '#dcfce7' : c.estado_cliente === 'Moroso' ? '#fee2e2' : '#f1f5f9',
                              color: c.estado_cliente === 'Activo' ? '#15803d' : c.estado_cliente === 'Moroso' ? '#b91c1c' : '#64748b',
                            }}
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
      {/* PESTAÑA 2: GESTIÓN DE FACTURAS (Creación y Estado de Pago)       */}
      {/* ============================================================= */}
      {pestanaActiva === 'facturas' && (
        <div>
          {/* Barra superior de facturas */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
              background: 'var(--surface)',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Filtrar por:</span>
              {['TODOS', 'Pendiente', 'Pago Parcial', 'Pagado'].map((est) => (
                <button
                  key={est}
                  type="button"
                  onClick={() => setFiltroEstadoPago(est)}
                  className={filtroEstadoPago === est ? 'btn-primary' : 'btn-secondary'}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    borderRadius: '20px',
                    cursor: 'pointer',
                  }}
                >
                  {est === 'TODOS' ? 'Todas las facturas' : est}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Buscar folio, cliente, RUT..."
                value={busquedaFactura}
                onChange={(e) => setBusquedaFactura(e.target.value)}
                className="form-control"
                style={{ minWidth: '220px' }}
              />

              {/* Botón para Emitir Nueva Factura */}
              <button
                type="button"
                onClick={() => setModalNuevaFactura(true)}
                className="btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                + Emitir Factura
              </button>
            </div>
          </div>

          {/* Tabla de Facturas */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {cargandoFacturas ? (
              <p style={{ color: 'var(--text-muted)' }}>Cargando facturas...</p>
            ) : facturasFiltradas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧾</div>
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
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Folio</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Cliente</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Presupuesto</th>
                      <th style={{ padding: '0.75rem 0.5rem' }}>Emisión / Venc.</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Monto Total</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Saldo Pendiente</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Estado Pago</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturasFiltradas.map((f) => {
                      const badge = BADGES_PAGO[f.estado_pago] || BADGES_PAGO.Pendiente;
                      return (
                        <tr key={f.id_factura} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {f.folio_factura}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <div style={{ fontWeight: 600 }}>{f.cliente_razon_social || 'Cliente'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.cliente_rut}</div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {f.numero_presupuesto || '—'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem' }}>
                            <div>Em: {f.fecha_emision}</div>
                            <div style={{ color: 'var(--text-muted)' }}>Venc: {f.fecha_vencimiento}</div>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                            {formatearCLP(f.monto_total)}
                          </td>
                          <td
                            style={{
                              padding: '0.75rem 0.5rem',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: Number(f.saldo_pendiente) > 0 ? '#dc2626' : '#16a34a',
                            }}
                          >
                            {formatearCLP(f.saldo_pendiente)}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: '12px',
                                fontSize: '0.775rem',
                                fontWeight: 700,
                                backgroundColor: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                display: 'inline-block',
                              }}
                            >
                              ● {f.estado_pago}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              {f.estado_pago !== 'Pagado' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalPago(f);
                                    setDatosPago({
                                      monto_abono: f.saldo_pendiente,
                                      metodo_pago: 'Transferencia',
                                      nro_comprobante: '',
                                      notas: '',
                                    });
                                  }}
                                  className="btn-primary"
                                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                                  title="Registrar abono de pago"
                                >
                                  💳 Registrar Abono
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setModalCambioEstado(f);
                                  setNuevoEstadoSeleccionado(f.estado_pago);
                                }}
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
      {/* PESTAÑA 3: PRESUPUESTOS (Resumen y Botón a la Vista Existente)  */}
      {/* ============================================================= */}
      {pestanaActiva === 'presupuestos' && (
        <div>
          {/* Banner con enlace a la vista existente de registrar presupuesto */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              color: 'white',
              borderRadius: '12px',
              padding: '1.75rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
                Registro y Cotización de Presupuestos
              </h2>
              <p style={{ margin: 0, opacity: 0.9, fontSize: '0.95rem', maxWidth: '650px' }}>
                Acceda a la herramienta especializada de cotización para calcular subtotales, IVA automático (19%) y vincular presupuestos directamente a proyectos u obras activas.
              </p>
            </div>
          </div>

          {/* Tabla de presupuestos registrados */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>
              Presupuestos en Sistema
            </h3>

            {cargandoPresupuestos ? (
              <p style={{ color: 'var(--text-muted)' }}>Cargando presupuestos...</p>
            ) : presupuestos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No hay presupuestos registrados aún.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.5rem' }}>N° Presupuesto</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Obra Asociada</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Cliente</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Total (con IVA)</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Estado</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presupuestos.map((p) => (
                      <tr key={p.id_presupuesto} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {p.numero_presupuesto}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div style={{ fontWeight: 600 }}>{p.obra_codigo}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.obra_nombre}</div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <div>{p.cliente_razon_social}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.cliente_rut}</div>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>
                          {formatearCLP(p.monto_total)}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor:
                                p.estado_presupuesto === 'Aprobado'
                                  ? '#dcfce7'
                                  : p.estado_presupuesto === 'Rechazado'
                                    ? '#fee2e2'
                                    : '#eff6ff',
                              color:
                                p.estado_presupuesto === 'Aprobado'
                                  ? '#15803d'
                                  : p.estado_presupuesto === 'Rechazado'
                                    ? '#dc2626'
                                    : '#1d4ed8',
                            }}
                          >
                            ● {p.estado_presupuesto}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setPestanaActiva('facturas');
                              setModalNuevaFactura(true);
                              handlePresupuestoSeleccionado(p.id_presupuesto);
                            }}
                            className="btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                          >
                            🧾 Facturar
                          </button>
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
      {/* MODAL: EMITIR NUEVA FACTURA                                   */}
      {/* ============================================================= */}
      {modalNuevaFactura && (
        <div
          className="modal-overlay"
          onClick={() => setModalNuevaFactura(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#ffffff',
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '540px',
              width: '100%',
              padding: '1.75rem',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                🧾 Emitir Nueva Factura
              </h3>
              <button
                type="button"
                onClick={() => setModalNuevaFactura(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            {mensajeFactura && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: mensajeFactura.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
                  color: mensajeFactura.tipo === 'exito' ? '#15803d' : '#dc2626',
                  border: `1px solid ${mensajeFactura.tipo === 'exito' ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
                {mensajeFactura.texto}
              </div>
            )}

            <form onSubmit={handleSubmitFactura}>
              <div className="form-group">
                <label htmlFor="folio_factura">Folio Factura *</label>
                <input
                  type="text"
                  id="folio_factura"
                  className="form-control"
                  placeholder="Ej: FAC-2026-001"
                  value={nuevaFactura.folio_factura}
                  onChange={(e) => setNuevaFactura({ ...nuevaFactura, folio_factura: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="presupuesto_select">Presupuesto Vinculado *</label>
                <select
                  id="presupuesto_select"
                  className="form-control"
                  value={nuevaFactura.presupuesto}
                  onChange={(e) => handlePresupuestoSeleccionado(e.target.value)}
                  required
                >
                  <option value="">— Seleccione un presupuesto —</option>
                  {presupuestosDisponibles.map((p) => (
                    <option key={p.id_presupuesto} value={p.id_presupuesto}>
                      {p.numero_presupuesto} — {p.cliente_razon_social} ({formatearCLP(p.monto_total)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label htmlFor="fecha_emision">Fecha Emisión *</label>
                  <input
                    type="date"
                    id="fecha_emision"
                    className="form-control"
                    value={nuevaFactura.fecha_emision}
                    onChange={(e) => setNuevaFactura({ ...nuevaFactura, fecha_emision: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="fecha_vencimiento">Fecha Vencimiento *</label>
                  <input
                    type="date"
                    id="fecha_vencimiento"
                    className="form-control"
                    value={nuevaFactura.fecha_vencimiento}
                    onChange={(e) => setNuevaFactura({ ...nuevaFactura, fecha_vencimiento: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="monto_total">Monto Total Facturado (CLP) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  id="monto_total"
                  className="form-control"
                  placeholder="1000000"
                  value={nuevaFactura.monto_total}
                  onChange={(e) => setNuevaFactura({ ...nuevaFactura, monto_total: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="estado_pago_inicial">Estado Inicial</label>
                <select
                  id="estado_pago_inicial"
                  className="form-control"
                  value={nuevaFactura.estado_pago}
                  onChange={(e) => setNuevaFactura({ ...nuevaFactura, estado_pago: e.target.value })}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Pago Parcial">Pago Parcial</option>
                  <option value="Pagado">Pagado</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setModalNuevaFactura(false)}
                  className="btn-secondary"
                  disabled={guardandoFactura}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={guardandoFactura}>
                  {guardandoFactura ? 'Emitiendo...' : 'Emitir Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: REGISTRAR PAGO / ABONO                                 */}
      {/* ============================================================= */}
      {modalPago && (
        <div
          className="modal-overlay"
          onClick={() => setModalPago(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#ffffff',
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                💳 Registrar Pago a Factura
              </h3>
              <button
                type="button"
                onClick={() => setModalPago(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border)',
              }}
            >
              <div>Factura: <strong>{modalPago.folio_factura}</strong></div>
              <div>Cliente: <strong>{modalPago.cliente_razon_social}</strong></div>
              <div>Total: <strong>{formatearCLP(modalPago.monto_total)}</strong></div>
              <div style={{ color: '#dc2626', fontWeight: 700, marginTop: '0.25rem' }}>
                Saldo Pendiente: {formatearCLP(modalPago.saldo_pendiente)}
              </div>
            </div>

            {mensajePago && (
              <div
                style={{
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  backgroundColor: mensajePago.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
                  color: mensajePago.tipo === 'exito' ? '#15803d' : '#dc2626',
                  border: `1px solid ${mensajePago.tipo === 'exito' ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
                {mensajePago.texto}
              </div>
            )}

            <form onSubmit={handleRegistrarPago}>
              <div className="form-group">
                <label htmlFor="monto_abono">Monto a Abonar (CLP) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={modalPago.saldo_pendiente}
                  id="monto_abono"
                  className="form-control"
                  value={datosPago.monto_abono}
                  onChange={(e) => setDatosPago({ ...datosPago, monto_abono: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="metodo_pago">Método de Pago</label>
                <select
                  id="metodo_pago"
                  className="form-control"
                  value={datosPago.metodo_pago}
                  onChange={(e) => setDatosPago({ ...datosPago, metodo_pago: e.target.value })}
                >
                  <option value="Transferencia">Transferencia Electrónica</option>
                  <option value="Cheque">Cheque al Día / Plazo</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta de Crédito / Débito</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="nro_comprobante">N° Comprobante / Transacción</label>
                <input
                  type="text"
                  id="nro_comprobante"
                  className="form-control"
                  placeholder="Ej: TRX-987654"
                  value={datosPago.nro_comprobante}
                  onChange={(e) => setDatosPago({ ...datosPago, nro_comprobante: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notas">Notas / Observaciones</label>
                <textarea
                  id="notas"
                  rows={2}
                  className="form-control"
                  placeholder="Detalles adicionales del pago..."
                  value={datosPago.notas}
                  onChange={(e) => setDatosPago({ ...datosPago, notas: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setModalPago(null)}
                  className="btn-secondary"
                  disabled={guardandoPago}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={guardandoPago}>
                  {guardandoPago ? 'Procesando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: EXPORTAR A PDF                                         */}
      {/* ============================================================= */}
      {modalPDF && (
        <div
          className="modal-overlay"
          onClick={() => setModalPDF(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>
                📥 Exportar a PDF
              </h3>
              <button
                type="button"
                onClick={() => setModalPDF(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            {/* Selector de tipo */}
            <div className="form-group">
              <label>¿Qué desea exportar?</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                {[
                  { valor: 'presupuesto', etiqueta: '📄 Presupuesto' },
                  { valor: 'factura',     etiqueta: '🧾 Factura' },
                ].map(({ valor, etiqueta }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => { setTipoPDF(valor); setItemPDFSeleccionado(''); setErrorPDF(null); }}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: '8px',
                      border: tipoPDF === valor ? '2px solid var(--primary)' : '2px solid var(--border)',
                      backgroundColor: tipoPDF === valor ? '#eff6ff' : 'transparent',
                      color: tipoPDF === valor ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: tipoPDF === valor ? 700 : 500,
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de elemento */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="pdf_item_select">
                {tipoPDF === 'presupuesto' ? 'Seleccionar presupuesto' : 'Seleccionar factura'}
              </label>
              <select
                id="pdf_item_select"
                className="form-control"
                value={itemPDFSeleccionado}
                onChange={(e) => { setItemPDFSeleccionado(e.target.value); setErrorPDF(null); }}
                style={{ marginTop: '0.4rem' }}
              >
                <option value="">— Seleccione —</option>
                {tipoPDF === 'presupuesto'
                  ? presupuestos.map((p) => (
                      <option key={p.id_presupuesto} value={p.id_presupuesto}>
                        {p.numero_presupuesto} — {p.cliente_razon_social} ({formatearCLP(p.monto_total)})
                      </option>
                    ))
                  : facturas.map((f) => (
                      <option key={f.id_factura} value={f.id_factura}>
                        {f.folio_factura} — {f.cliente_razon_social} · {f.estado_pago}
                      </option>
                    ))}
              </select>
            </div>

            {/* Vista previa rápida del ítem seleccionado */}
            {itemPDFSeleccionado && tipoPDF === 'presupuesto' && (() => {
              const p = presupuestos.find((x) => x.id_presupuesto === itemPDFSeleccionado);
              return p ? (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  <div><strong>{p.numero_presupuesto}</strong> · {p.estado_presupuesto}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{p.obra_codigo} — {p.obra_nombre}</div>
                  <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>Total: {formatearCLP(p.monto_total)}</div>
                </div>
              ) : null;
            })()}

            {itemPDFSeleccionado && tipoPDF === 'factura' && (() => {
              const f = facturas.find((x) => x.id_factura === itemPDFSeleccionado);
              return f ? (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  <div><strong>{f.folio_factura}</strong></div>
                  <div style={{ color: 'var(--text-muted)' }}>{f.cliente_razon_social} · {f.numero_presupuesto}</div>
                  <div>Total: {formatearCLP(f.monto_total)} · Saldo: {formatearCLP(f.saldo_pendiente)}</div>
                  <div style={{ fontWeight: 700, color: f.estado_pago === 'Pagado' ? '#16a34a' : '#dc2626', marginTop: '0.25rem' }}>{f.estado_pago}</div>
                </div>
              ) : null;
            })()}

            {/* Error */}
            {errorPDF && (
              <div style={{ marginTop: '0.75rem', padding: '0.65rem', borderRadius: '6px', fontSize: '0.875rem', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>
                {errorPDF}
              </div>
            )}

            {/* Botones */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => setModalPDF(false)}
                className="btn-secondary"
                disabled={exportandoPDF}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExportarPDF}
                className="btn-primary"
                disabled={exportandoPDF || !itemPDFSeleccionado}
              >
                {exportandoPDF ? 'Generando PDF...' : '📥 Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: CAMBIO RÁPIDO DE ESTADO DE PAGO                        */}
      {/* ============================================================= */}
      {modalCambioEstado && (
        <div
          className="modal-overlay"
          onClick={() => setModalCambioEstado(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: '#ffffff',
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '420px',
              width: '100%',
              padding: '1.75rem',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Actualizar Estado de Pago: {modalCambioEstado.folio_factura}
            </h3>

            <form onSubmit={handleActualizarEstadoDirecto}>
              <div className="form-group">
                <label htmlFor="nuevo_estado">Nuevo Estado de Pago</label>
                <select
                  id="nuevo_estado"
                  className="form-control"
                  value={nuevoEstadoSeleccionado}
                  onChange={(e) => setNuevoEstadoSeleccionado(e.target.value)}
                >
                  <option value="Pendiente">Pendiente (restablece saldo al total)</option>
                  <option value="Pago Parcial">Pago Parcial</option>
                  <option value="Pagado">Pagado (deja saldo en $0)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setModalCambioEstado(null)}
                  className="btn-secondary"
                  disabled={guardandoEstado}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={guardandoEstado}>
                  {guardandoEstado ? 'Guardando...' : 'Actualizar Estado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

