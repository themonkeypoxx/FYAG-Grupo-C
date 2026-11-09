import { Navigate } from 'react-router-dom';
import authService from '../Servicios/authService';
/**
 * Props:
 *   children  → el componente a proteger (ej: <Dashboard />)
 *   roles     → array de roles permitidos (ej: ['Gerencial', 'Supervisor'])
 *               si está vacío [], cualquier usuario logueado puede acceder
 */
export default function RutaProtegida({ children, roles = [] }) {
    //verificación 1: ¿Está logueado?
    if (!authService.estaAutenticado()) {
        // <Navigate> es el componente de React Router para redirigir
        // replace=true evita que el /dashboard quede en el historial del navegador
        return <Navigate to="/login" replace />;
    }
    //verificación 2: ¿Tiene el rol necesario?
    // (Solo verificamos si se especificaron roles)
    if (roles.length > 0 && !authService.tieneRol(...roles)) {
        return <Navigate to="/acceso-denegado" replace />;
    }
    //si pasa las dos verificaciones se renderiza el componente hijo
    //yo me voy a volver loco
    return children;
}