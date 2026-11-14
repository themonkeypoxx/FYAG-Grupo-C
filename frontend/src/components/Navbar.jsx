import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import authService from '../Servicios/authService';

export default function Navbar() {
  const location = useLocation();
  const puedePresupuestar = authService.tieneRol('Gerencial', 'Administrativo');

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
            to="/dashboard"
            className={`nav-link ${location.pathname === '/dashboard' || location.pathname === '/' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          {puedePresupuestar && (
            <Link
              to="/nuevo-presupuesto"
              className={`nav-link ${location.pathname === '/nuevo-presupuesto' ? 'active' : ''}`}
            >
              + Presupuesto
            </Link>
          )}
          <Link
            to="/nueva-obra"
            className="btn-primary"
          >
            + Nueva Obra
          </Link>
        </nav>
      </div>
    </header>
  );
}

