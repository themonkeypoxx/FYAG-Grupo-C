import { useEffect, useMemo, useState } from 'react';
import obrasService from '../Servicios/obrasService';
import AuthService from '../Servicios/AuthService';

const fechaLocal = (fecha) => {
  const v alor = new Date(fecha);
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
  const [error, setError] = useState('');
  const [solicitudObra, setSolicitudObra] = useState(null);
  const [tipoSolicitud, setTipoSolicitud] = useState('SUSPENSION');
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);

  useEffect(() => {
    obrasService.getAsignaciones()
      .then(setAsignaciones)
      .catch(() => setError('No se pudieron cargar tus obras asignadas.'))
      .finally(() => setCargando(false));
  }, []);

  const abrirSolicitud = (obra) => {
    setSolicitudObra(obra);
    setTipoSolicitud('SUSPENSION');
    setMotivoSolicitud('');
  };

  const enviarSolicitud = async (event) => {
    event.preventDefault();
    setEnviandoSolicitud(true);
    try {
      await obrasService.solicitarCambioObra({
        obra: solicitudObra.obra,
        tipo: tipoSolicitud,
        motivo: motivoSolicitud.trim(),
      });
      setSolicitudObra(null);
      setError('Solicitud enviada al supervisor.');
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'No se pudo enviar la solicitud.');
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

  return <main className="main-content">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
      <div><h1 style={{ marginBottom: '.25rem' }}>Mi horario</h1><p style={{ color: 'var(--text-muted)', margin: 0 }}>Obras y turnos que te asignaron</p></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}><button className="btn-secondary" onClick={() => cambiarSemana(-1)}>← Semana anterior</button><strong>{semana.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}</strong><button className="btn-secondary" onClick={() => cambiarSemana(1)}>Semana siguiente →</button></div>
    </div>
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
          <button type="button" className="btn-secondary" onClick={() => abrirSolicitud(obra)} style={{ marginTop: '.6rem', fontSize: '.8rem' }}>
            Solicitar cambio de estado
          </button>
        </div>)}</div> : <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>Sin obras asignadas</p>}
      </article>)}
    </section>}
    {solicitudObra && <div role="presentation" onClick={() => setSolicitudObra(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, .55)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <form onSubmit={enviarSolicitud} onClick={(event) => event.stopPropagation()} style={{ width: 'min(460px, 100%)', background: 'var(--surface)', padding: '1.5rem', borderRadius: '12px', display: 'grid', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Solicitar cambio · {solicitudObra.obra_codigo}</h2>
        <label>Tipo<select required value={tipoSolicitud} onChange={(event) => setTipoSolicitud(event.target.value)} style={{ display: 'block', width: '100%', padding: '.6rem' }}><option value="SUSPENSION">Suspensión</option><option value="CANCELACION">Cancelación</option></select></label>
        <label>Motivo<textarea required minLength="5" rows="4" value={motivoSolicitud} onChange={(event) => setMotivoSolicitud(event.target.value)} placeholder="Explica por qué solicitas el cambio" style={{ display: 'block', width: '100%', padding: '.6rem' }} /></label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}><button type="button" className="btn-secondary" onClick={() => setSolicitudObra(null)}>Cancelar</button><button type="submit" className="btn-primary" disabled={enviandoSolicitud}>{enviandoSolicitud ? 'Enviando…' : 'Enviar solicitud'}</button></div>
      </form>
    </div>}
  </main>;
}
