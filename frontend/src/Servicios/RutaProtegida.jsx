import React from 'react';
import { Navigate } from 'react-router-dom';
import authService from './authService';
import AccesoDenegado from '../pages/AccesoDenegado';

/**
 * Componente para proteger vistas y endpoints según autenticación y roles de usuario.
 * Criterio de aceptación (Gabriel Rivas):
 * En caso de que un usuario no Gerente intente manipular la URL para acceder al dashboard
 * o al registro de auditoría, el sistema valida el rol y muestra en su lugar el error 403 Forbidden.
 *
 * Props:
 *   children      → el componente a proteger (ej: <Dashboard />)
 *   roles         → array de roles permitidos (ej: ['Gerencial'])
 *   redirigirA403 → booleano si se prefiere redirigir a /acceso-denegado en lugar de renderizar in-place
 */
export default function RutaProtegida({ children, roles = [], redirigirA403 = false }) {
    // 1. Verificación de autenticación: ¿Está logueado?
    if (!authService.estaAutenticado()) {
        return <Navigate to="/login" replace />;
    }

    // 2. Verificación de autorización: ¿Tiene el rol requerido?
    if (roles.length > 0 && !authService.tieneRol(...roles)) {
        if (redirigirA403) {
            return <Navigate to="/acceso-denegado" replace />;
        }
        // Muestra en su lugar la pantalla de Error 403 Forbidden
        return <AccesoDenegado rolRequerido={roles.join(', ')} />;
    }

    // Si pasa todas las validaciones se renderiza el componente protegido
    return children;
}
