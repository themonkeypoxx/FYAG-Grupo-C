import React, { useCallback, useEffect, useState } from 'react';
import usuariosService from '../Servicios/usuariosService';

const ROLES = [
  { value: 'GERENCIA', label: 'Gerencia' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'TECNICO', label: 'Técnico' },
];

const FORM_VACIO = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  rol: '',
  password: '',
  password2: '',
};


const etiquetaRol = (rol) => {
  const s = String(rol || '').trim().toLowerCase();
  if (['gerencia', 'gerencial', 'gerente'].includes(s)) return 'Gerencia';
  if (s === 'administrativo') return 'Administrativo';
  if (s === 'supervisor') return 'Supervisor';
  if (s === 'tecnico' || s === 'técnico') return 'Técnico';
  return rol;
};

const mensajeError = (err) => {
  const data = err?.response?.data;
  if (!data) return 'No se pudo conectar con el servidor. Intenta nuevamente.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  return Object.values(data)
    .flat()
    .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
    .join(' ');
};

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [verClave, setVerClave] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setUsuarios(await usuariosService.listar());
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');

    // Validaciones en el navegador (sin llamar al servidor)
    if (!form.username.trim()) return setError('Ingresa un nombre de usuario.');
    if (/\s/.test(form.username.trim())) return setError('El nombre de usuario no puede tener espacios.');
    if (!form.first_name.trim() || !form.last_name.trim()) return setError('Ingresa nombre y apellido.');
    if (!form.email.trim()) return setError('Ingresa un correo electrónico.');
    if (!form.rol) return setError('Selecciona un rol.');
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (form.password !== form.password2) return setError('Las contraseñas no coinciden.');

    setGuardando(true);
    try {
      const nuevo = await usuariosService.crear({
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        rol: form.rol,
        password: form.password,
      });
      setExito(`Usuario "${nuevo.username}" creado correctamente.`);
      setForm(FORM_VACIO);
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="main-content">
      <div className="form-card" style={{ maxWidth: '780px' }}>
        <h2>👤 Crear usuario</h2>

        {error && (
          <div className="motivo-alerta" role="alert" style={{ marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}
        {exito && (
          <div
            role="status"
            style={{
              background: 'rgba(22, 163, 74, 0.12)',
              color: '#15803d',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            ✅ {exito}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="u-nombre">Nombre *</label>
              <input id="u-nombre" className="form-control" value={form.first_name}
                onChange={cambiar('first_name')} disabled={guardando} />
            </div>
            <div className="form-group">
              <label htmlFor="u-apellido">Apellido *</label>
              <input id="u-apellido" className="form-control" value={form.last_name}
                onChange={cambiar('last_name')} disabled={guardando} />
            </div>
            <div className="form-group">
              <label htmlFor="u-username">Nombre de usuario *</label>
              <input id="u-username" className="form-control" value={form.username}
                onChange={cambiar('username')} disabled={guardando} autoComplete="off" />
            </div>
            <div className="form-group">
              <label htmlFor="u-email">Correo electrónico *</label>
              <input id="u-email" type="email" className="form-control" value={form.email}
                onChange={cambiar('email')} disabled={guardando} />
            </div>
            <div className="form-group">
              <label htmlFor="u-rol">Rol *</label>
              <select id="u-rol" className="form-control" value={form.rol}
                onChange={cambiar('rol')} disabled={guardando}>
                <option value="">Selecciona un rol…</option>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div />
            <div className="form-group">
              <label htmlFor="u-pass">Contraseña * (mínimo 8 caracteres)</label>
              <input id="u-pass" type={verClave ? 'text' : 'password'} className="form-control"
                value={form.password} onChange={cambiar('password')} disabled={guardando}
                autoComplete="new-password" />
            </div>
            <div className="form-group">
              <label htmlFor="u-pass2">Repetir contraseña *</label>
              <input id="u-pass2" type={verClave ? 'text' : 'password'} className="form-control"
                value={form.password2} onChange={cambiar('password2')} disabled={guardando}
                autoComplete="new-password" />
            </div>
          </div>

          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <input type="checkbox" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} />
            Mostrar contraseñas
          </label>

          <button type="submit" className="btn-primary" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </div>

      <div className="form-card" style={{ maxWidth: '780px', marginTop: '1.5rem' }}>
        <h2>Usuarios existentes</h2>
        {cargando ? (
          <p>Cargando…</p>
        ) : usuarios.length === 0 ? (
          <p>No hay usuarios registrados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem' }}>Usuario</th>
                  <th style={{ padding: '0.5rem' }}>Nombre</th>
                  <th style={{ padding: '0.5rem' }}>Correo</th>
                  <th style={{ padding: '0.5rem' }}>Rol</th>
                  <th style={{ padding: '0.5rem' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}><strong>{u.username}</strong></td>
                    <td style={{ padding: '0.5rem' }}>{`${u.first_name} ${u.last_name}`.trim() || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>{u.email || '—'}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {[...new Set((u.roles || []).map(etiquetaRol))].join(', ') || '—'}
                    </td>
                    <td style={{ padding: '0.5rem' }}>{u.is_active ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
