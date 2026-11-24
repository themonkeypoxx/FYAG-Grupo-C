
/// ESTE SCRIPT HACE LAS CONSULTAS A LA API PARA REGISTRO DE AUDITORIA


import api from './api';

export const auditService = {
    async getLogs(params = {}) {
        // params puede contener { limite: 50, salto: 0, accion: 'CREAR' }
        const query = new URLSearchParams(params).toString();
        const response = await api.get(`/obras/fyag/v1/auditoria/?${query}`);
        return response.data; // { total, registros }
    }
};

export default auditService;

// esto tira la consulta para ver el log a la api