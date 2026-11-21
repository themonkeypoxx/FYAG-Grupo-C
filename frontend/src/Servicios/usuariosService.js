import api from './api';

export const usuariosService = {
  
  async listar() {
    const response = await api.get('/obras/fyag/v1/usuarios/');
    return Array.isArray(response.data) ? response.data : [];
  },

  
  async crear(datos) {
    const response = await api.post('/obras/fyag/v1/usuarios/', datos);
    return response.data;
  },
};

export default usuariosService;
