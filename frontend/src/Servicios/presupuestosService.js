import api from './api';

export const presupuestosService = {
  // Obtener listado de presupuestos con filtros opcionales
  async getPresupuestos(filters = {}) {
    const params = new URLSearchParams();
    if (filters.obra) params.append('obra', filters.obra);
    if (filters.cliente) params.append('cliente', filters.cliente);
    if (filters.estado_presupuesto) params.append('estado_presupuesto', filters.estado_presupuesto);
    const response = await api.get(`/obras/fyag/v1/presupuestos/?${params.toString()}`);
    return response.data;
  },

  // Obtener proyectos/obras activas
  async getObrasActivas() {
    const response = await api.get('/obras/fyag/v1/obras/?solo_activas=true');
    return response.data;
  },

  // Registrar un nuevo presupuesto vinculado a cliente y proyecto activo
  async crearPresupuesto(datosPresupuesto) {
    const response = await api.post('/obras/fyag/v1/presupuestos/', datosPresupuesto);
    return response.data;
  },
};

export default presupuestosService;
