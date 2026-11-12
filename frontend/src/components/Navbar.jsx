import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import authService from '../Servicios/authService';

export default function Navbar() {
  const location = useLocation();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          <div className="brand-logo">FYAG</div>
          <div className="brand-text">
            <h1>Gestión de Obras</h1>
            <span>Climatización & Servicios Industriales</span>
          </div>
        </Link>

        <nav className="nav-links">
          <Link
            to={authService.tieneRol('Tecnico') ? '/vista-tecnico' : '/dashboard-obras'}
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            {authService.tieneRol('Tecnico') ? 'Mi horario' : 'Obras'}
          </Link>
          {!authService.tieneRol('Tecnico') && <Link
            to="/nueva-obra"
            className="btn-primary"
          >
            + Nueva Obra
          </Link>}
        </nav>
      </div>
    </header>
  );
}

