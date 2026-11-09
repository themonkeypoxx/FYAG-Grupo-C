import api from './api';
export const authService = {
    async login(username, password) {
        // Llama al endpoint real de Django
        const response = await api.post('/api/auth/login/', { username, password });

        // Sacamos lo que nos interesa de la respuesta
        const { access, refresh, username: user, email, roles } = response.data;

        // guardar el token que va en cada header
        localStorage.setItem('access_token', access);

        // guardar el refresh token (para renovar el access cuando expire)
        localStorage.setItem('refresh_token', refresh);

        // wardars los datos del usuario como string JSON
        // (localStorage solo guarda strings, por eso usamos JSON.stringify)
        localStorage.setItem('user_data', JSON.stringify({
            username: user,
            email,
            roles  // ej: ["Gerencial"] o ["Supervisor", "Tecnico"]
        }));

        return response.data;
    },
    logout() {
        // Borramos todo lo relacionado a la sesión
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');

        // Redirigimos al login
        window.location.href = '/login';
    },
    getUsuario() {
        const data = localStorage.getItem('user_data');
        // JSON.parse convierte el string de vuelta a objeto
        // Si no hay datos, retorna null (usuario no logueado)
        return data ? JSON.parse(data) : null;
    },
    // Verifica si el usuario tiene AL MENOS UNO de los roles requeridos
    // Ejemplo: tieneRol('Gerencial', 'Supervisor')
    //  true si el usuario es Gerencial O Supervisor
    tieneRol(...rolesRequeridos) {
        const usuario = this.getUsuario();
        if (!usuario) return false;

        // some() = ¿alguno de los roles requeridos está en los roles del usuario?
        return rolesRequeridos.some(rol => usuario.roles?.includes(rol));
    },
    estaAutenticado() {
        // Si existe el token, está autenticado
        // "!!"" convierte a booleano (string no vacío a true, null a false)
        return !!localStorage.getItem('access_token');
    },
};
export default authService;