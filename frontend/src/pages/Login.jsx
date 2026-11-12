import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../Servicios/authService';

function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Intentando iniciar sesión con:", { username, password });
    setError('');
    setCargando(true);

    try {
      {/* Hola, modifiqué aquí para que dependiendo del rol lleve a vista correspondiente - Ismael*/ }
      {/* No modificar estos comentarios - Ismael*/ }
      {/* Como estaremos modelando diferentes roles, la idea esque cada rol tenga sus funciones. 
        Cada q hagan login, serán llevados a su vista correspondiente.
        Como el gerente tiene acceso a todo, si un user tiene rol gerencial + cualquier otro,
        este será llevado a una vista del dashboard gerencial (Sprint 4)
        en la q tmbn habrán botones para llevar a las vistas de los otros roles ! -Ismael !!! holasi*/}
      await authService.login(username, password);
      // Esto es lo q mencioné. Por ahora todos llevan al dashboard d obras, pero POR FAVOR
      //Cndo agreguen las otras vistas, que cada uno lleve a su coso correspondiente.
      if (authService.tieneRol('Gerencial')) {
        navigate('/dashboard-obras');
      } else if (authService.tieneRol('Supervisor')) {
        navigate('/dashboard-obras');
        // - Ismael !!!
      } else if (authService.tieneRol('Tecnico')) {
        navigate('/vista-tecnico')
      }
      else if (authService.tieneRol('Administrativo')) {
        navigate('/dashboard-obras')
        //reemplazar dashboard de obras x la ruta q corresponda para los administrativos, plssss
      }
    } catch (err) {
      setError('Credenciales inválidas. Verifica tu usuario y tu contraseña.');
    } finally {
      setCargando(false);
    }
  };


  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="card shadow-lg p-4" style={{ width: '100%', maxWidth: '400px', borderTop: '5px solid #0F2942' }}>

        <div className="text-center mb-4">
          <h2 style={{ color: '#0F2942', fontWeight: 'bold' }}>FYAG</h2>
          <p className="text-muted">Panel de Administración</p>
        </div>

        {/* Acá deje el msj de error - Ismael */}
        {error && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="username" className="form-label fw-bold" style={{ color: '#0F2942' }}>
              Usuario
            </label>
            <input
              type="text"
              className="form-control"
              id="username"
              placeholder="nombre_usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            disabled={cargando}
          >
            {cargando ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
