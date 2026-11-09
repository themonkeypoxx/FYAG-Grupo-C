import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import NuevaObra from './pages/NuevaObra';
import Login from './pages/Login';
import './App.css';
import RutaProtegida from './Servicios/RutaProtegida';

function Layout() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="app-container">
      {!isLoginPage && <Navbar />}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          {/* Alo, a cada ruta la protegí con RutaProtegida. Metí al técnico tmn*/}
          <Route path="/dashboard" element={<RutaProtegida roles={['Gerencial', 'Supervisor', 'Administrador', 'Tecnico']}><Dashboard /></RutaProtegida>} />
          <Route path="/nueva-obra" element={<RutaProtegida roles={['Gerencial', 'Supervisor']}><NuevaObra /></RutaProtegida>} />
        </Routes>

      </main>
    </div>
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