import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import authService from '../Servicios/authService';

export default function Navbar() {
  const location = useLocation();
  const esTecnico = authService.tieneRol('Tecnico');
  const esAdministrativo = authService.tieneRol('Administrativo');
  const esGerencial = authService.tieneRol('Gerencial');
  const esSupervisor = authService.tieneRol('Supervisor');

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

          {(esGerencial || esSupervisor || esAdministrativo) && (
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
        </nav>
      </div>
    </header>
  );
}
