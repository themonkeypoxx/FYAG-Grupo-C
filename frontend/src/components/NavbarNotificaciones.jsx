import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import presupuestosService from '../Servicios/presupuestosService';
import obrasService from '../Servicios/obrasService';
import ModalConfirmacion from './ModalConfirmacion';

const formatearCLP = (monto) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto || 0);
};

export default function NavbarNotificaciones({ esGerencial, esSupervisor, esTecnico }) {
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Estados de Gerente (Presupuestos)
  const [notifsPresupuesto, setNotifsPresupuesto] = useState([]);
  const [procesandoPresupuestoId, setProcesandoPresupuestoId] = useState(null);

  // Estados de Supervisor (Solicitudes de Técnicos)
  const [solicitudesSupervisor, setSolicitudesSupervisor] = useState([]);
  const [procesandoSolicitudId, setProcesandoSolicitudId] = useState(null);

  // Estados de Técnico (Notificaciones de Obras)
  const [notifsTecnico, setNotifsTecnico] = useState([]);

  // Modal de confirmación para rechazar presupuesto o solicitud
  const [modalConfirmacion, setModalConfirmacion] = useState({
    isOpen: false,
    titulo: '',
    mensaje: '',
    onConfirmar: null,
    tipo: 'peligro',
    textoConfirmar: 'Confirmar',
    requiereMotivo: false,
    labelMotivo: 'Motivo:',
    placeholderMotivo: '',
    cargando: false,
  });

  // Pestaña activa en el dropdown si tiene múltiples roles
  const [seccionActiva, setSeccionActiva] = useState(
    esGerencial ? 'presupuestos' : esSupervisor ? 'solicitudes' : 'tecnico'
  );

  // -------------------------------------------------------------
  // CARGA DE DATOS
  // -------------------------------------------------------------
  const cargarNotificaciones = async () => {
    try {
      if (esGerencial) {
        const data = await presupuestosService.getNotificacionesPresupuesto();
        setNotifsPresupuesto(Array.isArray(data) ? data : data?.results || []);
      }
      if (esSupervisor) {
        const data = await obrasService.getSolicitudesCambio();
        const lista = Array.isArray(data) ? data : data?.results || [];
        setSolicitudesSupervisor(lista.filter((s) => s.estado === 'PENDIENTE'));
      }
      if (esTecnico) {
        const data = await obrasService.getNotificacionesTecnico();
        setNotifsTecnico(Array.isArray(data) ? data : data?.results || []);
      }
    } catch {
      // Ignorar fallas temporales de red
    }
  };

  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 25000);
    return () => clearInterval(interval);
  }, [esGerencial, esSupervisor, esTecnico]);

  useEffect(() => {
    const handleClickAfuera = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMostrarDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickAfuera);
    return () => document.removeEventListener('mousedown', handleClickAfuera);
  }, []);

  // -------------------------------------------------------------
  // CÁLCULO DE PENDIENTES
  // -------------------------------------------------------------
  const presupuestosNoLeidos = notifsPresupuesto.filter((n) => !n.leida);
  const solicitudesPendientes = solicitudesSupervisor;
  const tecnicoNoLeidas = notifsTecnico.filter((n) => !n.leida);

  let totalBadge = 0;
  if (esGerencial) totalBadge += presupuestosNoLeidos.length;
  if (esSupervisor) totalBadge += solicitudesPendientes.length;
  if (esTecnico) totalBadge += tecnicoNoLeidas.length;

  // Si no tiene ninguno de estos roles, no se muestra nada
  if (!esGerencial && !esSupervisor && !esTecnico) return null;

  // -------------------------------------------------------------
  // ACCIONES GERENCIALES (PRESUPUESTOS)
  // -------------------------------------------------------------
  const handleAprobarPresupuesto = async (n) => {
    try {
      setProcesandoPresupuestoId(n.id);
      await presupuestosService.aprobarPresupuesto(n.presupuesto);
      await cargarNotificaciones();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'No se pudo aprobar el presupuesto.');
    } finally {
      setProcesandoPresupuestoId(null);
    }
  };

  const handleRechazarPresupuesto = (n) => {
    setModalConfirmacion({
      isOpen: true,
      titulo: 'Rechazar Presupuesto',
      mensaje: `¿Confirma que desea rechazar el presupuesto ${n.presupuesto_numero}? Ingrese el motivo correspondiente:`,
      tipo: 'peligro',
      textoConfirmar: 'Rechazar Presupuesto',
      requiereMotivo: true,
      labelMotivo: 'Motivo del rechazo *',
      placeholderMotivo: 'Explique la razón del rechazo...',
      cargando: false,
      onConfirmar: async (motivo) => {
        try {
          setModalConfirmacion((prev) => ({ ...prev, cargando: true }));
          setProcesandoPresupuestoId(n.id);
          await presupuestosService.rechazarPresupuesto(n.presupuesto, motivo);
          await cargarNotificaciones();
          setModalConfirmacion((prev) => ({ ...prev, isOpen: false, cargando: false }));
        } catch (err) {
          alert(err.response?.data?.detail || err.response?.data?.error || 'No se pudo rechazar el presupuesto.');
        } finally {
          setProcesandoPresupuestoId(null);
          setModalConfirmacion((prev) => ({ ...prev, cargando: false }));
        }
      },
    });
  };

  const handleMarcarPresupuestoLeida = async (id) => {
    try {
      await presupuestosService.marcarNotificacionLeida(id);
      setNotifsPresupuesto((prev) => prev.map((item) => (item.id === id ? { ...item, leida: true } : item)));
    } catch {
      // ignore
    }
  };

  const handleMarcarTodosPresupuestosLeidos = async () => {
    try {
      await presupuestosService.marcarTodasNotificacionesLeidas();
      setNotifsPresupuesto((prev) => prev.map((item) => ({ ...item, leida: true })));
    } catch {
      // ignore
    }
  };

  // -------------------------------------------------------------
  // ACCIONES DE SUPERVISOR (SOLICITUDES DE TÉCNICOS)
  // -------------------------------------------------------------
  const handleResolverSolicitud = (solicitud, accion) => {
    if (accion === 'RECHAZAR') {
      setModalConfirmacion({
        isOpen: true,
        titulo: 'Rechazar Solicitud',
        mensaje: `Ingrese el motivo para rechazar la solicitud de ${solicitud.tecnico_nombre}:`,
        tipo: 'peligro',
        textoConfirmar: 'Rechazar Solicitud',
        requiereMotivo: true,
        labelMotivo: 'Motivo del rechazo *',
        placeholderMotivo: 'Explique la razón del rechazo...',
        cargando: false,
        onConfirmar: async (respuesta) => {
          try {
            setModalConfirmacion((prev) => ({ ...prev, cargando: true }));
            setProcesandoSolicitudId(solicitud.id_solicitud);
            await obrasService.resolverSolicitudCambio(solicitud.id_solicitud, accion, respuesta);
            await cargarNotificaciones();
            setModalConfirmacion((prev) => ({ ...prev, isOpen: false, cargando: false }));
          } catch (err) {
            alert(err.response?.data?.detail || err.response?.data?.error || 'No se pudo resolver la solicitud.');
          } finally {
            setProcesandoSolicitudId(null);
            setModalConfirmacion((prev) => ({ ...prev, cargando: false }));
          }
        },
      });
      return;
    }

    ejecutarResolucion(solicitud, accion, '');
  };

  const ejecutarResolucion = async (solicitud, accion, respuesta) => {
    try {
      setProcesandoSolicitudId(solicitud.id_solicitud);
      await obrasService.resolverSolicitudCambio(solicitud.id_solicitud, accion, respuesta);
      await cargarNotificaciones();
    } catch (err) {
      alert(err.response?.data?.detail || err.response?.data?.error || 'No se pudo resolver la solicitud.');
    } finally {
      setProcesandoSolicitudId(null);
    }
  };

  // -------------------------------------------------------------
  // ACCIONES DE TÉCNICO (NOTIFICACIONES DE OBRAS)
  // -------------------------------------------------------------
  const handleMarcarTecnicoLeida = async (id) => {
    try {
      await obrasService.marcarNotificacionTecnicoLeida(id);
      setNotifsTecnico((prev) => prev.map((item) => (item.id === id ? { ...item, leida: true } : item)));
    } catch {
      // ignore
    }
  };

  const handleMarcarTodasTecnicoLeidas = async () => {
    try {
      await obrasService.marcarTodasNotificacionesTecnicoLeidas();
      setNotifsTecnico((prev) => prev.map((item) => ({ ...item, leida: true })));
    } catch {
      // ignore
    }
  };

  const rolesActivosCount = [esGerencial, esSupervisor, esTecnico].filter(Boolean).length;

  return (
    <div className="navbar-notif-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-notif"
        onClick={() => setMostrarDropdown((prev) => !prev)}
        title="Notificaciones"
        style={{
          position: 'relative',
          background: mostrarDropdown ? 'var(--primary-light, #e0e7ff)' : 'transparent',
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

        {totalBadge > 0 && (
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
            {totalBadge > 9 ? '9+' : totalBadge}
          </span>
        )}
      </button>

      {mostrarDropdown && (
        <div
          className="notif-dropdown"
          style={{
            position: 'absolute',
            right: 0,
            top: '46px',
            width: '400px',
            maxWidth: '92vw',
            backgroundColor: 'var(--surface, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1050,
            overflow: 'hidden',
          }}
        >
          {/* Header con pestañas si tiene múltiples roles */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              backgroundColor: 'var(--surface-alt, #f8fafc)',
            }}
          >
            {rolesActivosCount > 1 ? (
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {esGerencial && (
                  <button
                    type="button"
                    onClick={() => setSeccionActiva('presupuestos')}
                    style={{
                      flex: 1,
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: seccionActiva === 'presupuestos' ? 700 : 500,
                      background: seccionActiva === 'presupuestos' ? '#ffffff' : 'transparent',
                      border: '1px solid',
                      borderColor: seccionActiva === 'presupuestos' ? 'var(--primary, #2563eb)' : 'transparent',
                      color: seccionActiva === 'presupuestos' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    💰 Presupuestos ({presupuestosNoLeidos.length})
                  </button>
                )}
                {esSupervisor && (
                  <button
                    type="button"
                    onClick={() => setSeccionActiva('solicitudes')}
                    style={{
                      flex: 1,
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: seccionActiva === 'solicitudes' ? 700 : 500,
                      background: seccionActiva === 'solicitudes' ? '#ffffff' : 'transparent',
                      border: '1px solid',
                      borderColor: seccionActiva === 'solicitudes' ? 'var(--primary, #2563eb)' : 'transparent',
                      color: seccionActiva === 'solicitudes' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    📋 Solicitudes ({solicitudesPendientes.length})
                  </button>
                )}
                {esTecnico && (
                  <button
                    type="button"
                    onClick={() => setSeccionActiva('tecnico')}
                    style={{
                      flex: 1,
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: seccionActiva === 'tecnico' ? 700 : 500,
                      background: seccionActiva === 'tecnico' ? '#ffffff' : 'transparent',
                      border: '1px solid',
                      borderColor: seccionActiva === 'tecnico' ? 'var(--primary, #2563eb)' : 'transparent',
                      color: seccionActiva === 'tecnico' ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    🏗️ Obras ({tecnicoNoLeidas.length})
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.875rem' }}>
                  {esGerencial
                    ? 'Presupuestos por Aprobar'
                    : esSupervisor
                      ? 'Solicitudes de Técnicos'
                      : 'Notificaciones de Obras'}
                </strong>
                {esGerencial && presupuestosNoLeidos.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarTodosPresupuestosLeidos}
                    style={{ background: 'none', border: 'none', color: 'var(--primary, #2563eb)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Marcar todas leídas
                  </button>
                )}
                {esTecnico && tecnicoNoLeidas.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarcarTodasTecnicoLeidas}
                    style={{ background: 'none', border: 'none', color: 'var(--primary, #2563eb)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Marcar todas leídas
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CUERPO DEL DROPDOWN SEGÚN ROL / SECCIÓN */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {/* SECCIÓN 1: GERENCIA (PRESUPUESTOS) */}
            {seccionActiva === 'presupuestos' && (
              <div>
                {notifsPresupuesto.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>
                    No hay notificaciones de presupuestos.
                  </div>
                ) : (
                  notifsPresupuesto.map((n) => (
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
                        Cliente: <strong>{n.cliente_nombre}</strong>{n.obra_codigo ? <> · Obra: <strong>{n.obra_codigo}</strong></> : <> · <em>(Crea obra al aprobar)</em></>} · Monto: <strong>{formatearCLP(n.presupuesto_total)}</strong>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                        {n.presupuesto_estado !== 'Aprobado' && n.presupuesto_estado !== 'Rechazado' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAprobarPresupuesto(n)}
                              disabled={procesandoPresupuestoId === n.id}
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
                              onClick={() => handleRechazarPresupuesto(n)}
                              disabled={procesandoPresupuestoId === n.id}
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
                          <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>● Ya Aprobado</span>
                        )}
                        {n.presupuesto_estado === 'Rechazado' && (
                          <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600 }}>● Rechazado</span>
                        )}
                        {!n.leida && (
                          <button
                            type="button"
                            onClick={() => handleMarcarPresupuestoLeida(n.id)}
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
            )}

            {/* SECCIÓN 2: SUPERVISOR (SOLICITUDES DE CAMBIO DE OBRA) */}
            {seccionActiva === 'solicitudes' && (
              <div>
                {solicitudesSupervisor.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>
                    No hay solicitudes pendientes de técnicos.
                  </div>
                ) : (
                  solicitudesSupervisor.map((s) => (
                    <div
                      key={s.id_solicitud}
                      style={{
                        padding: '0.85rem 1rem',
                        borderBottom: '1px solid var(--border, #f1f5f9)',
                        backgroundColor: '#fffbeb',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <span
                          style={{
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: s.tipo === 'CANCELACION' ? '#fee2e2' : s.tipo === 'SUSPENDIDA' ? '#fef3c7' : '#e0e7ff',
                            color: s.tipo === 'CANCELACION' ? '#dc2626' : s.tipo === 'SUSPENDIDA' ? '#d97706' : '#2563eb',
                          }}
                        >
                          {({ SUSPENSION: 'Suspensión', CANCELACION: 'Cancelación', REANUDACION: 'Reanudación' })[s.tipo] || s.tipo}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                          {new Date(s.solicitada_en).toLocaleDateString('es-CL', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main, #0f172a)', margin: '0.25rem 0' }}>
                        {s.obra_codigo} · {s.obra_nombre}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)', marginBottom: '0.35rem' }}>
                        Técnico solicitante: <strong>{s.tecnico_nombre}</strong>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-main, #334155)', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fed7aa', marginBottom: '0.5rem' }}>
                        <em>"{s.motivo}"</em>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleResolverSolicitud(s, 'APROBAR')}
                          disabled={procesandoSolicitudId === s.id_solicitud}
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
                          onClick={() => handleResolverSolicitud(s, 'RECHAZAR')}
                          disabled={procesandoSolicitudId === s.id_solicitud}
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* SECCIÓN 3: TÉCNICO */}
            {seccionActiva === 'tecnico' && (
              <div>
                {notifsTecnico.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted, #64748b)', fontSize: '0.85rem' }}>
                    No tienes notificaciones de obras asignadas.
                  </div>
                ) : (
                  notifsTecnico.map((n) => (
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
                          {n.obra_codigo} · {n.obra_nombre}
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

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-main, #334155)', margin: '0.25rem 0' }}>
                        La obra fue <strong>{({ CANCELADA: 'cancelada', SUSPENDIDA: 'suspendida', FINALIZADA: 'finalizada' })[n.estado_codigo] || n.estado_descripcion || n.estado_codigo}</strong>.
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                        {!n.leida ? (
                          <button
                            type="button"
                            onClick={() => handleMarcarTecnicoLeida(n.id)}
                            style={{
                              fontSize: '0.7rem',
                              padding: '0.2rem 0.5rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--border, #cbd5e1)',
                              color: 'var(--text-muted, #64748b)',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Marcar leída
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>✓ Leída</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* FOOTER DEL DROPDOWN */}
          <div
            style={{
              padding: '0.6rem',
              textAlign: 'center',
              borderTop: '1px solid var(--border, #e2e8f0)',
              backgroundColor: 'var(--surface-alt, #f8fafc)',
            }}
          >
          </div>
        </div>
      )}

      {/* Modal de confirmación para rechazos */}
      <ModalConfirmacion
        isOpen={modalConfirmacion.isOpen}
        titulo={modalConfirmacion.titulo}
        mensaje={modalConfirmacion.mensaje}
        tipo={modalConfirmacion.tipo}
        textoConfirmar={modalConfirmacion.textoConfirmar}
        requiereMotivo={modalConfirmacion.requiereMotivo}
        labelMotivo={modalConfirmacion.labelMotivo}
        placeholderMotivo={modalConfirmacion.placeholderMotivo}
        cargando={modalConfirmacion.cargando}
        onClose={() => setModalConfirmacion((prev) => ({ ...prev, isOpen: false, cargando: false }))}
        onConfirmar={modalConfirmacion.onConfirmar}
      />
    </div>
  );
}
