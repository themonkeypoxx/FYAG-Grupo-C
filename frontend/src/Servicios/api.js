import axios from 'axios';

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/', // URL del backend configurada por Ismael
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
api.interceptors.response.use(
    // Si la respuesta es exitosa (2xx), la pasamos directo sin tocarla
    (response) => response,

    // Si hay un error en la respuesta...
    (error) => {
        if (error.response?.status === 401) {
            // 401 = No autorizado (token expirado o inválido)
            // Limpiamos la sesión para que el usuario vuelva a loguearse
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user_data');

            // Redirigimos al login x mientras (window.location es más directo que useNavigate aquí)
            window.location.href = '/login';
        }

        // Para otros errores (403, 404, 500...) los dejamos pasar
        // para que cada componente los maneje como quiera
        // eso m dijo tío claude (me está enseñando....)
        return Promise.reject(error);
    }

);
export default api;