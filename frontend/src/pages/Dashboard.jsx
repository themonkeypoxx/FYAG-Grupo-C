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

  useEffect(() => {
    cargarResumenTipos();
  }, []);

  useEffect(() => {
    cargarObras();
  }, [cargarObras]);

  const handleSolicitarTransicion = (obra, transicion) => {
    setModalData({
      isOpen: true,
      obra,
      transicion,
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
    </div>
  );
}