import React, { useState, useEffect } from 'react';

export default function ModalConfirmacion({
  isOpen,
  onClose,
  onConfirmar,
  titulo = 'Confirmar acción',
  mensaje = '¿Está seguro de que desea realizar esta acción?',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  tipo = 'peligro', // 'peligro' | 'exito' | 'primario'
  requiereMotivo = false,
  labelMotivo = 'Motivo:',
  placeholderMotivo = 'Ingrese el motivo para continuar...',
  cargando = false,
}) {
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setErrorMotivo('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (requiereMotivo && !motivo.trim()) {
      setErrorMotivo('Debe ingresar obligatoriamente un motivo para continuar.');
      return;
    }
    setErrorMotivo('');
    if (onConfirmar) {
      onConfirmar(motivo.trim());
    }
  };

  const getBotonEstilo = () => {
    if (tipo === 'peligro') {
      return { backgroundColor: '#dc2626', color: '#ffffff', border: 'none' };
    }
    if (tipo === 'exito') {
      return { backgroundColor: '#16a34a', color: '#ffffff', border: 'none' };
    }
    return { backgroundColor: '#2563eb', color: '#ffffff', border: 'none' };
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '480px', backgroundColor: '#ffffff' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{titulo}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={cargando}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1rem 0' }}>
            <p style={{ margin: 0, color: 'var(--text-main, #1e293b)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              {mensaje}
            </p>

            {requiereMotivo && (
              <div style={{ marginTop: '1rem' }}>
                <label
                  htmlFor="motivo-confirmacion"
                  style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  {labelMotivo}
                </label>
                <textarea
                  id="motivo-confirmacion"
                  value={motivo}
                  onChange={(e) => {
                    setMotivo(e.target.value);
                    if (errorMotivo) setErrorMotivo('');
                  }}
                  rows={3}
                  className="form-control"
                  placeholder={placeholderMotivo}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                  }}
                  disabled={cargando}
                  autoFocus
                />
                {errorMotivo && (
                  <span style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.3rem', display: 'block' }}>
                    {errorMotivo}
                  </span>
                )}
              </div>
            )}
          </div>

          <div
            className="modal-footer"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '1.25rem',
              borderTop: '1px solid #f1f5f9',
              paddingTop: '0.75rem',
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={cargando}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer' }}
            >
              {textoCancelar}
            </button>
            <button
              type="submit"
              style={{
                ...getBotonEstilo(),
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              disabled={cargando}
            >
              {cargando ? 'Procesando...' : textoConfirmar}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
