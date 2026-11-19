import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import obrasService from '../Servicios/obrasService';


export default function NuevaObra() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [tiposServicio, setTiposServicio] = useState([]);
  const [estados, setEstados] = useState([]);
  const [catalogoMaquinarias, setCatalogoMaquinarias] = useState([]);
  const [maquinasSeleccionadas, setMaquinasSeleccionadas] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

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
        const [cls, tipos, ests, maqs] = await Promise.all([
          obrasService.getClientes(),
          obrasService.getTiposServicio(),
          obrasService.getEstadosObra(),
          obrasService.getMaquinarias().catch((err) => {
            console.warn('No se pudo cargar el catálogo de maquinarias desde MongoDB:', err);
            return [];
          }),
        ]);
        setClientes(cls);
        setTiposServicio(tipos);
        setEstados(ests);
        setCatalogoMaquinarias(maqs || []);

        // Preseleccionar valores por defecto si existen
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

      // El modelo de Django espera supervisor (ForeignKey). Obtenemos o asignamos supervisor 1
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
        maquinarias_codigos: maquinasSeleccionadas,
      };

      await obrasService.crearObra(payload);

navigate('/dashboard-obras', {
  state: {
    notificacion: {
      tipo: 'exito',
      mensaje: '¡Obra creada exitosamente! La ficha se registró correctamente.',
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

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="id_cliente">Empresa Mandante / Cliente *</label>
            <select
              id="id_cliente"
              name="id_cliente"
              className="form-control"
              value={formData.id_cliente}
              onChange={handleChange}
              required
            >
              {clientes.map((c) => (
                <option key={c.id_cliente} value={c.id_cliente}>
                  {c.razon_social} ({c.rut_empresa})
                </option>
              ))}
            </select>
          </div>

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
        </div>

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

        {/* Sección de Asignación de Maquinarias (Catálogo MongoDB) */}
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'var(--surface-muted, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border, #e2e8f0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <label style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🚜</span> Catálogo de Maquinarias y Equipos
            </label>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
              {maquinasSeleccionadas.length} seleccionada{maquinasSeleccionadas.length === 1 ? '' : 's'}
            </span>
          </div>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
            Selecciona las maquinarias que estarán asignadas a esta faena:
          </p>
          {catalogoMaquinarias.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>
              No hay maquinarias registradas o disponibles en el catálogo.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
              {catalogoMaquinarias.map((maq) => {
                const seleccionada = maquinasSeleccionadas.includes(maq.codigo);
                const ocupadaPorOtra = maq.estado === 'ASIGNADA';

                return (
                  <label
                    key={maq.codigo}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '6px',
                      background: seleccionada ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface, #ffffff)',
                      border: seleccionada ? '1px solid #3b82f6' : '1px solid var(--border, #cbd5e1)',
                      cursor: ocupadaPorOtra ? 'not-allowed' : 'pointer',
                      opacity: ocupadaPorOtra ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      disabled={ocupadaPorOtra}
                      checked={seleccionada}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setMaquinasSeleccionadas([...maquinasSeleccionadas, maq.codigo]);
                        } else {
                          setMaquinasSeleccionadas(maquinasSeleccionadas.filter((c) => c !== maq.codigo));
                        }
                      }}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div style={{ fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text, #1e293b)' }}>
                        {maq.codigo} · {maq.nombre}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)' }}>
                        {maq.tipo} {maq.patente ? `· Patente: ${maq.patente}` : ''}
                        {ocupadaPorOtra && <span style={{ color: '#ef4444', marginLeft: '0.3rem' }}>(Asignada a otra obra)</span>}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

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

