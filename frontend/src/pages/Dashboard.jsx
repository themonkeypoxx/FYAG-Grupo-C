import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ClasificacionServicios from '../components/ClasificacionServicios';
import GraficoDashObras from '../components/GraficoDashObras';
import ObraCard from '../components/ObraCard';
import ModalCambiarEstado from '../components/ModalCambiarEstado';
import ModalMateriales from '../components/ModalMateriales';
import ModalConfirmacion from '../components/ModalConfirmacion';
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
  const [asignacionForm, setAsignacionForm] = useState({ tecnico: '', fecha_inicio: new Date().toISOString().slice(0, 10), fecha_termino: new Date().toISOString().slice(0, 10), bloque: 'MANANA' });
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [obraEditando, setObraEditando] = useState(null);
  const [editForm, setEditForm] = useState({ nombre_obra: '', ubicacion_faena: '', fecha_inicio: '', fecha_termino_estimada: '', costo_estimado: '' });
  const [solicitudes, setSolicitudes] = useState([]);
  const [errorSolicitudes, setErrorSolicitudes] = useState('');
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const [asignacionesExistentes, setAsignacionesExistentes] = useState([]);
  const [catalogoMaquinarias, setCatalogoMaquinarias] = useState([]);
  const [obraMateriales, setObraMateriales] = useState(null);
  const [modalConfirmacion, setModalConfirmacion] = useState({
    isOpen: false,
    titulo: '',
    mensaje: '',
    onConfirmar: null,
    tipo: 'peligro',
    textoConfirmar: 'Confirmar',
    cargando: false,
  });

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
    setCargandoSolicitudes(true);
    setErrorSolicitudes('');
    try {
      const respuesta = await obrasService.getSolicitudesCambio();
      setSolicitudes(Array.isArray(respuesta) ? respuesta : respuesta?.results || []);
    } catch (err) {
      console.error('Error al cargar solicitudes de cambio:', err);
      setErrorSolicitudes('No se pudieron cargar las solicitudes. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setCargandoSolicitudes(false);
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

  useEffect(() => {
    const refrescarAlVolver = () => {
      if (document.visibilityState === 'visible') cargarSolicitudes();
    };
    const intervalo = window.setInterval(refrescarAlVolver, 30000);
    window.addEventListener('focus', refrescarAlVolver);
    document.addEventListener('visibilitychange', refrescarAlVolver);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', refrescarAlVolver);
      document.removeEventListener('visibilitychange', refrescarAlVolver);
    };
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
      const [listaTecnicos, listaAsignaciones] = await Promise.all([
        obrasService.getTecnicos(),
        obrasService.getAsignaciones(),
      ]);

      setTecnicos(listaTecnicos);
      setAsignacionesExistentes(listaAsignaciones.filter((a) => a.activo));
      setAsignacionForm((actual) => ({
        ...actual,
        tecnico: listaTecnicos[0]?.id || '',
      }));
    } catch (err) {
      console.error('Error al cargar técnicos o asignaciones:', err);
      setNotificacion({ tipo: 'error', mensaje: 'No se pudieron cargar los técnicos o las asignaciones existentes.' });
    }
  };

  const abrirEdicion = async (obra) => {
    setObraEditando(obra);
    setEditForm({
      nombre_obra: obra.nombre_obra || '',
      ubicacion_faena: obra.ubicacion_faena || '',
      fecha_inicio: obra.fecha_inicio || '',
      fecha_termino_estimada: obra.fecha_termino_estimada || '',
      costo_estimado: obra.costo_estimado ?? '',
      maquinarias_codigos: (obra.maquinarias_asignadas || []).map((m) => m.codigo),
    });
    try {
      const maqs = await obrasService.getMaquinarias();
      setCatalogoMaquinarias(maqs || []);
    } catch (err) {
      console.warn('No se pudo cargar catálogo de maquinarias:', err);
    }
  };

  const guardarEdicion = async (event) => {
    event.preventDefault();
    try {
      await obrasService.actualizarObra(obraEditando.id_obra, {
        ...editForm,
        costo_estimado: Number(editForm.costo_estimado) || 0,
        fecha_termino_estimada: editForm.fecha_termino_estimada || null,
        maquinarias_codigos: editForm.maquinarias_codigos || [],
      });
      setObraEditando(null);
      setNotificacion({ tipo: 'exito', mensaje: 'Detalles de la obra actualizados.' });
      await cargarObras();
    } catch (err) {
      const data = err.response?.data;
      setNotificacion({ tipo: 'error', mensaje: data?.horario || data?.bloque || data?.detail || 'No se pudieron actualizar los detalles de la obra.' });
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
      const horario = asignacionForm.bloque === 'MANANA'
        ? { hora_inicio: '09:30', hora_termino: '13:30' }
        : { hora_inicio: '15:00', hora_termino: '17:00' };
      await obrasService.asignarTecnico({
        obra: asignacionObra.id_obra,
        tecnico: asignacionForm.tecnico,
        fecha_inicio: asignacionForm.fecha_inicio,
        fecha_termino: asignacionForm.fecha_termino,
        ...horario,
      });
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

  const handleDesasignarTecnico = (obra, tecnicoId, tecnicoNombre) => {
    setModalConfirmacion({
      isOpen: true,
      titulo: 'Confirmar Desasignación',
      mensaje: `¿Está seguro de que desea desasignar a ${tecnicoNombre} de la obra ${obra.codigo_obra}?`,
      tipo: 'peligro',
      textoConfirmar: 'Desasignar Técnico',
      cargando: false,
      onConfirmar: async () => {
        try {
          setModalConfirmacion((prev) => ({ ...prev, cargando: true }));
          await obrasService.desasignarTecnico(obra.id_obra, tecnicoId);
          setNotificacion({ tipo: 'exito', mensaje: `${tecnicoNombre} fue desasignado de ${obra.codigo_obra}.` });
          await cargarObras();
        } catch (err) {
          setNotificacion({ tipo: 'error', mensaje: err.response?.data?.detail || 'No se pudo desasignar al técnico.' });
        } finally {
          setModalConfirmacion({ isOpen: false, titulo: '', mensaje: '', onConfirmar: null, cargando: false });
        }
      },
    });
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
        err.response?.data?.detail ||
        'Error inesperado al intentar cambiar el estado.';
      setNotificacion({
        tipo: 'error',
        mensaje: errorMsg,
      });
    } finally {
      setCargandoTransicion(false);
    }
  };

  const aMinutos = (hora) => {
    const [horas, minutos] = hora.slice(0, 5).split(':').map(Number);
    return horas * 60 + minutos;
  };

  const bloqueOcupado = (bloque) => {
    if (!asignacionForm.tecnico || !asignacionForm.fecha_inicio || !asignacionForm.fecha_termino) {
      return false;
    }

    const horario = bloque === 'MANANA'
      ? { inicio: '09:30', termino: '13:30' }
      : { inicio: '15:00', termino: '17:00' };

    return asignacionesExistentes.some((a) => {
      const mismoTecnico = String(a.tecnico) === String(asignacionForm.tecnico);
      const dentroDelRango =
        a.fecha >= asignacionForm.fecha_inicio &&
        a.fecha <= asignacionForm.fecha_termino;
      const dia = new Date(`${a.fecha}T12:00:00`).getDay();
      const esDiaHabil = dia !== 0 && dia !== 6;
      const seCruza =
        aMinutos(a.hora_inicio) < aMinutos(horario.termino) &&
        aMinutos(a.hora_termino) > aMinutos(horario.inicio);

      return a.activo && mismoTecnico && dentroDelRango && esDiaHabil && seCruza;
    });
  };

  return (
    <div>
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
            border: `1px solid ${notificacion.tipo === 'exito' ? '#bbf7d0' : '#fecaca'
              }`,
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          {notificacion.mensaje}
        </div>
      )}


      <ClasificacionServicios
        tipoSeleccionado={tipoSeleccionado}
        onSeleccionarTipo={setTipoSeleccionado}
        conteoPorTipo={conteoPorTipo}
        totalObras={totalObras}
      />

      <section className="solicitudes-panel" aria-label="Obras por estado operativo">
        <div className="solicitudes-panel-header">
          <div>
            <h2>Obras por estado operativo</h2>
            <p>Cantidad de obras pendientes, en ejecución, suspendidas, finalizadas y canceladas.</p>
          </div>
        </div>
        <GraficoDashObras />
      </section>

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
              onDesasignarTecnico={handleDesasignarTecnico}
              onEditarObra={abrirEdicion}
              onGestionarMateriales={setObraMateriales}
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
      <ModalMateriales
        isOpen={!!obraMateriales}
        obra={obraMateriales ? obras.find((o) => o.id_obra === obraMateriales.id_obra) || obraMateriales : null}
        onClose={() => setObraMateriales(null)}
        onCambio={cargarObras}
      />
      <ModalConfirmacion
        isOpen={modalConfirmacion.isOpen}
        titulo={modalConfirmacion.titulo}
        mensaje={modalConfirmacion.mensaje}
        tipo={modalConfirmacion.tipo}
        textoConfirmar={modalConfirmacion.textoConfirmar}
        cargando={modalConfirmacion.cargando}
        onClose={() => setModalConfirmacion({ isOpen: false, titulo: '', mensaje: '', onConfirmar: null, cargando: false })}
        onConfirmar={modalConfirmacion.onConfirmar}
      />
      {obraEditando && (
        <div
          role="presentation"
          onClick={() => setObraEditando(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, .55)',
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={guardarEdicion}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: '12px',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Editar obra · {obraEditando.codigo_obra}</h2>

            <label>
              Nombre de la obra
              <input
                required
                type="text"
                value={editForm.nombre_obra}
                onChange={(e) => setEditForm({ ...editForm, nombre_obra: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '.6rem' }}
              />
            </label>

            <label>
              Ubicación de faena
              <input
                required
                type="text"
                value={editForm.ubicacion_faena}
                onChange={(e) => setEditForm({ ...editForm, ubicacion_faena: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '.6rem' }}
              />
            </label>

            <div style={{ display: 'flex', gap: '.75rem' }}>
              <label style={{ flex: 1 }}>
                Fecha de inicio
                <input
                  required
                  type="date"
                  value={editForm.fecha_inicio}
                  onChange={(e) => setEditForm({ ...editForm, fecha_inicio: e.target.value })}
                  style={{ display: 'block', width: '100%', padding: '.6rem' }}
                />
              </label>
              <label style={{ flex: 1 }}>
                Término estimado
                <input
                  type="date"
                  value={editForm.fecha_termino_estimada}
                  onChange={(e) => setEditForm({ ...editForm, fecha_termino_estimada: e.target.value })}
                  style={{ display: 'block', width: '100%', padding: '.6rem' }}
                />
              </label>
            </div>

            <label>
              Presupuesto estimado
              <input
                required
                min="0"
                type="number"
                value={editForm.costo_estimado}
                onChange={(e) => setEditForm({ ...editForm, costo_estimado: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '.6rem' }}
              />
            </label>

            {/* Selector de Maquinarias en Edición (MongoDB) */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '.4rem' }}>
                🚜 Maquinarias asignadas (MongoDB)
              </label>
              {catalogoMaquinarias.length === 0 ? (
                <p style={{ margin: 0, fontSize: '.85rem', color: 'var(--text-muted)' }}>
                  No hay maquinarias registradas en el catálogo.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '.4rem', maxHeight: '180px', overflowY: 'auto', padding: '.5rem', background: 'var(--surface-muted, #f8fafc)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  {catalogoMaquinarias.map((maq) => {
                    const codigosActuales = editForm.maquinarias_codigos || [];
                    const seleccionada = codigosActuales.includes(maq.codigo);
                    const ocupadaPorOtra = maq.estado === 'ASIGNADA' && maq.obra_id && String(maq.obra_id) !== String(obraEditando.id_obra);

                    return (
                      <label
                        key={maq.codigo}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '.5rem',
                          fontSize: '.85rem',
                          padding: '.35rem .5rem',
                          borderRadius: '4px',
                          background: seleccionada ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          cursor: ocupadaPorOtra ? 'not-allowed' : 'pointer',
                          opacity: ocupadaPorOtra ? 0.5 : 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={ocupadaPorOtra}
                          checked={seleccionada}
                          onChange={(e) => {
                            const nuevos = e.target.checked
                              ? [...codigosActuales, maq.codigo]
                              : codigosActuales.filter((c) => c !== maq.codigo);
                            setEditForm({ ...editForm, maquinarias_codigos: nuevos });
                          }}
                        />
                        <span>
                          <strong>{maq.codigo}:</strong> {maq.nombre}
                          {ocupadaPorOtra && <small style={{ color: '#ef4444', marginLeft: '.4rem' }}>(Asignada a otra obra)</small>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setObraEditando(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary">
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {asignacionObra && (
        <div
          role="presentation"
          onClick={() => setAsignacionObra(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, .55)',
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
        >
          <form
            onSubmit={guardarAsignacion}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(440px, 100%)',
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: '12px',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h2 style={{ margin: 0 }}>Asignar técnico · {asignacionObra.codigo_obra}</h2>

            <label>
              Técnico
              <select
                required
                value={asignacionForm.tecnico}
                onChange={(e) => setAsignacionForm({ ...asignacionForm, tecnico: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '.6rem' }}
              >
                <option value="">Selecciona un técnico</option>
                {tecnicos.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '.75rem' }}>
              <label style={{ flex: 1 }}>
                Desde
                <input
                  required
                  type="date"
                  value={asignacionForm.fecha_inicio}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, fecha_inicio: e.target.value })}
                  style={{ display: 'block', width: '100%', padding: '.6rem' }}
                />
              </label>
              <label style={{ flex: 1 }}>
                Hasta
                <input
                  required
                  type="date"
                  value={asignacionForm.fecha_termino}
                  onChange={(e) => setAsignacionForm({ ...asignacionForm, fecha_termino: e.target.value })}
                  style={{ display: 'block', width: '100%', padding: '.6rem' }}
                />
              </label>
            </div>

            <label>
              Bloque horario
              <select
                required
                value={asignacionForm.bloque}
                onChange={(e) => setAsignacionForm({ ...asignacionForm, bloque: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '.6rem' }}
              >
                <option value="MANANA" disabled={bloqueOcupado('MANANA')}>
                  Mañana · 09:30–13:30
                  {bloqueOcupado('MANANA') ? ' — Ocupado' : ''}
                </option>

                <option value="TARDE" disabled={bloqueOcupado('TARDE')}>
                  Tarde · 15:00–17:00
                  {bloqueOcupado('TARDE') ? ' — Ocupado' : ''}
                </option>
              </select>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAsignacionObra(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={guardandoAsignacion || !tecnicos.length || bloqueOcupado(asignacionForm.bloque)}
              >
                {guardandoAsignacion ? 'Guardando…' : 'Confirmar asignación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
