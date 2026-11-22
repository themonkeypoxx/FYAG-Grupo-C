import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import authService from '../Servicios/authService';
import presupuestosService from '../Servicios/presupuestosService';

export default function Navbar() {
  const location = useLocation();
  const esTecnico = authService.tieneRol('Tecnico');
  const esAdministrativo = authService.tieneRol('Administrativo');
  const esGerencial = authService.tieneRol('Gerencial');
  const esSupervisor = authService.tieneRol('Supervisor');
  const usuario = authService.getUsuario();

  const [notificaciones, setNotificaciones] = useState([]);
  const [mostrarNotifs, setMostrarNotifs] = useState(false);
  const [procesandoNotifId, setProcesandoNotifId] = useState(null);
  const notifRef = useRef(null);

  const cargarNotificaciones = async () => {
    if (!esGerencial) return;
    try {
      const data = await presupuestosService.getNotificacionesPresupuesto();
      setNotificaciones(Array.isArray(data) ? data : data?.results || []);
    } catch {
      // Silenciar errores temporales de conexión
    }
  };

  useEffect(() => {
    if (!esGerencial) return;
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 30000);
    return () => clearInterval(interval);
  }, [esGerencial]);

  useEffect(() => {
    const handleClickAfuera = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setMostrarNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);
    return () => document.removeEventListener('mousedown', handleClickAfuera);
  }, []);

  const noLeidas = notificaciones.filter((n) => !n.leida);

  const handleAprobarDesdeNotif = async (n) => {
    try {
      setProcesandoNotifId(n.id);
      await presupuestosService.aprobarPresupuesto(n.presupuesto);
      await cargarNotificaciones();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'No se pudo aprobar el presupuesto.');
    } finally {
      setProcesandoNotifId(null);
    }
  };

  const handleRechazarDesdeNotif = async (n) => {
    const motivo = window.prompt(`Ingrese el motivo del rechazo para el presupuesto ${n.presupuesto_numero}:`, '');
    if (motivo === null) return;
    try {
      setProcesandoNotifId(n.id);
      await presupuestosService.rechazarPresupuesto(n.presupuesto, motivo);
      await cargarNotificaciones();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'No se pudo rechazar el presupuesto.');
    } finally {
      setProcesandoNotifId(null);
    }
  };

  const handleMarcarLeida = async (id) => {
    try {
      await presupuestosService.marcarNotificacionLeida(id);
      setNotificaciones((prev) => prev.map((item) => (item.id === id ? { ...item, leida: true } : item)));
    } catch {
      // ignore
    }
  };

  const handleMarcarTodasLeidas = async () => {
    try {
      await presupuestosService.marcarTodasNotificacionesLeidas();
      setNotificaciones((prev) => prev.map((item) => ({ ...item, leida: true })));
    } catch {
      // ignore
    }
  };

  const formatearCLP = (monto) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(monto || 0);
  };

  const handleLogout = () => {
    authService.logout();
  };

  const puedeAccederFinanzas = esGerencial || esAdministrativo;

  const rutaInicio = esTecnico
    ? '/vista-tecnico'
    : esAdministrativo && !esGerencial
      ? '/vista-administrativo'
      : '/dashboard-obras';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={rutaInicio} className="brand">
          <div className="brand-logo">FYAG</div>
          <div className="brand-text">
            <h1>Gestión de Obras</h1>
            <span>Climatización &amp; Servicios Industriales</span>
          </div>
        </Link>

        <nav className="nav-links">
          {esTecnico && (
            <Link
              to="/vista-tecnico"
              className={`nav-link ${location.pathname === '/vista-tecnico' ? 'active' : ''}`}
            >
              Mi horario
            </Link>
          )}

          {esAdministrativo && (
            <Link
              to="/vista-administrativo"
              className={`nav-link ${location.pathname === '/vista-administrativo' ? 'active' : ''}`}
            >
              Panel Administrativo
            </Link>
          )}

          {(esGerencial || esSupervisor) && (
            <Link
              to="/dashboard-obras"
              className={`nav-link ${location.pathname === '/dashboard-obras' ? 'active' : ''}`}
            >
              Obras
            </Link>
          )}

          {puedeAccederFinanzas && (
            <Link
              to="/resumen-financiero"
              className={`nav-link ${location.pathname === '/resumen-financiero' ? 'active' : ''}`}
            >
              Resumen Financiero
            </Link>
          )}

          {puedeAccederFinanzas && (
            <Link
              to="/nuevo-presupuesto"
              className={`nav-link ${location.pathname === '/nuevo-presupuesto' ? 'active' : ''}`}
            >
              + Presupuesto
            </Link>
          )}
                    {esGerencial && (
            <Link
              to="/usuarios"
              className={`nav-link ${location.pathname === '/usuarios' ? 'active' : ''}`}
            >
              Usuarios
            </Link>
          )}

          {(esGerencial || esSupervisor) && (
            <Link to="/nueva-obra" className="btn-primary">
              + Nueva Obra
            </Link>
          )}

          {/* CENTRO DE NOTIFICACIONES PARA GERENTE */}
          {esGerencial && (
            <div className="navbar-notif-container" ref={notifRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn-notif"
                onClick={() => setMostrarNotifs((prev) => !prev)}
                title="Notificaciones de Presupuestos"
                style={{
                  position: 'relative',
                  background: mostrarNotifs ? 'var(--primary-light, #e0e7ff)' : 'transparent',
                  border: '1px solid var(--border, #cbd5e1)',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-main, #0f172a)',
                  transition: 'background 0.2s ease',
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {noLeidas.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      borderRadius: '9999px',
                      minWidth: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      border: '2px solid var(--surface, #ffffff)',
                    }}
                  >
                    {noLeidas.length > 9 ? '9+' : noLeidas.length}
                  </span>
                )}
              </button>

              {mostrarNotifs && (
                <div
                  className="notif-dropdown"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '46px',
                    width: '380px',
                    maxWidth: '90vw',
                    backgroundColor: 'var(--surface, #ffffff)',
                    border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border, #e2e8f0)',
                      backgroundColor: 'var(--surface-alt, #f8fafc)',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.875rem' }}>Presupuestos por Aprobar</strong>
                      {noLeidas.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#dc2626', marginLeft: '0.5rem', fontWeight: 600 }}>
                          ({noLeidas.length} pendiente{noLeidas.length > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    {noLeidas.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarcarTodasLeidas}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary, #2563eb)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        Marcar todas leídas
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {notificaciones.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>
                        No hay notificaciones de presupuestos.
                      </div>
                    ) : (
                      notificaciones.map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: '0.85rem 1rem',
                            borderBottom: '1px solid var(--border, #f1f5f9)',
                            backgroundColor: n.leida ? 'transparent' : '#f0fdf4',
                            transition: 'background 0.2s',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--primary, #1e40af)' }}>
                              {n.presupuesto_numero}
                            </strong>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                              {new Date(n.creada_en).toLocaleDateString('es-CL', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-main, #334155)', marginBottom: '0.35rem' }}>
                            {n.mensaje}
                          </div>

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', marginBottom: '0.5rem' }}>
                            Cliente: <strong>{n.cliente_nombre}</strong> · Obra: <strong>{n.obra_codigo}</strong> · Monto: <strong>{formatearCLP(n.presupuesto_total)}</strong>
                          </div>

                          {/* Acciones de aprobación / rechazo directo */}
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                            {n.presupuesto_estado !== 'Aprobado' && n.presupuesto_estado !== 'Rechazado' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAprobarDesdeNotif(n)}
                                  disabled={procesandoNotifId === n.id}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '0.25rem 0.6rem',
                                    backgroundColor: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  ✓ Aprobar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRechazarDesdeNotif(n)}
                                  disabled={procesandoNotifId === n.id}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '0.25rem 0.6rem',
                                    backgroundColor: '#dc2626',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  ✕ Rechazar
                                </button>
                              </>
                            )}
                            {n.presupuesto_estado === 'Aprobado' && (
                              <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                                ● Ya Aprobado
                              </span>
                            )}
                            {n.presupuesto_estado === 'Rechazado' && (
                              <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>
                                ● Rechazado
                              </span>
                            )}
                            {!n.leida && (
                              <button
                                type="button"
                                onClick={() => handleMarcarLeida(n.id)}
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.2rem 0.4rem',
                                  backgroundColor: 'transparent',
                                  border: '1px solid var(--border, #cbd5e1)',
                                  color: 'var(--text-muted, #64748b)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  marginLeft: 'auto',
                                }}
                              >
                                Marcar leída
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div
                    style={{
                      padding: '0.6rem',
                      textAlign: 'center',
                      borderTop: '1px solid var(--border, #e2e8f0)',
                      backgroundColor: 'var(--surface-alt, #f8fafc)',
                    }}
                  >
                    <Link
                      to="/vista-administrativo"
                      onClick={() => setMostrarNotifs(false)}
                      style={{ fontSize: '0.75rem', color: 'var(--primary, #2563eb)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      Ir a Gestión de Presupuestos →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="navbar-user">
            {usuario?.username && (
              <span className="navbar-username" title={usuario.email || usuario.username}>
                {usuario.username}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="btn-logout"
              title="Cerrar sesión"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}