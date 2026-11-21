import api from './api';

export const obtenerResumenFinanciero = async () => {
    const response = await api.get(
        '/obras/fyag/v1/resumen-financiero/'
    );

    return response.data;
};

export const exportarResumenFinancieroPDF = async (elementos = []) => {
    const params = {};
    if (elementos && elementos.length > 0) {
        params.secciones = elementos.join(',');
    }

    const response = await api.get(
        '/obras/fyag/v1/resumen-financiero/pdf/',
        {
            params,
            responseType: 'blob',
        }
    );

    return response.data;
};
