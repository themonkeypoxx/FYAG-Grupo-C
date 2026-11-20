import React, { useCallback, useEffect, useState } from 'react';
import { obtenerResumenFinanciero } from '../Servicios/resumenFinancieroService';
import obrasService from '../Servicios/obrasService';
import GraficosFinancieros from '../components/GraficosFinancieros';


const formatearCLP = (monto) => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(Number(monto) || 0);
};

export default function ResumenFinanciero() {
    const [resumen, setResumen] = useState(null);
    const [resumenEstados, setResumenEstados] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');


    const cargarResumen = useCallback(async () => {
        setCargando(true);
        setError('');

        try {
            const [datosFinancieros, datosEstados] = await Promise.all([
                obtenerResumenFinanciero(),
                obrasService.getResumenEstados().catch(() => null),
            ]);
            setResumen(datosFinancieros);
            setResumenEstados(datosEstados);
        } catch (err) {
            if (err.response?.status === 403) {
                setError('No tienes permisos para consultar la información financiera.');
            } else {
                setError('No fue posible obtener los indicadores financieros.');
            }
        } finally {
            setCargando(false);
        }
    }, []);


    useEffect(() => {
        cargarResumen();
    }, [cargarResumen]);


    const indicadores = resumen ? [
        {
            titulo: 'Total facturado',
            valor: formatearCLP(resumen.total_facturado),
            descripcion: 'Monto total emitido en facturas',
        },
        {
            titulo: 'Total cobrado',
            valor: formatearCLP(resumen.total_cobrado),
            descripcion: 'Dinero recibido y registrado',
        },
        {
            titulo: 'Presupuesto estimado',
            valor: formatearCLP(resumen.presupuesto_estimado),
            descripcion: 'Valor estimado de las obras',
        },
        {
            titulo: 'Saldo estimado por cobrar',
            valor: formatearCLP(resumen.saldo_estimado_por_cobrar),
            descripcion: 'Presupuesto de obras menos pagos asociados',
        },
        {
            titulo: 'Deuda pendiente',
            valor: formatearCLP(resumen.deuda_pendiente),
            descripcion: 'Saldo pendiente de cobro',
        },
        {
            titulo: 'Deuda vencida',
            valor: formatearCLP(resumen.deuda_vencida),
            descripcion: 'Saldo de facturas vencidas',
        },
        {
            titulo: 'Porcentaje de morosidad',
            valor: `${Number(resumen.porcentaje_morosidad || 0).toFixed(2)}%`,
            descripcion: 'Proporción de deuda vencida',
        },
    ] : [];

    return (
        <main className="main-content">
            <header
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--border)',
                }}
            >
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                        Resumen Financiero y KPIs
                    </h1>

                    <p style={{ color: 'var(--text-muted)' }}>
                        Indicadores económicos, facturación, morosidad y estado de obras.
                    </p>
                </div>

                <button
                    type="button"
                    className="btn-primary"
                    disabled
                    title="La generación del PDF será integrada por otro integrante del equipo."
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                >
                    Exportar PDF
                </button>
            </header>

            {cargando ? (
                <p style={{ textAlign: 'center', padding: '3rem' }}>
                    Cargando información financiera y KPIs...
                </p>
            ) : error ? (
                <div
                    style={{
                        padding: '2rem',
                        textAlign: 'center',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                    }}
                >
                    <p style={{ color: '#dc2626', marginBottom: '1rem' }}>
                        {error}
                    </p>

                    <button
                        type="button"
                        className="btn-primary"
                        onClick={cargarResumen}
                    >
                        Reintentar
                    </button>
                </div>
            ) : (
                <>
                    <section
                        aria-label="Indicadores financieros"
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: '1.25rem',
                        }}
                    >
                        {indicadores.map((indicador) => (
                            <article
                                key={indicador.titulo}
                                style={{
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    boxShadow: 'var(--shadow-sm)',
                                }}
                            >
                                <h2
                                    style={{
                                        fontSize: '0.95rem',
                                        color: 'var(--text-muted)',
                                        marginBottom: '0.75rem',
                                    }}
                                >
                                    {indicador.titulo}
                                </h2>

                                <p
                                    style={{
                                        fontSize: '1.65rem',
                                        fontWeight: 800,
                                        overflowWrap: 'anywhere',
                                        marginBottom: '0.5rem',
                                    }}
                                >
                                    {indicador.valor}
                                </p>

                                <p
                                    style={{
                                        fontSize: '0.85rem',
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    {indicador.descripcion}
                                </p>
                            </article>
                        ))}
                    </section>

                    {/* Sección de Obras por Estado */}
                    {resumenEstados?.estados && (
                        <section
                            aria-label="Distribución de obras por estado"
                            style={{
                                marginTop: '2.5rem',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                boxShadow: 'var(--shadow-sm)',
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '1.25rem',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem',
                                }}
                            >
                                <div>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                        Distribución de Obras por Estado
                                    </h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                        Consultas agregadas y porcentaje de distribución sobre el total de obras activas.
                                    </p>
                                </div>
                                <span
                                    style={{
                                        fontSize: '0.95rem',
                                        fontWeight: 700,
                                        background: 'var(--surface-variant, #e0e7ff)',
                                        color: 'var(--primary, #4338ca)',
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '9999px',
                                    }}
                                >
                                    Total: {resumenEstados.total_obras || 0} obras
                                </span>
                            </div>

                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '1rem',
                                }}
                            >
                                {resumenEstados.estados.map((est) => (
                                    <div
                                        key={est.id_estado_obra}
                                        style={{
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            padding: '1rem',
                                            background: 'var(--surface-variant, #f9fafb)',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'baseline',
                                                marginBottom: '0.5rem',
                                            }}
                                        >
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                                {est.descripcion}
                                            </span>
                                            <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>
                                                {est.cantidad_obras}
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                width: '100%',
                                                height: '6px',
                                                backgroundColor: '#e5e7eb',
                                                borderRadius: '3px',
                                                overflow: 'hidden',
                                                marginBottom: '0.4rem',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: `${Math.min(est.porcentaje || 0, 100)}%`,
                                                    height: '100%',
                                                    backgroundColor: 'var(--primary, #3b82f6)',
                                                }}
                                            />
                                        </div>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {est.porcentaje !== undefined ? `${est.porcentaje}% del total` : ''}
                                           
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    <GraficosFinancieros />
                </>
            )}
        </main>
    );
}
