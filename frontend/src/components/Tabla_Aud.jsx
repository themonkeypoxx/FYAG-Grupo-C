import React, { useState, useEffect } from 'react';
import auditService from '../Servicios/auditService';

// diccionario d colores
const BADGES_ACCION = {
    CREAR: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    EDITAR: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    ELIMINAR: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    ASIGNAR_MAQUINARIA: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    CAMBIO_ESTADO: { bg: '#faf5ff', color: '#7c3aed', border: '#e9d5ff' },
    DESCONOCIDO: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

/////////
const formatearFecha = (isoString) => {
    if (!isoString) return '-';
    try {
        const fecha = new Date(isoString);
        return new Intl.DateTimeFormat('es-CL', {
            dateStyle: 'short',
            timeStyle: 'medium',
        }).format(fecha);
    } catch {
        return String(isoString);
    }
};
///////////////
// la tabla
export default function Tabla_Aud() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    // filtros
    const [filtroAccion, setFiltroAccion] = useState('');
    const [filtroUsuario, setFiltroUsuario] = useState('');

    // modal para ver el JSON de detalles
    const [logSeleccionado, setLogSeleccionado] = useState(null);

    const cargarLogs = async () => {
        setCargando(true);
        setError(null);
        try {
            const params = {
                limite: 50,
                salto: 0,
            };
            if (filtroAccion) params.accion = filtroAccion;
            if (filtroUsuario.trim()) params.usuario = filtroUsuario.trim();

            const data = await auditService.getLogs(params);
            setLogs(data.registros || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Error al cargar auditoría:', err);
            setError('No se pudo cargar el registro de auditoría. Verifique su conexión y permisos.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarLogs();
    }, [filtroAccion]);

    const handleBuscarUsuario = (e) => {
        e.preventDefault();
        cargarLogs();
    };

    const obtenerEstiloBadge = (accion) => {
        const clave = (accion || '').toUpperCase();
        return BADGES_ACCION[clave] || BADGES_ACCION.DESCONOCIDO;
    };

    return (
        <div className="admin-card" style={{ marginTop: '1.5rem' }}>
            {/* Encabezado*/}
            <div className="admin-card-header">
                <div>
                    <h2 className="admin-card-title">Historial de Auditoría (MongoDB)</h2>
                    <p className="admin-card-subtitle">
                        Registro de actividades críticas y modificaciones en el sistema. Total de eventos: <strong>{total}</strong>
                    </p>
                </div>
                <button
                    type="button"
                    className="btn-export-pdf"
                    style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px' }}
                    onClick={cargarLogs}
                    disabled={cargando}
                >
                    {cargando ? 'Actualizando...' : '↻ Actualizar'}
                </button>
            </div>

            {/* Barra de filtrossss */}
            <div className="admin-filters-bar" style={{ marginBottom: '1rem' }}>
                <div className="admin-filter-group">
                    <label className="admin-filter-label" htmlFor="filtro-accion">Acción:</label>
                    <select
                        id="filtro-accion"
                        value={filtroAccion}
                        onChange={(e) => setFiltroAccion(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                        <option value="">Todas las acciones</option>
                        <option value="CREAR">CREAR</option>
                        <option value="EDITAR">EDITAR</option>
                        <option value="ELIMINAR">ELIMINAR</option>
                        <option value="ASIGNAR_MAQUINARIA">ASIGNAR_MAQUINARIA</option>
                        <option value="CAMBIO_ESTADO">CAMBIO_ESTADO</option>
                    </select>
                </div>

                <form onSubmit={handleBuscarUsuario} className="admin-filter-group">
                    <label className="admin-filter-label" htmlFor="filtro-usuario">Usuario:</label>
                    <input
                        id="filtro-usuario"
                        type="text"
                        className="admin-search-input"
                        placeholder="Buscar por username..."
                        value={filtroUsuario}
                        onChange={(e) => setFiltroUsuario(e.target.value)}
                        style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    />
                    <button
                        type="submit"
                        className="btn-aprobar-pres"
                        style={{ backgroundColor: '#1e40af', padding: '0.45rem 0.8rem' }}
                    >
                        Buscar
                    </button>
                </form>
            </div>

            {/* Manejo de error */}
            {error && (
                <div className="admin-alert admin-alert-error" style={{ marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            {/* Tabla de registros */}
            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th style={{ width: '170px' }}>Fecha y Hora</th>
                            <th>Usuario</th>
                            <th>Acción</th>
                            <th>Recurso</th>
                            <th>ID Recurso</th>
                            <th style={{ textAlign: 'center' }}>Detalles</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargando ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                    Cargando registros de auditoría desde MongoDB...
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                    No se encontraron eventos registrados con los criterios seleccionados.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => {
                                const badge = obtenerEstiloBadge(log.accion);
                                return (
                                    <tr key={log.id || log._id}>
                                        <td>
                                            <strong>{formatearFecha(log.timestamp)}</strong>
                                        </td>
                                        <td>
                                            <div>
                                                <strong>{log.usuario}</strong>
                                            </div>
                                            {log.ip && (
                                                <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                                    IP: {log.ip}
                                                </small>
                                            )}
                                        </td>
                                        <td>
                                            <span
                                                style={{
                                                    backgroundColor: badge.bg,
                                                    color: badge.color,
                                                    border: `1px solid ${badge.border}`,
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    display: 'inline-block',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {log.accion}
                                            </span>
                                        </td>
                                        <td>{log.recurso || '-'}</td>
                                        <td>
                                            <code style={{ fontSize: '0.8rem', backgroundColor: '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                                                {log.recurso_id || '-'}
                                            </code>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => setLogSeleccionado(log)}
                                                style={{
                                                    backgroundColor: '#f8fafc',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '6px',
                                                    padding: '0.3rem 0.6rem',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    color: '#334155',
                                                }}
                                            >
                                                Ver detalles
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Detalles BSON / JSON */}
            {logSeleccionado && (
                <div className="modal-overlay" onClick={() => setLogSeleccionado(null)}>
                    <div
                        className="modal-content"
                        style={{ maxWidth: '650px', backgroundColor: '#ffffff' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                                Detalles del Evento ({logSeleccionado.accion})
                            </h3>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => setLogSeleccionado(null)}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="modal-body" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                            <div style={{ marginBottom: '1rem', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                <p style={{ margin: '0.25rem 0' }}>
                                    <strong>Fecha:</strong> {formatearFecha(logSeleccionado.timestamp)}
                                </p>
                                <p style={{ margin: '0.25rem 0' }}>
                                    <strong>Usuario:</strong> {logSeleccionado.usuario} (ID: {logSeleccionado.usuario_id || 'N/A'})
                                </p>
                                <p style={{ margin: '0.25rem 0' }}>
                                    <strong>IP de origen:</strong> {logSeleccionado.ip || 'No registrada'}
                                </p>
                                <p style={{ margin: '0.25rem 0' }}>
                                    <strong>Recurso:</strong> {logSeleccionado.recurso} &bull; <strong>ID:</strong> {logSeleccionado.recurso_id}
                                </p>
                            </div>

                            <div>
                                <strong>Carga de datos / Cambios registrados:</strong>
                                <pre
                                    style={{
                                        backgroundColor: '#0f172a',
                                        color: '#38bdf8',
                                        padding: '1rem',
                                        borderRadius: '8px',
                                        fontSize: '0.82rem',
                                        overflowX: 'auto',
                                        marginTop: '0.5rem',
                                    }}
                                >
                                    {logSeleccionado.detalles && Object.keys(logSeleccionado.detalles).length > 0
                                        ? JSON.stringify(logSeleccionado.detalles, null, 2)
                                        : '// No hay detalles adicionales registrados para este evento.'}
                                </pre>
                            </div>
                        </div>

                        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                            <button
                                type="button"
                                onClick={() => setLogSeleccionado(null)}
                                style={{
                                    padding: '0.45rem 1rem',
                                    backgroundColor: '#64748b',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
