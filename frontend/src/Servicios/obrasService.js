import api from './api';

export const obrasService = {
  // Obtener obras con filtros opcionales (tipo_servicio_codigo, estado_codigo, search)
  async getObras(filters = {}) {
    const params = new URLSearchParams();
    if (filters.tipo_servicio_codigo && filters.tipo_servicio_codigo !== 'TODOS') {
      params.append('tipo_servicio_codigo', filters.tipo_servicio_codigo);
    }
    if (filters.estado_codigo && filters.estado_codigo !== 'TODOS') {
      params.append('estado_codigo', filters.estado_codigo);
    }
    if (filters.search) {
      params.append('search', filters.search);
    }
    const response = await api.get(`/obras/fyag/v1/obras/?${params.toString()}`);
    return response.data;
  },

  // Obtener clasificación y conteo por tipo de servicio
  async getResumenTipos() {
    const response = await api.get('/obras/fyag/v1/obras/resumen-tipos/');
    return response.data;
  },

  // Obtener conteo agrupado por estados operativos
  async getResumenEstados() {
    const response = await api.get('/obras/fyag/v1/obras/resumen-estados/');
    return response.data;
  },

  // Catálogo de tipos de servicio
  async getTiposServicio() {
    const response = await api.get('/obras/fyag/v1/tipos-servicio/');
    return response.data;
  },

  // Catálogo de estados de obra
  async getEstadosObra() {
    const response = await api.get('/obras/fyag/v1/estados-obra/');
    return response.data;
  },

  // Catálogo de clientes
  async getClientes() {
    const response = await api.get('/obras/fyag/v1/clientes/');
    return response.data;
  },

  // Transición de estado operativo
  async cambiarEstado(obraId, nuevoEstadoCodigo, motivo = '') {
    const response = await api.post(`/obras/fyag/v1/obras/${obraId}/cambiar-estado/`, {
      nuevo_estado: nuevoEstadoCodigo,
      motivo: motivo,
    });
    return response.data;
  },

  // Crear nueva obra
  async crearObra(datosObra) {
    const response = await api.post('/obras/fyag/v1/obras/', datosObra);
    return response.data;
  },

  async actualizarObra(obraId, datosObra) {
    const response = await api.patch(`/obras/fyag/v1/obras/${obraId}/`, datosObra);
    return response.data;
  },

  async getTecnicos() {
    const response = await api.get('/obras/fyag/v1/asignaciones-tecnico/tecnicos/');
    return response.data;
  },

  async asignarTecnico(datos) {
    const response = await api.post('/obras/fyag/v1/asignaciones-tecnico/', datos);
    return response.data;
  },

  async getAsignaciones() {
    const response = await api.get('/obras/fyag/v1/asignaciones-tecnico/');
    return response.data;
  },

  async getSolicitudesCambio() {
    const response = await api.get('/obras/fyag/v1/solicitudes-cambio-obra/');
    return response.data;
  },

  async solicitarCambioObra(datos) {
    const response = await api.post('/obras/fyag/v1/solicitudes-cambio-obra/', datos);
    return response.data;
  },

  async resolverSolicitudCambio(solicitudId, accion, respuesta = '') {
    const response = await api.post(`/obras/fyag/v1/solicitudes-cambio-obra/${solicitudId}/resolver/`, {
      accion,
      respuesta,
    });
    return response.data;
  },
};

export default obrasService;

