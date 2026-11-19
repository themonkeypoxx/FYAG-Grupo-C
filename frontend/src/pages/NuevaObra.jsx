import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import obrasService from '../Servicios/obrasService';

// Normaliza RUT/RUN removiendo puntos y guiones para búsqueda flexible
const normalizarRut = (rut) => (rut || '').replace(/[^0-9kK]/g, '').toLowerCase();

export default function NuevaObra() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [estados, setEstados] = useState([]);
  const [tecnicosDisponibles, setTecnicosDisponibles] = useState([]);

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Estados de búsqueda
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaTecnico, setBusquedaTecnico] = useState('');
  const [mostrarDropdownTecnico, setMostrarDropdownTecnico] = useState(false);

  // Técnicos asignados a esta obra
  const [tecnicosAsignados, setTecnicosAsignados] = useState([]);

  const [formData, setFormData] = useState({
    codigo_obra: `FYAG-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    nombre_obra: '',
    ubicacion_faena: '',
    id_cliente: '',
    id_tipo_servicio: '',
    id_estado_obra: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_termino_estimada: '',
    costo_estimado: '',
  });

  useEffect(() => {
    async function cargarCatalogos() {
      try {
        setCargandoCatalogos(true);
        const [cls, tipos, ests, tecs] = await Promise.all([
          obrasService.getClientes(),
          obrasService.getTiposServicio(),
          obrasService.getEstadosObra(),
          obrasService.getTecnicos().catch((err) => {
            console.warn('No se pudieron cargar técnicos:', err);
            return [];
          }),
        ]);

        setClientes(cls);
        setTiposServicio(tipos);
        setEstados(ests);
        setTecnicosDisponibles(tecs || []);

        const pendiente = ests.find((e) => e.codigo_estado === 'PENDIENTE') || ests[0];
        setFormData((prev) => ({
          ...prev,
          id_cliente: cls[0]?.id_cliente || '',
          id_tipo_servicio: tipos[0]?.id_tipo_servicio || '',
          id_estado_obra: pendiente?.id_estado_obra || '',
        }));
      } catch (err) {
        console.error('Error al cargar catálogos:', err);
        setError('No se pudieron cargar los catálogos del servidor.');
      } finally {
        setCargandoCatalogos(false);
      }
    }
    cargarCatalogos();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Clientes filtrados por Razón Social o RUT
  const clientesFiltrados = useMemo(() => {
    if (!busquedaCliente.trim()) return clientes;
    const term = busquedaCliente.toLowerCase().trim();
    const termNorm = normalizarRut(term);

    return clientes.filter((c) => {
      const razon = (c.razon_social || '').toLowerCase();
      const rut = (c.rut_empresa || '').toLowerCase();
      const rutNorm = normalizarRut(c.rut_empresa);
      const contacto = (c.contacto_nombre || '').toLowerCase();
      const ciudad = (c.ciudad || '').toLowerCase();

      return (
        razon.includes(term) ||
        rut.includes(term) ||
        rutNorm.includes(termNorm) ||
        contacto.includes(term) ||
        ciudad.includes(term)
      );
    });
  }, [clientes, busquedaCliente]);

  // Cliente seleccionado actualmente
  const clienteSeleccionado = useMemo(() => {
    return clientes.find((c) => String(c.id_cliente) === String(formData.id_cliente));
  }, [clientes, formData.id_cliente]);

  // Técnicos filtrados por Nombre o RUN/Username
  const tecnicosFiltrados = useMemo(() => {
    const idsAsignados = new Set(tecnicosAsignados.map((t) => t.id));
    const candidatos = tecnicosDisponibles.filter((t) => !idsAsignados.has(t.id));

    if (!busquedaTecnico.trim()) return candidatos;

    const term = busquedaTecnico.toLowerCase().trim();
    const termNorm = normalizarRut(term);

    return candidatos.filter((t) => {
      const nombre = (t.nombre || '').toLowerCase();
      const user = (t.username || '').toLowerCase();
      const userNorm = normalizarRut(t.username);
      const email = (t.email || '').toLowerCase();

      return (
        nombre.includes(term) ||
        user.includes(term) ||
        userNorm.includes(termNorm) ||
        email.includes(term)
      );
    });
  }, [tecnicosDisponibles, tecnicosAsignados, busquedaTecnico]);

  // Manejo de asignación de técnicos
  const agregarTecnico = (tecnico) => {
    setTecnicosAsignados((prev) => [
      ...prev,
      {
        ...tecnico,
        bloque: 'MANANA', // Bloque por defecto
      },
    ]);
    setBusquedaTecnico('');
    setMostrarDropdownTecnico(false);
  };

  const removerTecnico = (tecnicoId) => {
    setTecnicosAsignados((prev) => prev.filter((t) => t.id !== tecnicoId));
  };

  const cambiarBloqueTecnico = (tecnicoId, nuevoBloque) => {
    setTecnicosAsignados((prev) =>
      prev.map((t) => (t.id === tecnicoId ? { ...t, bloque: nuevoBloque } : t))
    );
  };

  const copiarDireccionCliente = () => {
    if (!clienteSeleccionado) return;
    const direccion = [
      clienteSeleccionado.direccion_matriz,
      clienteSeleccionado.comuna,
      clienteSeleccionado.ciudad,
    ]
      .filter(Boolean)
      .join(', ');

    if (direccion) {
      setFormData((prev) => ({ ...prev, ubicacion_faena: direccion }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre_obra.trim()) {
      setError('El nombre de la obra es requerido.');
      return;
    }
    if (!formData.id_cliente) {
      setError('Debe seleccionar un cliente.');
      return;
    }
    if (!formData.id_tipo_servicio) {
      setError('Debe clasificar la obra en un tipo de servicio.');
      return;
    }

    if (
      formData.fecha_termino_estimada &&
      formData.fecha_termino_estimada <= formData.fecha_inicio
    ) {
      setError('La fecha de término debe ser posterior a la fecha de inicio.');
      return;
    }

    const estadoPendiente = estados.find(
      (estado) => estado.codigo_estado === 'PENDIENTE'
    );

    if (!estadoPendiente) {
      setError('No se encontró el estado Pendiente.');
      return;
    }

    try {
      setGuardando(true);
      setError(null);

      const payload = {
        codigo_obra: formData.codigo_obra,
        nombre_obra: formData.nombre_obra,
        ubicacion_faena: formData.ubicacion_faena,
        cliente: formData.id_cliente,
        tipo_servicio: parseInt(formData.id_tipo_servicio, 10),
        estado_obra: parseInt(estadoPendiente.id_estado_obra, 10),
        supervisor: 1, // Supervisor predeterminado
        fecha_inicio: formData.fecha_inicio,
        fecha_termino_estimada: formData.fecha_termino_estimada || null,
        costo_estimado: formData.costo_estimado ? parseFloat(formData.costo_estimado) : 0,
      };

      const obraCreada = await obrasService.crearObra(payload);

      // Asignar los técnicos seleccionados a la obra
      if (tecnicosAsignados.length > 0 && obraCreada?.id_obra) {
        for (const tec of tecnicosAsignados) {
          const horario =
            tec.bloque === 'TARDE'
              ? { hora_inicio: '15:00', hora_termino: '17:00' }
              : { hora_inicio: '09:30', hora_termino: '13:30' };

          try {
            await obrasService.asignarTecnico({
              obra: obraCreada.id_obra,
              tecnico: tec.id,
              fecha_inicio: formData.fecha_inicio,
              fecha_termino: formData.fecha_termino_estimada || formData.fecha_inicio,
              ...horario,
            });
          } catch (errTec) {
            console.warn(`No se pudo asignar al técnico ${tec.nombre}:`, errTec);
          }
        }
      }

      const mensajeExito =
        tecnicosAsignados.length > 0
          ? `¡Obra creada exitosamente con ${tecnicosAsignados.length} técnico(s) asignado(s)!`
          : '¡Obra creada exitosamente! La ficha se registró correctamente.';

      navigate('/dashboard-obras', {
        state: {
          notificacion: {
            tipo: 'exito',
            mensaje: mensajeExito,
          },
        },
      });
    } catch (err) {
      console.error('Error al guardar obra:', err);
      const msg =
        err.response?.data?.error ||
        JSON.stringify(err.response?.data) ||
        'Ocurrió un error al guardar la obra.';
      setError(msg);
    } finally {
      setGuardando(false);
    }
  };

  if (cargandoCatalogos) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Cargando catálogos...
      </div>
    );
  }

  return (
    <div className="form-card">
      <h2>Nueva Ficha de Obra</h2>

      {error && (
        <div
          style={{
            backgroundColor: 'var(--estado-cancelada-bg)',
            color: 'var(--estado-cancelada)',
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Código y Tipo de Servicio */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="codigo_obra">Código de Obra *</label>
            <input
              type="text"
              id="codigo_obra"
              name="codigo_obra"
              className="form-control"
              value={formData.codigo_obra}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="id_tipo_servicio">Clasificación por Tipo de Servicio *</label>
            <select
              id="id_tipo_servicio"
              name="id_tipo_servicio"
              className="form-control"
              value={formData.id_tipo_servicio}
              onChange={handleChange}
              required
            >
              {tiposServicio.map((t) => (
                <option key={t.id_tipo_servicio} value={t.id_tipo_servicio}>
                  {t.nombre_servicio} ({t.codigo})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nombre de la Obra */}
        <div className="form-group">
          <label htmlFor="nombre_obra">Nombre / Descripción de la Obra *</label>
          <input
            type="text"
            id="nombre_obra"
            name="nombre_obra"
            className="form-control"
            placeholder="Ej. Instalación de Climatización Central Línea 3"
            value={formData.nombre_obra}
            onChange={handleChange}
            required
          />
        </div>

        {/* SECCIÓN CLIENTE: BUSCADOR POR NOMBRE O RUT Y DETALLES */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              🏢 Empresa Mandante / Cliente *
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Buscar por Razón Social o RUT
            </span>
          </div>

          {/* Campo buscador de cliente */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Escribe RUT (ej. 76.123...) o Nombre de la empresa..."
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
            />
            {busquedaCliente && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setBusquedaCliente('')}
                style={{ whiteSpace: 'nowrap', padding: '0.5rem 0.85rem' }}
              >
                Limpiar filtro
              </button>
            )}
          </div>

          {/* Selector de Cliente */}
          <select
            id="id_cliente"
            name="id_cliente"
            className="form-control"
            value={formData.id_cliente}
            onChange={handleChange}
            required
          >
            <option value="">
              -- Selecciona un cliente ({clientesFiltrados.length} disponibles) --
            </option>
            {clientesFiltrados.map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>
                {c.razon_social} · RUT: {c.rut_empresa} {c.ciudad ? `(${c.ciudad})` : ''}
              </option>
            ))}
          </select>

          {/* TARJETA DETALLE DEL CLIENTE SELECCIONADO (Evita errores) */}
          {clienteSeleccionado ? (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '0.5rem',
                }}
              >
                <div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                    {clienteSeleccionado.razon_social}
                  </strong>
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    (RUT: <strong>{clienteSeleccionado.rut_empresa}</strong>)
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor:
                      clienteSeleccionado.estado_cliente === 'Activo'
                        ? '#dcfce7'
                        : clienteSeleccionado.estado_cliente === 'Moroso'
                        ? '#fee2e2'
                        : '#f1f5f9',
                    color:
                      clienteSeleccionado.estado_cliente === 'Activo'
                        ? '#166534'
                        : clienteSeleccionado.estado_cliente === 'Moroso'
                        ? '#991b1b'
                        : '#475569',
                  }}
                >
                  Estado: {clienteSeleccionado.estado_cliente || 'Activo'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Giro Comercial:</span>{' '}
                  <strong>{clienteSeleccionado.giro_comercial || 'No especificado'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Ciudad / Comuna:</span>{' '}
                  <strong>
                    {[clienteSeleccionado.ciudad, clienteSeleccionado.comuna].filter(Boolean).join(', ') || 'No especificada'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Dirección Matriz:</span>{' '}
                  <strong>{clienteSeleccionado.direccion_matriz || 'No registrada'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Contacto:</span>{' '}
                  <strong>
                    {clienteSeleccionado.contacto_nombre || 'Sin contacto'}{' '}
                    {clienteSeleccionado.contacto_telefono && `(${clienteSeleccionado.contacto_telefono})`}
                  </strong>
                </div>
              </div>

              {clienteSeleccionado.direccion_matriz && (
                <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                    onClick={copiarDireccionCliente}
                    title="Copia la dirección del cliente en la ubicación de la faena"
                  >
                    📍 Usar esta dirección para Ubicación Faena
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Selecciona un cliente para verificar sus datos (RUT, Razón Social, Contacto).
            </p>
          )}
        </div>

        {/* Ubicación Faena */}
        <div className="form-group">
          <label htmlFor="ubicacion_faena">Ubicación Faena *</label>
          <input
            type="text"
            id="ubicacion_faena"
            name="ubicacion_faena"
            className="form-control"
            placeholder="Ej. Camino a Pemuco km 5, Chillán"
            value={formData.ubicacion_faena}
            onChange={handleChange}
            required
          />
        </div>

        {/* Fechas de inicio y término */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="fecha_inicio">Fecha de Inicio *</label>
            <input
              type="date"
              id="fecha_inicio"
              name="fecha_inicio"
              className="form-control"
              value={formData.fecha_inicio}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="fecha_termino_estimada">Fecha Término Estimada</label>
            <input
              type="date"
              id="fecha_termino_estimada"
              name="fecha_termino_estimada"
              className="form-control"
              value={formData.fecha_termino_estimada}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* SECCIÓN TÉCNICOS: BUSCADOR POR NOMBRE O RUN Y ASIGNACIÓN */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              👷 Asignar Técnicos a la Obra (Opcional)
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Buscar por Nombre o RUN/RUT
            </span>
          </div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Puedes buscar técnicos y agregarlos directamente al crear la ficha. Se les asignará la obra en las fechas indicadas.
          </p>

          {/* Input con autocompletado predictivo */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Escribe RUN (ej. 19.876...) o Nombre del técnico para buscar..."
              value={busquedaTecnico}
              onChange={(e) => {
                setBusquedaTecnico(e.target.value);
                setMostrarDropdownTecnico(true);
              }}
              onFocus={() => setMostrarDropdownTecnico(true)}
            />

            {/* Dropdown flotante con coincidencias */}
            {mostrarDropdownTecnico && busquedaTecnico.trim().length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  maxHeight: '220px',
                  overflowY: 'auto',
                  zIndex: 30,
                  marginTop: '4px',
                }}
              >
                {tecnicosFiltrados.length === 0 ? (
                  <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No se encontraron técnicos con ese nombre o RUN.
                  </div>
                ) : (
                  tecnicosFiltrados.map((tec) => (
                    <div
                      key={tec.id}
                      onClick={() => agregarTecnico(tec)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                          {tec.nombre}
                        </strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          RUN / Usuario: <strong>{tec.username}</strong>
                          {tec.email ? ` · ${tec.email}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        + Agregar a la obra
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* LISTA DE TÉCNICOS SELECCIONADOS / ASIGNADOS CON SUS DETALLES */}
          {tecnicosAsignados.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {tecnicosAsignados.map((tec) => (
                <div
                  key={tec.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      👷 {tec.nombre}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      RUN / Usuario: <strong>{tec.username}</strong>
                      {tec.email && ` · ${tec.email}`}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                      Bloque:
                    </label>
                    <select
                      value={tec.bloque}
                      onChange={(e) => cambiarBloqueTecnico(tec.id, e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', width: 'auto' }}
                    >
                      <option value="MANANA">Mañana (09:30 - 13:30)</option>
                      <option value="TARDE">Tarde (15:00 - 17:00)</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => removerTecnico(tec.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--estado-cancelada)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        padding: '0.25rem 0.5rem',
                      }}
                      title="Quitar técnico de la asignación"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg)',
                border: '1px dashed var(--border)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
              }}
            >
              No has asignado técnicos a esta obra todavía. Puedes buscarlos arriba o asignarlos más tarde desde el panel de obras.
            </div>
          )}
        </div>

        {/* Costo estimado y Estado inicial */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="costo_estimado">Presupuesto Estimado (CLP)</label>
            <input
              type="number"
              id="costo_estimado"
              name="costo_estimado"
              className="form-control"
              placeholder="Ej. 12000000"
              value={formData.costo_estimado}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="form-group">
            <label htmlFor="id_estado_obra">Estado Inicial</label>
            <select
              id="id_estado_obra"
              name="id_estado_obra"
              className="form-control"
              value={formData.id_estado_obra}
              onChange={handleChange}
              disabled
            >
              {estados.map((e) => (
                <option key={e.id_estado_obra} value={e.id_estado_obra}>
                  {e.descripcion}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <Link to="/dashboard-obras" className="btn-secondary" style={{ textDecoration: 'none' }}>
            Cancelar
          </Link>
          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar Ficha de Obra'}
          </button>
        </div>
      </form>
    </div>
  );
}
