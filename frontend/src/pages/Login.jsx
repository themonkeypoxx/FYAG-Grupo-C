import { useState } from 'react';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Intentando iniciar sesión con:", { email, password });
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card shadow-lg p-4" style={{ width: '100%', maxWidth: '400px', borderTop: '5px solid #0F2942' }}>
        
        <div className="text-center mb-4">
          <h2 style={{ color: '#0F2942', fontWeight: 'bold' }}>FYAG</h2>
          <p className="text-muted">Panel de Administración</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label fw-bold" style={{ color: '#0F2942' }}>
              Correo Electrónico
            </label>
            <input 
              type="email" 
              className="form-control" 
              id="email" 
              placeholder="usuario@fyag.cl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="password" className="form-label fw-bold" style={{ color: '#0F2942' }}>
              Contraseña
            </label>
            <input 
              type="password" 
              className="form-control" 
              id="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          
          <button 
            type="submit" 
            className="btn w-100 text-white fw-bold" 
            style={{ backgroundColor: '#1A56DB', border: 'none', padding: '10px' }}
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;