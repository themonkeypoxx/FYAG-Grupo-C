import api from './api';

export const obtenerResumenFinanciero = async () => {
    const response = await api.get(
        '/obras/fyag/v1/resumen-financiero/'
    );

    return response.data;
};