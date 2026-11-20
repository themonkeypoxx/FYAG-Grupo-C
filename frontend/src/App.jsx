import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NuevaObra from './pages/NuevaObra';
import NuevoPresupuesto from './pages/NuevoPresupuesto';
import VistaTecnico from './pages/Vista-tecnico';
import PanelAdministrativo from './pages/PanelAdministrativo';
import ResumenFinanciero from './pages/ResumenFinanciero';
import GestionUsuarios from './pages/GestionUsuarios';
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

        <Route
          path="/dashboard-obras"
          element={
            <RutaProtegida roles={['Gerencial', 'Supervisor']}>
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
                <p style={{ color: 'var(--text-muted)' }}>
                  Módulo de auditoría (confidencial - solo Gerencia).
                </p>
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
                <p style={{ color: 'var(--text-muted)' }}>
                  Módulo de auditoría (confidencial - solo Gerencia).
                </p>
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

        <Route
          path="/vista-tecnico"
          element={
            <RutaProtegida roles={['Gerencial', 'Tecnico']}>
              <VistaTecnico />
            </RutaProtegida>
          }
        />

        <Route
          path="/vista-administrativo"
          element={
            <RutaProtegida roles={['Gerencial', 'Administrativo']}>
              <PanelAdministrativo />
            </RutaProtegida>
          }
        />

        <Route
          path="/resumen-financiero"
          element={
            <RutaProtegida roles={['Gerencial', 'Administrativo']}>
              <ResumenFinanciero />
            </RutaProtegida>
          }
        />

        <Route
          path="/nuevo-presupuesto"
          element={
            <RutaProtegida roles={['Gerencial', 'Administrativo']}>
              <NuevoPresupuesto />
            </RutaProtegida>
          }
        />
                <Route
          path="/usuarios"
          element={
            <RutaProtegida roles={['Gerencial']}>
              <GestionUsuarios />
            </RutaProtegida>
          }
        />


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