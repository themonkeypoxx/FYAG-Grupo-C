import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import authService from '../Servicios/authService';

export default function Navbar() {
  const location = useLocation();
  const esTecnico = authService.tieneRol('Tecnico');
  const esAdministrativo = authService.tieneRol('Administrativo');
  const esGerencial = authService.tieneRol('Gerencial');
  const esSupervisor = authService.tieneRol('Supervisor');
  const usuario = authService.getUsuario();

  const handleLogout = () => {
    authService.logout();
  };

  const puedeAccederFinanzas = esGerencial || esAdministrativo;

  const rutaInicio = esTecnico
    ? '/vista-tecnico'
    : esAdministrativo && !esGerencial
      ? '/vista-administrativo'
      : '/dashboard-obras';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={rutaInicio} className="brand">
          <div className="brand-logo">FYAG</div>
          <div className="brand-text">
            <h1>Gestión de Obras</h1>
            <span>Climatización &amp; Servicios Industriales</span>
          </div>
        </Link>

        <nav className="nav-links">
          {esTecnico && (
            <Link
              to="/vista-tecnico"
              className={`nav-link ${location.pathname === '/vista-tecnico' ? 'active' : ''}`}
            >
              Mi horario
            </Link>
          )}

          {esAdministrativo && (
            <Link
              to="/vista-administrativo"
              className={`nav-link ${location.pathname === '/vista-administrativo' ? 'active' : ''}`}
            >
              Panel Administrativo
            </Link>
          )}

          {(esGerencial || esSupervisor) && (
            <Link
              to="/dashboard-obras"
              className={`nav-link ${location.pathname === '/dashboard-obras' ? 'active' : ''}`}
            >
              Obras
            </Link>
          )}

          {puedeAccederFinanzas && (
            <Link
              to="/resumen-financiero"
              className={`nav-link ${location.pathname === '/resumen-financiero' ? 'active' : ''}`}
            >
              Resumen Financiero
            </Link>
          )}

          {puedeAccederFinanzas && (
            <Link
              to="/nuevo-presupuesto"
              className={`nav-link ${location.pathname === '/nuevo-presupuesto' ? 'active' : ''}`}
            >
              + Presupuesto
            </Link>
          )}

          {(esGerencial || esSupervisor) && (
            <Link to="/nueva-obra" className="btn-primary">
              + Nueva Obra
            </Link>
          )}

          <div className="navbar-user">
            {usuario?.username && (
              <span className="navbar-username" title={usuario.email || usuario.username}>
                {usuario.username}
              </span>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="btn-logout"
              title="Cerrar sesión"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}