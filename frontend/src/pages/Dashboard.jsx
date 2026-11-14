import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ClasificacionServicios from '../components/ClasificacionServicios';
import ObraCard from '../components/ObraCard';
import ModalCambiarEstado from '../components/ModalCambiarEstado';
import obrasService from '../Servicios/obrasService';

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState('TODOS');
  const [estadoSeleccionado, setEstadoSeleccionado] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');
  const [conteoPorTipo, setConteoPorTipo] = useState({});
  const [totalObras, setTotalObras] = useState(0);
  const [modalData, setModalData] = useState({
    isOpen: false,
    obra: null,
    transicion: null,
  });
  const [cargandoTransicion, setCargandoTransicion] = useState(false);
  const [notificacion, setNotificacion] = useState(null);
  const [asignacionObra, setAsignacionObra] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [asignacionForm, setAsignacionForm] = useState({ tecnico: '', fecha_inicio: new Date().toISOString().slice(0, 10), fecha_termino: new Date().toISOString().slice(0, 10), hora_inicio: '09:00', hora_termino: '10:00' });
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [obraEditando, setObraEditando] = useState(null);
  const [editForm, setEditForm] = useState({ nombre_obra: '', ubicacion_faena: '', fecha_inicio: '', fecha_termino_estimada: '', costo_estimado: '' });
  const [solicitudes, setSolicitudes] = useState([]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  useEffect(() => {
    const notificacionRecibida = location.state?.notificacion;
    if (!notificacionRecibida) return;
    setNotificacion(notificacionRecibida);
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

  const cargarResumenTipos = async () => {
    try {
      const data = await obrasService.getResumenTipos();
      const conteos = {};
      (data.clasificacion || []).forEach((item) => {
        conteos[item.codigo] = item.cantidad_obras;
      });
      setConteoPorTipo(conteos);
      setTotalObras(data.total_obras || 0);
    } catch (err) {
      console.error('Error al cargar resumen de tipos:', err);
    }
  };

  const cargarObras = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const data = await obrasService.getObras({
        tipo_servicio_codigo: tipoSeleccionado,
        estado_codigo: estadoSeleccionado,
        search: busqueda,
      });
      setObras(data);
    } catch (err) {
      console.error('Error al cargar obras:', err);
      setError('No se pudo conectar con el servidor backend (Django). Asegúrate de que esté corriendo.');
    } finally {
      setCargando(false);
    }
  }, [tipoSeleccionado, estadoSeleccionado, busqueda]);

  const cargarSolicitudes = useCallback(async () => {
    try {
      setSolicitudes(await obrasService.getSolicitudesCambio());
    } catch (err) {
      console.error('Error al cargar solicitudes de cambio:', err);
    }
  }, []);

  useEffect(() => {
    cargarResumenTipos();
  }, []);

  useEffect(() => {
    cargarObras();
  }, [cargarObras]);

  useEffect(() => {
    cargarSolicitudes();
  }, [cargarSolicitudes]);

  const handleSolicitarTransicion = (obra, transicion) => {
    setModalData({
      isOpen: true,
      obra,
      transicion,
    });
  };

  const abrirAsignacion = async (obra) => {
    setAsignacionObra(obra);
    try {
      const lista = await obrasService.getTecnicos();
      setTecnicos(lista);
      setAsignacionForm((actual) => ({ ...actual, tecnico: lista[0]?.id || '' }));
    } catch {
      setNotificacion({ tipo: 'error', mensaje: 'No se pudo cargar el listado de técnicos.' });
    }
  };

  const abrirEdicion = (obra) => {
    setObraEditando(obra);
    setEditForm({
      nombre_obra: obra.nombre_obra || '',
      ubicacion_faena: obra.ubicacion_faena || '',
      fecha_inicio: obra.fecha_inicio || '',
      fecha_termino_estimada: obra.fecha_termino_estimada || '',
      costo_estimado: obra.costo_estimado ?? '',
    });
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    try {
      await obrasService.actualizarObra(obraEditando.id_obra, {
        ...editForm,
        costo_estimado: Number(editForm.costo_estimado) || 0,
        fecha_termino_estimada: editForm.fecha_termino_estimada || null,
      });
      setObraEditando(null);
      setNotificacion({ tipo: 'exito', mensaje: 'Detalles de la obra actualizados.' });
      await cargarObras();
    } catch (err) {
      const data = err.response?.data;
      setNotificacion({ tipo: 'error', mensaje: data?.detail || 'No se pudieron actualizar los detalles de la obra.' });
    }
  };

  const resolverSolicitud = async (solicitud, accion) => {
    try {
      await obrasService.resolverSolicitudCambio(solicitud.id_solicitud, accion);
      setNotificacion({ tipo: 'exito', mensaje: `Solicitud ${accion === 'APROBAR' ? 'aprobada' : 'rechazada'}.` });
      await Promise.all([cargarObras(), cargarSolicitudes(), cargarResumenTipos()]);
    } catch (err) {
      const data = err.response?.data;
      setNotificacion({ tipo: 'error', mensaje: data?.detail || data?.error || 'No se pudo resolver la solicitud.' });
    }
  };

  const guardarAsignacion = async (event) => {
    event.preventDefault();
    setGuardandoAsignacion(true);
    try {
      await obrasService.asignarTecnico({ obra: asignacionObra.id_obra, ...asignacionForm });
      setAsignacionObra(null);
      setNotificacion({ tipo: 'exito', mensaje: 'Técnico asignado al horario.' });
      await cargarObras();
    } catch (err) {
      const data = err.response?.data;
      setNotificacion({ tipo: 'error', mensaje: data?.horario?.[0] || data?.detail || 'No se pudo asignar el técnico. Revisa que no tenga otra obra en ese horario.' });
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  const handleConfirmarTransicion = async (nuevoEstadoCodigo, motivo) => {
    if (!modalData.obra) return;
    try {
      setCargandoTransicion(true);
      const res = await obrasService.cambiarEstado(
        modalData.obra.id_obra,
        nuevoEstadoCodigo,
        motivo
      );
      setNotificacion({
        tipo: 'exito',
        mensaje: res.mensaje || 'Estado actualizado con éxito.',
      });
      setModalData({ isOpen: false, obra: null, transicion: null });
      await Promise.all([cargarObras(), cargarResumenTipos()]);
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      const errorMsg =
        err.response?.data?.error ||
        'Error inesperado al intentar cambiar el estado.';
      setNotificacion({
        tipo: 'error',
        mensaje: errorMsg,
      });
    } finally {
      setCargandoTransicion(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', padding: '1rem 0' }}>
        <button 
          onClick={handleLogout} 
          style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </div>

      {notificacion && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            backgroundColor:
              notificacion.tipo === 'exito' ? 'var(--estado-finalizada-bg)' : 'var(--estado-cancelada-bg)',
            color:
              notificacion.tipo === 'exito' ? 'var(--estado-finalizada)' : 'var(--estado-cancelada)',
            border: `1px solid ${
              notificacion.tipo === 'exito' ? '#bbf7d0' : '#fecaca'
            }`,
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
        {notificacion.mensaje}
        </div>
      )}

      {solicitudes.filter((solicitud) => solicitud.estado === 'PENDIENTE').length > 0 && (
        <section className="solicitudes-panel" aria-label="Solicitudes de técnicos">
          <div className="solicitudes-panel-header">
            <div>
              <h2>Solicitudes de técnicos</h2>
              <p>Revisa y resuelve las solicitudes de suspensión o cancelación.</p>
            </div>
          </div>
          <div className="solicitudes-lista">
            {solicitudes.filter((solicitud) => solicitud.estado === 'PENDIENTE').map((solicitud) => (
              <article className="solicitud-item" key={solicitud.id_solicitud}>
                <div>
                  <strong>{solicitud.tipo === 'SUSPENSION' ? 'Suspensión' : 'Cancelación'} · {solicitud.obra_codigo}</strong>
                  <span>{solicitud.obra_nombre} · Técnico: {solicitud.tecnico_nombre}</span>
                  <p>{solicitud.motivo}</p>
                </div>
                <div className="solicitud-actions">
                  <button type="button" className="btn-primary" onClick={() => resolverSolicitud(solicitud, 'APROBAR')}>Aprobar</button>
                  <button type="button" className="btn-secondary" onClick={() => resolverSolicitud(solicitud, 'RECHAZAR')}>Rechazar</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <ClasificacionServicios
        tipoSeleccionado={tipoSeleccionado}
        onSeleccionarTipo={setTipoSeleccionado}
        conteoPorTipo={conteoPorTipo}
        totalObras={totalObras}
      />

      <div className="filters-row">
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Buscar por código, faena, cliente o ubicación..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className="estado-filter">
          <label htmlFor="estado-select" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Estado operativo:
          </label>
          <select
            id="estado-select"
            className="estado-select"
            value={estadoSeleccionado}
            onChange={(e) => setEstadoSeleccionado(e.target.value)}
          >
            <option value="TODOS">Todos los estados</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="EJECUCION">En Ejecución</option>
            <option value="SUSPENDIDA">Suspendidas</option>
            <option value="FINALIZADA">Finalizadas</option>
            <option value="CANCELADA">Canceladas</option>
          </select>
        </div>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Cargando fichas de obras...
        </div>
      ) : error ? (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <p style={{ color: 'var(--estado-cancelada)', fontWeight: 600, marginBottom: '0.5rem' }}>
            {error}
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              cargarResumenTipos();
              cargarObras();
            }}
          >
            Reintentar Conexión
          </button>
        </div>
      ) : obras.length === 0 ? (
        <div
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: 'var(--surface)',
            border: '1px dashed var(--border)',
            borderRadius: '12px',
          }}
        >
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No se encontraron obras para los filtros seleccionados.
          </p>
          {(tipoSeleccionado !== 'TODOS' || estadoSeleccionado !== 'TODOS' || busqueda) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setTipoSeleccionado('TODOS');
                setEstadoSeleccionado('TODOS');
                setBusqueda('');
              }}
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <div className="obras-grid">
          {obras.map((obra) => (
            <ObraCard
              key={obra.id_obra}
              obra={obra}
              onSolicitarTransicion={handleSolicitarTransicion}
              onAsignarTecnico={abrirAsignacion}
              onEditarObra={abrirEdicion}
            />
          ))}
        </div>
      )}

      <ModalCambiarEstado
        isOpen={modalData.isOpen}
        obra={modalData.obra}
        transicion={modalData.transicion}
        cargando={cargandoTransicion}
        onClose={() => setModalData({ isOpen: false, obra: null, transicion: null })}
        onConfirmar={handleConfirmarTransicion}
      />
      {obraEditando && <div role="presentation" onClick={() => setObraEditando(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .55)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <form onSubmit={guardarEdicion} onClick={(event) => event.stopPropagation()} style={{ width: 'min(520px, 100%)', background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', display: 'grid', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Editar obra · {obraEditando.codigo_obra}</h2>
          <label>Nombre de la obra<input required type="text" value={editForm.nombre_obra} onChange={(e) => setEditForm({ ...editForm, nombre_obra: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label>
          <label>Ubicación de faena<input required type="text" value={editForm.ubicacion_faena} onChange={(e) => setEditForm({ ...editForm, ubicacion_faena: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label>
          <div style={{ display: 'flex', gap: '.75rem' }}><label style={{ flex: 1 }}>Fecha de inicio<input required type="date" value={editForm.fecha_inicio} onChange={(e) => setEditForm({ ...editForm, fecha_inicio: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label><label style={{ flex: 1 }}>Término estimado<input type="date" value={editForm.fecha_termino_estimada} onChange={(e) => setEditForm({ ...editForm, fecha_termino_estimada: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label></div>
          <label>Presupuesto estimado<input required min="0" type="number" value={editForm.costo_estimado} onChange={(e) => setEditForm({ ...editForm, costo_estimado: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}><button type="button" className="btn-secondary" onClick={() => setObraEditando(null)}>Cancelar</button><button type="submit" className="btn-primary">Guardar cambios</button></div>
        </form>
      </div>}
      {asignacionObra && <div role="presentation" onClick={() => setAsignacionObra(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .55)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <form onSubmit={guardarAsignacion} onClick={(event) => event.stopPropagation()} style={{ width: 'min(440px, 100%)', background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', display: 'grid', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Asignar técnico · {asignacionObra.codigo_obra}</h2>
          <label>Técnico<select required value={asignacionForm.tecnico} onChange={(e) => setAsignacionForm({ ...asignacionForm, tecnico: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }}><option value="">Selecciona un técnico</option>{tecnicos.map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre}</option>)}</select></label>
          <div style={{ display: 'flex', gap: '.75rem' }}><label style={{ flex: 1 }}>Desde<input required type="date" value={asignacionForm.fecha_inicio} onChange={(e) => setAsignacionForm({ ...asignacionForm, fecha_inicio: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label><label style={{ flex: 1 }}>Hasta<input required type="date" value={asignacionForm.fecha_termino} onChange={(e) => setAsignacionForm({ ...asignacionForm, fecha_termino: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label></div>
          <div style={{ display: 'flex', gap: '.75rem' }}><label style={{ flex: 1 }}>Desde<input required type="time" value={asignacionForm.hora_inicio} onChange={(e) => setAsignacionForm({ ...asignacionForm, hora_inicio: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label><label style={{ flex: 1 }}>Hasta<input required type="time" value={asignacionForm.hora_termino} onChange={(e) => setAsignacionForm({ ...asignacionForm, hora_termino: e.target.value })} style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}><button type="button" className="btn-secondary" onClick={() => setAsignacionObra(null)}>Cancelar</button><button type="submit" className="btn-primary" disabled={guardandoAsignacion || !tecnicos.length}>{guardandoAsignacion ? 'Guardando…' : 'Confirmar asignación'}</button></div>
        </form>
      </div>}
    </div>
  );
}
