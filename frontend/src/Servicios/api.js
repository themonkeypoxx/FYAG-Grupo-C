import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000', // URL del backend configurada por Ismael
});


//Esto es lo correspondiente a la tarea de implementación de middleware.
// -- Ismael

// ─── INTERCEPTOR DE REQUEST ───────
api.interceptors.request.use(
    // Esta función se llama ANTES de que salga cada request
    (config) => {
        // config tiene toda la info del request (url, method, headers, etc.)

        const token = localStorage.getItem('access_token');

        if (token) {
            // Agrega el header. Django lee esto y valida el JWT
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        // IMPORTANTE: siempre retornar config, si no, el request se bloquea
        return config;
    },
    // Esta función se llama si hay un error ANTES de enviar el request
    (error) => Promise.reject(error)
);
// ─── INTERCEPTOR DE RESPONSE ──────
let estaRenovando = false;
let colaEspera = []; //estas variables son las que servirán para el refresh del token JWT

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const requestOriginal = error.config;
        // Si es 401 y NO es ya el intento de refresh (evitar loop infinito)
        if (error.response?.status === 401 && !requestOriginal._yaIntentóRenovar) {
            requestOriginal._yaIntentóRenovar = true;
            if (estaRenovando) {
                // Otros requests que llegaron mientras se renovaba: ponerlos en cola
                return new Promise((resolve, reject) => {
                    colaEspera.push({ resolve, reject });
                }).then((nuevoToken) => {
                    requestOriginal.headers['Authorization'] = `Bearer ${nuevoToken}`;
                    return api(requestOriginal);
                });
            }
            estaRenovando = true;
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
                // Sin refresh token: logout
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(error);
            }
            try {
                const { data } = await axios.post(
                    'http://127.0.0.1:8000/api/auth/refresh/',
                    { refresh: refreshToken }
                );
                const nuevoAccess = data.access;
                localStorage.setItem('access_token', nuevoAccess);
                // Si el backend devuelve un nuevo refresh token (ROTATE_REFRESH_TOKENS: True)
                if (data.refresh) {
                    localStorage.setItem('refresh_token', data.refresh);
                }
                // Desbloquear la cola de requests pendientes
                colaEspera.forEach(({ resolve }) => resolve(nuevoAccess));
                colaEspera = [];
                // Reintentar el request original con el nuevo token
                requestOriginal.headers['Authorization'] = `Bearer ${nuevoAccess}`;
                return api(requestOriginal);
            } catch (errorRenovacion) {
                // El refresh token también expiró: logout real
                colaEspera.forEach(({ reject }) => reject(errorRenovacion));
                colaEspera = [];
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(errorRenovacion);
            } finally {
                estaRenovando = false;
            }
        }
        // Para otros errores (403, 404, 500...) los dejamos pasar
        return Promise.reject(error);
    }
);
export default api;