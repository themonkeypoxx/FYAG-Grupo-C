import { useEffect, useMemo, useState } from 'react';
import obrasService from '../Servicios/obrasService';
import AuthService from '../Servicios/AuthService';

const fechaLocal = (fecha) => {
  const valor = new Date(fecha);
  valor.setHours(12, 0, 0, 0);
  return valor;
};

export default function VistaTecnico() {
  const [asignaciones, setAsignaciones] = useState([]);
  const [semana, setSemana] = useState(() => {
    const hoy = new Date();
    hoy.setHours(12, 0, 0, 0);
    hoy.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    return hoy;
  });
  const [cargando, setCargando] = useState(true);
  const [solicitudObra, setSolicitudObra] = useState(null);
  const [tipoSolicitud, setTipoSolicitud] = useState('SUSPENSION');
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [error, setError] = useState('');   // solo error de carga, 
  const [aviso, setAviso] = useState(null);    // aviso de solicitud enviada
  const [pestana, setPestana] = useState('HORARIO');
  const [notificaciones, setNotificaciones] = useState([]);
 //se separan para evitar q se borre le horario cndo hay un aviso - Ismael
  useEffect(() => {
    Promise.all([obrasService.getAsignaciones(), obrasService.getNotificacionesTecnico()])
      .then(([lista, avisos]) => {
        setAsignaciones(lista);
        setNotificaciones(Array.isArray(avisos) ? avisos : avisos?.results || []);
      })
      .catch(() => setError('No se pudieron cargar tus obras asignadas.'))
      .finally(() => setCargando(false));
  }, []);

  const iniciarObra = async (obra) => {
    try {
      await obrasService.cambiarEstado(obra.obra, 'EJECUCION');
      setAviso({ tipo: 'ok', texto: `${obra.obra_codigo} pasó a En ejecución.` });
      const lista = await obrasService.getAsignaciones();
      setAsignaciones(lista);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err.response?.data?.error || 'No se pudo iniciar la obra.' });
    }
  };

  const abrirSolicitud = (obra) => {
    setSolicitudObra(obra);
    setTipoSolicitud(obra.estado_obra_codigo === 'SUSPENDIDA' ? 'REANUDACION' : 'SUSPENSION');
    setMotivoSolicitud('');
  };

  const enviarSolicitud = async (event) => {
    event.preventDefault();
    setEnviandoSolicitud(true);
    setAviso(null);
    try {
      await obrasService.solicitarCambioObra({
        obra: solicitudObra.obra,
        tipo: tipoSolicitud,
        motivo: motivoSolicitud.trim(),
      });
      setSolicitudObra(null);
      setAviso({ tipo: 'ok', texto: 'Solicitud enviada al supervisor.' });
    } catch (err) {
      setAviso({
        tipo: 'error',
        texto:
          err.response?.data?.detail ||
          err.response?.data?.non_field_errors?.[0] ||
          'No se pudo enviar la solicitud.',
      });
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const dias = useMemo(() => Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(semana);
    fecha.setDate(fecha.getDate() + indice);
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
    return { fecha, clave, obras: asignaciones.filter((a) => a.fecha === clave).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)) };
  }), [semana, asignaciones]);

  const cambiarSemana = (paso) => setSemana((actual) => {
    const nueva = new Date(actual);
    nueva.setDate(nueva.getDate() + paso * 7);
    return nueva;
  });
  const formatoDia = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  const tiposObra = [
    { codigo: 'CLIMATIZACION', nombre: 'Climatización', color: 'var(--tipo-clima)' },
    { codigo: 'MANTENCION', nombre: 'Mantención', color: 'var(--tipo-mant)' },
    { codigo: 'PROY_ELECTRICO', nombre: 'Proyecto eléctrico', color: 'var(--tipo-elec)' },
    { codigo: 'EMERGENCIA', nombre: 'Emergencia', color: 'var(--tipo-emerg)' },
    { codigo: 'GARANTIA', nombre: 'Garantía', color: 'var(--tipo-garan)' },
    { codigo: 'PROYECTO', nombre: 'Proyecto', color: 'var(--tipo-proy)' },
  ];
  const estadosObra = [
    { codigo: 'PENDIENTE', nombre: 'Pendiente', borde: 'var(--estado-pendiente)', fondo: 'var(--estado-pendiente-bg)' },
    { codigo: 'EJECUCION', nombre: 'En ejecución', borde: 'var(--estado-ejecucion)', fondo: 'var(--estado-ejecucion-bg)' },
    { codigo: 'SUSPENDIDA', nombre: 'Suspendida', borde: 'var(--estado-suspendida)', fondo: 'var(--estado-suspendida-bg)' },
    { codigo: 'FINALIZADA', nombre: 'Finalizada', borde: 'var(--estado-finalizada)', fondo: 'var(--estado-finalizada-bg)' },
    { codigo: 'CANCELADA', nombre: 'Cancelada', borde: 'var(--estado-cancelada)', fondo: 'var(--estado-cancelada-bg)' },
  ];

  return <main className="main-content" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
    <nav aria-label="Secciones del técnico" style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
      <button className={pestana === 'HORARIO' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPestana('HORARIO')}>Mi horario</button>
      <button className={pestana === 'NOTIFICACIONES' ? 'btn-primary' : 'btn-secondary'} onClick={() => setPestana('NOTIFICACIONES')}>Notificaciones{notificaciones.some((n) => !n.leida) ? ` (${notificaciones.filter((n) => !n.leida).length})` : ''}</button>
    </nav>
    {pestana === 'NOTIFICACIONES' ? <section aria-label="Notificaciones de obras">
      <h1>Notificaciones</h1>
      {notificaciones.length ? notificaciones.map((n) => <article key={n.id} style={{ padding: '1rem', marginBottom: '.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <strong>{n.obra_codigo} · {n.obra_nombre}</strong>
        <p>La obra fue {({ CANCELADA: 'cancelada', SUSPENDIDA: 'suspendida', FINALIZADA: 'finalizada' })[n.estado_codigo] || n.estado_descripcion}.</p>
        <small>{new Date(n.creada_en).toLocaleString('es-CL')}</small>
      </article>) : <p>No tienes notificaciones.</p>}
    </section> : <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
      <div><h1 style={{ marginBottom: '.25rem' }}>Mi horario</h1><p style={{ color: 'var(--text-muted)', margin: 0 }}>Obras y turnos que te asignaron</p></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}><button className="btn-secondary" onClick={() => cambiarSemana(-1)}>← Semana anterior</button><strong>{semana.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}</strong><button className="btn-secondary" onClick={() => cambiarSemana(1)}>Semana siguiente →</button></div>
      {aviso && (
      <p role={aviso.tipo === 'error' ? 'alert' : 'status'}
      style={{ color: aviso.tipo === 'error' ? 'var(--danger, #b91c1c)' : 'var(--success, #15803d)', marginBottom: '1rem' }}>
      {aviso.texto}
      </p>
)}
    </div>
    <section aria-label="Leyenda de colores del horario" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '.85rem 1rem' }}>
        <h2 style={{ fontSize: '.95rem', margin: '0 0 .65rem' }}>Bolita: tipo de obra</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.55rem .9rem' }}>
          {tiposObra.map((tipo) => (
            <span key={tipo.codigo} style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.82rem' }}>
              <span aria-hidden="true" style={{ width: '.65rem', height: '.65rem', borderRadius: '50%', background: tipo.color, flex: '0 0 auto' }} />
              {tipo.nombre}
            </span>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '.85rem 1rem' }}>
        <h2 style={{ fontSize: '.95rem', margin: '0 0 .65rem' }}>Color del bloque: estado operativo</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.55rem .9rem' }}>
          {estadosObra.map((estado) => (
            <span key={estado.codigo} style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.82rem' }}>
              <span aria-hidden="true" style={{ width: '.85rem', height: '.85rem', borderLeft: `4px solid ${estado.borde}`, borderRadius: '2px', background: estado.fondo, flex: '0 0 auto' }} />
              {estado.nombre}
            </span>
          ))}
        </div>
      </div>
    </section>
    {cargando ? <p>Cargando horario…</p> : error ? <p role="alert">{error}</p> : <section aria-label="Horario semanal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '.85rem' }}>
      {dias.map(({ fecha, clave, obras }) => <article key={clave} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', minHeight: '190px' }}>
        <h2 style={{ fontSize: '1rem', textTransform: 'capitalize', margin: '0 0 .9rem' }}>{formatoDia.format(fecha)}</h2>
        {obras.length ? <div className="horario-obras">{obras.map((obra) => <div
          key={obra.id_asignacion}
          className={`horario-card ${obra.estado_obra_codigo || ''}`}
        >
          <span
            className={`tipo-indicador ${obra.tipo_servicio_codigo || ''}`}
            title={`Tipo de obra: ${obra.tipo_servicio_nombre || 'No especificado'}`}
            aria-label={`Tipo de obra: ${obra.tipo_servicio_nombre || 'No especificado'}`}
          />
          <strong>{obra.hora_inicio.slice(0, 5)}–{obra.hora_termino.slice(0, 5)}</strong>
          <div className="horario-card-title">{obra.obra_codigo} · {obra.obra_nombre}</div>
          <small>{obra.ubicacion_faena}</small>
          {!['FINALIZADA', 'CANCELADA'].includes(obra.estado_obra_codigo) && (
            <button type="button" className="btn-secondary" onClick={() => abrirSolicitud(obra)} style={{ marginTop: '.6rem', fontSize: '.8rem' }}>
              Solicitar cambio de estado
            </button>
          )}
          {obra.estado_obra_codigo === 'PENDIENTE' && <button type="button" className="btn-primary" onClick={() => iniciarObra(obra)} style={{ marginTop: '.6rem', fontSize: '.8rem' }}>Iniciar obra</button>}
        </div>)}</div> : <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Sin obras asignadas</p>}
      </article>)}
    </section>}
    {solicitudObra && <div role="presentation" onClick={() => setSolicitudObra(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .55)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <form onSubmit={enviarSolicitud} onClick={(event) => event.stopPropagation()} style={{ width: 'min(460px, 100%)', background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Solicitar cambio · {solicitudObra.obra_codigo}</h2>
        <label>Tipo<select required value={tipoSolicitud} onChange={(event) => setTipoSolicitud(event.target.value)} style={{ display: 'block', width: '100%', padding: '.6rem' }}>
          {solicitudObra.estado_obra_codigo === 'SUSPENDIDA' ? (
            <>
              <option value="REANUDACION">Reanudar: pasar a En ejecución</option>
              <option value="CANCELACION">Cancelar</option>
            </>
          ) : (
            <>
              {solicitudObra.estado_obra_codigo === 'EJECUCION' && <option value="SUSPENSION">Suspender</option>}
              <option value="CANCELACION">Cancelar</option>
            </>
          )}
        </select></label>
        <label>Motivo<textarea required minLength="5" rows="4" value={motivoSolicitud} onChange={(event) => setMotivoSolicitud(event.target.value)} placeholder="Explica por qué solicitas el cambio" style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}><button type="button" className="btn-secondary" onClick={() => setSolicitudObra(null)}>Cancelar</button><button type="submit" className="btn-primary" disabled={enviandoSolicitud}>{enviandoSolicitud ? 'Enviando…' : 'Enviar solicitud'}</button></div>
      </form>
    </div>}
    </>}
  </main>;
}
