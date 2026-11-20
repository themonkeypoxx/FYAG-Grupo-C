import api from './api';

const dashboardService = {
    async getKpisCompletos() {
        const { data } = await api.get('obras/fyag/v1/kpis/');
        return data;
    },

    async getAgregacionFacturacion() {
        const { data } = await api.get('obras/fyag/v1/agregaciones/facturacion/');
        return data;
    },

    async getAgregacionMorosidad() {
        const { data } = await api.get('obras/fyag/v1/agregaciones/morosidad/');
        return data;
    },

    async getAgregacionMongo() {
        const { data } = await api.get('obras/fyag/v1/dashboard/mongo-agregacion/');
        return data;
    },
};

export default dashboardService;