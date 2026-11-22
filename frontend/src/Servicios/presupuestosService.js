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

  // Aprobar un presupuesto (Acción exclusiva de Gerente)
  async aprobarPresupuesto(idPresupuesto) {
    const response = await api.post(`/obras/fyag/v1/presupuestos/${idPresupuesto}/aprobar/`);
    return response.data;
  },

  // Rechazar un presupuesto (Acción exclusiva de Gerente)
  async rechazarPresupuesto(idPresupuesto, motivo = '') {
    const response = await api.post(`/obras/fyag/v1/presupuestos/${idPresupuesto}/rechazar/`, { motivo });
    return response.data;
  },

  // Obtener notificaciones de presupuestos para el gerente
  async getNotificacionesPresupuesto() {
    const response = await api.get('/obras/fyag/v1/notificaciones-presupuesto/');
    return response.data;
  },

  // Marcar una notificación de presupuesto como leída
  async marcarNotificacionLeida(idNotificacion) {
    const response = await api.post(`/obras/fyag/v1/notificaciones-presupuesto/${idNotificacion}/marcar-leida/`);
    return response.data;
  },

  // Marcar todas las notificaciones como leídas
  async marcarTodasNotificacionesLeidas() {
    const response = await api.post('/obras/fyag/v1/notificaciones-presupuesto/marcar-todas-leidas/');
    return response.data;
  },
};

export default presupuestosService;
