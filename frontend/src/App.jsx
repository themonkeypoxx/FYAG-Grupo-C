import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import NuevaObra from './pages/NuevaObra';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nueva-obra" element={<NuevaObra />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
