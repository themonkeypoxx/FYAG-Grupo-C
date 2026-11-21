import React, { useCallback, useEffect, useMemo, useState } from 'react';
import obrasService from '../Servicios/obrasService';

const formatearMonto = (monto) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(Number(monto) || 0);

const formatearNumero = (valor) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(valor) || 0);


const mensajeError = (err) => {
  const data = err?.response?.data;
  if (!data) return 'No se pudo conectar con el servidor. Intenta nuevamente.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  return Object.values(data)
    .flat()
    .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
    .join(' ');
};

export default function ModalMateriales({ obra, isOpen, onClose, onCambio }) {
  const [catalogo, setCatalogo] = useState([]);
  const lineaVacia = () => ({ material: '', cantidad: '', observacion: '' });
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [lineas, setLineas] = useState([lineaVacia()]);
  const [editando, setEditando] = useState(null); // { id, cantidad }
  const [porDevolver, setPorDevolver] = useState(null); 

  const obraId = obra?.id_obra;
  const obraCerrada = ['FINALIZADA', 'CANCELADA'].includes(obra?.estado_obra_codigo);

  const cargar = useCallback(async () => {
    if (!obraId) return;
    setCargando(true);
    setError('');
    try {
      const [materiales, lineas] = await Promise.all([
        obrasService.getMateriales({ activo: true }),
        obrasService.getMaterialesDeObra(obraId),
      ]);
      setCatalogo(Array.isArray(materiales) ? materiales : []);
      setAsignaciones(Array.isArray(lineas) ? lineas : []);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, [obraId]);

  
  useEffect(() => {
    if (isOpen && obraId) {
      setLineas([lineaVacia()]);
      setEditando(null);
      cargar();
    }
  }, [isOpen, obraId, cargar]);

  

  const costoTotal = useMemo(
    () => asignaciones.reduce((acc, a) => acc + Number(a.total_linea || 0), 0),
    [asignaciones]
  );

  if (!isOpen || !obra) return null;

 
  const refrescar = async () => {
    await cargar();
    if (onCambio) await onCambio();
  };

    const actualizarLinea = (indice, campo, valor) => {
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  };

  const agregarLinea = () => setLineas((prev) => [...prev, lineaVacia()]);

  const quitarLinea = (indice) =>
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== indice)));

  const handleAsignar = async (e) => {
    e.preventDefault();
    setError('');

    // 1. Validar todas las líneas antes de llamar al servidor
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      const prefijo = lineas.length > 1 ? `Línea ${i + 1}: ` : '';
      if (!l.material) {
        setError(`${prefijo}Selecciona un material.`);
        return;
      }
      const cantidad = Number(l.cantidad);
      if (!cantidad || cantidad <= 0) {
        setError(`${prefijo}Ingresa una cantidad mayor que cero.`);
        return;
      }
    }

    
    setGuardando(true);
    const pendientes = [];
    const fallos = [];
    let exitosas = 0;

    for (const l of lineas) {
      try {
        await obrasService.asignarMaterial({
          obra: obraId,
          material: Number(l.material),
          cantidad: l.cantidad,
          observacion: l.observacion,
        });
        exitosas += 1;
      } catch (err) {
        const mat = catalogo.find((m) => String(m.id_material) === String(l.material));
        pendientes.push(l);
        fallos.push(`${mat ? mat.nombre : 'Material'}: ${mensajeError(err)}`);
      }
    }

    setLineas(pendientes.length > 0 ? pendientes : [lineaVacia()]);
    if (fallos.length > 0) {
      const inicio = exitosas > 0 ? `Se asignaron ${exitosas}, pero no se pudo asignar: ` : '';
      setError(inicio + fallos.join(' | '));
    }
    await refrescar();
    setGuardando(false);
  };

  const handleGuardarCantidad = async (asignacion) => {
    setError('');
    setGuardando(true);
    try {
      await obrasService.actualizarAsignacionMaterial(asignacion.id_asignacion_material, {
        cantidad: editando.cantidad,
      });
      setEditando(null);
      await refrescar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const handleQuitar = (asignacion) => {
  setPorDevolver(asignacion);
  };

  const confirmarDevolucion = async () => {
    const asignacion = porDevolver;
    if (!asignacion) return;
    setError('');
    setGuardando(true);
    try {
      await obrasService.quitarMaterial(asignacion.id_asignacion_material);
      setPorDevolver(null);
      await refrescar();
    } catch (err) {
      setPorDevolver(null);
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

    return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>📦 Materiales de la obra</h3>
          <button type="button" className="modal-close" onClick={onClose} disabled={guardando}>
            &times;
          </button>
        </div>

      

        <div className="modal-body">
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>{obra.codigo_obra} - {obra.nombre_obra}</strong>
          </p>

          {error && (
            <div className="motivo-alerta" role="alert" style={{ marginBottom: '1rem' }}>
              ⚠️ {error}
            </div>
          )}

          {obraCerrada ? (
            <div className="cierre-alerta" style={{ marginBottom: '1rem' }}>
              ℹ️ La obra está {obra.estado_obra_descripcion?.toLowerCase()}: los materiales quedan solo en modo lectura.
            </div>
          ) : (
                        <form onSubmit={handleAsignar} style={{ marginBottom: '1.25rem' }}>
              {lineas.map((linea, indice) => {
                const mat = catalogo.find((m) => String(m.id_material) === String(linea.material));
                return (
                  <div
                    key={indice}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2.2fr 1fr 1.6fr auto',
                      gap: '0.5rem',
                      alignItems: 'start',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div className="form-group" style={{ margin: 0 }}>
                      {indice === 0 && <label>Material</label>}
                      <select
                        className="form-control"
                        value={linea.material}
                        onChange={(e) => actualizarLinea(indice, 'material', e.target.value)}
                        disabled={guardando || cargando}
                      >
                        <option value="">Selecciona un material…</option>
                        {catalogo.map((m) => {
                          const usadoEnOtraLinea = lineas.some(
                            (x, j) => j !== indice && String(x.material) === String(m.id_material)
                          );
                          return (
                            <option
                              key={m.id_material}
                              value={m.id_material}
                              disabled={Number(m.stock_actual) <= 0 || usadoEnOtraLinea}
                            >
                              {m.codigo} · {m.nombre} (stock: {formatearNumero(m.stock_actual)} {m.unidad_medida})
                            </option>
                          );
                        })}
                      </select>
                      {mat && (
                        <small style={{ color: 'var(--text-muted)' }}>
                          {formatearMonto(mat.precio_unitario)} por {mat.unidad_medida}
                        </small>
                      )}
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      {indice === 0 && <label>Cantidad{mat ? ` (${mat.unidad_medida})` : ''}</label>}
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="form-control"
                        value={linea.cantidad}
                        onChange={(e) => actualizarLinea(indice, 'cantidad', e.target.value)}
                        disabled={guardando}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      {indice === 0 && <label>Observación (opcional)</label>}
                      <input
                        type="text"
                        maxLength={255}
                        className="form-control"
                        value={linea.observacion}
                        onChange={(e) => actualizarLinea(indice, 'observacion', e.target.value)}
                        disabled={guardando}
                      />
                    </div>

                    <div style={{ paddingTop: indice === 0 ? '1.55rem' : 0 }}>
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          className="btn-secondary"
                          title="Quitar esta línea"
                          onClick={() => quitarLinea(indice)}
                          disabled={guardando}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={agregarLinea}
                  disabled={guardando || cargando}
                >
                  + Agregar otro material
                </button>
                <button type="submit" className="btn-primary" disabled={guardando || cargando}>
                  {guardando
                    ? 'Guardando…'
                    : lineas.length > 1
                    ? `Asignar ${lineas.length} materiales`
                    : 'Asignar a la obra'}
                </button>
              </div>
            </form>
          )}

          <strong>Materiales asignados</strong>
          {cargando ? (
            <p style={{ marginTop: '0.5rem' }}>Cargando…</p>
          ) : asignaciones.length === 0 ? (
            <p className="sin-tecnicos" style={{ marginTop: '0.5rem' }}>
              Esta obra aún no tiene materiales asignados.
            </p>
          ) : (
            <>
              <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.4rem' }}>Material</th>
                      <th style={{ padding: '0.4rem' }}>Cantidad</th>
                      <th style={{ padding: '0.4rem' }}>P. unit.</th>
                      <th style={{ padding: '0.4rem' }}>Total</th>
                      {!obraCerrada && <th style={{ padding: '0.4rem' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {asignaciones.map((a) => {
                      const enEdicion = editando?.id === a.id_asignacion_material;
                      return (
                        <tr key={a.id_asignacion_material} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem' }}>
                            <strong>{a.material_codigo}</strong> {a.material_nombre}
                            {a.observacion && (
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{a.observacion}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>
                            {enEdicion ? (
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="form-control"
                                style={{ width: '90px', padding: '0.3rem 0.5rem' }}
                                value={editando.cantidad}
                                onChange={(e) => setEditando({ ...editando, cantidad: e.target.value })}
                                autoFocus
                              />
                            ) : (
                              <>{formatearNumero(a.cantidad)} {a.unidad_medida}</>
                            )}
                          </td>
                          <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>{formatearMonto(a.precio_unitario)}</td>
                          <td style={{ padding: '0.4rem', whiteSpace: 'nowrap' }}>{formatearMonto(a.total_linea)}</td>
                          {!obraCerrada && (
                            <td style={{ padding: '0.4rem', whiteSpace: 'nowrap', textAlign: 'right' }}>
                              {enEdicion ? (
                                <>
                                  <button type="button" className="btn-primary" disabled={guardando} onClick={() => handleGuardarCantidad(a)}>
                                    Guardar
                                  </button>{' '}
                                  <button type="button" className="btn-secondary" disabled={guardando} onClick={() => setEditando(null)}>
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={guardando}
                                    onClick={() => setEditando({ id: a.id_asignacion_material, cantidad: a.cantidad })}
                                  >
                                    Editar
                                  </button>{' '}
                                  <button type="button" className="btn-secondary" disabled={guardando} onClick={() => handleQuitar(a)}>
                                    Devolver
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ textAlign: 'right', marginTop: '0.75rem', marginBottom: 0 }}>
                Costo total en materiales: <strong>{formatearMonto(costoTotal)}</strong>
              </p>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={guardando}>
            Cerrar
          </button>
        </div>
      </div>
        {porDevolver && (
    <div
      className="modal-overlay"
      style={{ zIndex: 1100 }}
      onClick={(e) => { e.stopPropagation(); if (!guardando) setPorDevolver(null); }}
    >
      <div
        className="modal-content"
        style={{ maxWidth: '440px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Devolver material</h3>
        </div>
        <div className="modal-body">
          <p>
            Se devolverán{' '}
            <strong>
              {formatearNumero(porDevolver.cantidad)} {porDevolver.unidad_medida}
            </strong>{' '}
            de <strong>{porDevolver.material_nombre}</strong> al stock y se quitarán de esta obra.
          </p>
          <p style={{ marginTop: '0.5rem', opacity: 0.75 }}>
            Esta seguro de esta acción?, no se puede deshacer desde aquí.
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            disabled={guardando}
            onClick={() => setPorDevolver(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: '#dc2626', borderColor: '#dc2626' }}
            disabled={guardando}
            onClick={confirmarDevolucion}
          >
            {guardando ? 'Devolviendo...' : 'Sí, devolver'}
          </button>
        </div>
      </div>
    </div>
  )}
      </div>
    );
  }