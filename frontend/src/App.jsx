import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NuevaObra from './pages/NuevaObra';
import AccesoDenegado from './pages/AccesoDenegado';
import RutaProtegida from './Servicios/RutaProtegida';
import './App.css';

function Layout() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login' || location.pathname === '/';

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* 
          Rutas protegidas por rol (Criterio: Manipulación de URL):
          En caso que un usuario no Gerente intente manipular la URL para acceder 
          al dashboard o al registro de auditoría, el sistema valida el rol y muestra 403 Forbidden.
        */}
        <Route
          path="/dashboard"
          element={
            <RutaProtegida roles={['Gerencial']}>
              <Dashboard />
            </RutaProtegida>
          }
        />
        <Route
          path="/auditoria"
          element={
            <RutaProtegida roles={['Gerencial']}>
              <div className="main-content" style={{ textAlign: 'center', padding: '3rem' }}>
                <h2>Registro de Auditoría</h2>
                <p style={{ color: 'var(--text-muted)' }}>Módulo de auditoría (confidencial - solo Gerencia).</p>
              </div>
            </RutaProtegida>
          }
        />
        <Route
          path="/registro-auditoria"
          element={
            <RutaProtegida roles={['Gerencial']}>
              <div className="main-content" style={{ textAlign: 'center', padding: '3rem' }}>
                <h2>Registro de Auditoría</h2>
                <p style={{ color: 'var(--text-muted)' }}>Módulo de auditoría (confidencial - solo Gerencia).</p>
              </div>
            </RutaProtegida>
          }
        />

        <Route
          path="/nueva-obra"
          element={
            <RutaProtegida roles={['Gerencial', 'Supervisor']}>
              <NuevaObra />
            </RutaProtegida>
          }
        />

        {/* Ruta directa para error 403 Forbidden / Acceso Denegado */}
        <Route path="/acceso-denegado" element={<AccesoDenegado />} />
        <Route path="/403" element={<AccesoDenegado />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}

export default App;
