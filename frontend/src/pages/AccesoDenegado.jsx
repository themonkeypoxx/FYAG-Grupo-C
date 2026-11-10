import React from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../Servicios/authService';

export default function AccesoDenegado({ rolRequerido = 'Gerencial' }) {
  const navigate = useNavigate();
  const usuario = authService.getUsuario();
  const rolesUsuario = usuario?.roles && usuario.roles.length > 0 
    ? usuario.roles.join(', ') 
    : 'Sin roles asignados';

  const handleCerrarSesion = () => {
    authService.logout();
  };

  const handleVolver = () => {
    navigate('/login');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '2rem 1rem',
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        backgroundColor: 'var(--surface, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1))',
        padding: '2.5rem 2rem',
        textAlign: 'center',
      }}>
        {/* Código de Estado HTTP */}
        <div style={{
          display: 'inline-block',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          fontWeight: 800,
          fontSize: '0.875rem',
          letterSpacing: '0.05em',
          padding: '0.35rem 0.75rem',
          borderRadius: '9999px',
          marginBottom: '1rem',
          textTransform: 'uppercase',
        }}>
          Error 403 Forbidden
        </div>

        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--text-main, #0f172a)',
          marginBottom: '0.75rem',
        }}>
          Acceso Denegado
        </h1>

        <p style={{
          color: 'var(--text-muted, #64748b)',
          fontSize: '0.95rem',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}>
          No tienes las atribuciones o el rol de <strong>{rolRequerido}</strong> necesario para acceder a esta sección o a sus datos confidenciales.
        </p>

        {/* Información del usuario logueado */}
        {usuario && (
          <div style={{
            backgroundColor: 'var(--bg, #f8fafc)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '8px',
            padding: '0.875rem 1rem',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            textAlign: 'left',
          }}>
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted, #64748b)' }}>Usuario actual: </span>
              <strong>{usuario.username || 'Desconocido'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted, #64748b)' }}>Rol asignado: </span>
              <span style={{
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 600,
              }}>
                {rolesUsuario}
              </span>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <button
            onClick={handleVolver}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: 'var(--primary, #1e40af)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.925rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Volver a la pantalla de inicio
          </button>

          <button
            onClick={handleCerrarSesion}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: 'transparent',
              color: 'var(--text-muted, #64748b)',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: '8px',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Cerrar sesión e ingresar con otra cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
