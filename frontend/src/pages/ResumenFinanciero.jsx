import React, { useCallback, useEffect, useState } from 'react';
import { obtenerResumenFinanciero, exportarResumenFinancieroPDF } from '../Servicios/resumenFinancieroService';
import obrasService from '../Servicios/obrasService';
import GraficosFinancieros from '../components/GraficosFinancieros';
import './ResumenFinanciero.css';

const OPCIONES_EXPORTACION = [
    {
        id: 'indicadores',
        titulo: 'Indicadores Financieros y KPIs',
        descripcion: 'Total facturado, total cobrado, deudas y tasa de morosidad.',
        icono: '📊',
    },
    {
        id: 'obras_estado',
        titulo: 'Distribución de Obras por Estado',
        descripcion: 'Conteo y porcentaje de obras según su estado operativo.',
        icono: '🏗️',
    },
    {
        id: 'facturas_estado',
        titulo: 'Desglose de Facturas por Estado',
        descripcion: 'Montos y saldos por estado de pago (Pagado, Parcial, Pendiente).',
        icono: '🧾',
    },
    {
        id: 'evolucion_mensual',
        titulo: 'Evolución Mensual de Facturación',
        descripcion: 'Histórico mensual de montos emitidos vs pagos recaudados.',
        icono: '📈',
    },
    {
        id: 'presupuesto_real',
        titulo: 'Comparativa Presupuesto vs Costo Real',
        descripcion: 'Comparativa económica de costo estimado vs real por servicio.',
        icono: '⚖️',
    },
    {
        id: 'top_morosos',
        titulo: 'Ranking de Clientes Morosos',
        descripcion: 'Clientes con facturas vencidas y mayor deuda pendiente.',
        icono: '⚠️',
    },
];

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

    // Estados para el Modal de Exportación a PDF
    const [modalPDF, setModalPDF] = useState(false);
    const [seccionesSeleccionadas, setSeccionesSeleccionadas] = useState(
        OPCIONES_EXPORTACION.reduce((acc, opt) => ({ ...acc, [opt.id]: true }), {})
    );
    const [exportandoPDF, setExportandoPDF] = useState(false);
    const [errorPDF, setErrorPDF] = useState(null);

    const toggleSeccion = (id) => {
        setSeccionesSeleccionadas((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
        setErrorPDF(null);
    };

    const seleccionarTodas = (valor) => {
        setSeccionesSeleccionadas(
            OPCIONES_EXPORTACION.reduce((acc, opt) => ({ ...acc, [opt.id]: valor }), {})
        );
        setErrorPDF(null);
    };

    const handleExportarPDF = async () => {
        const seleccionadas = Object.keys(seccionesSeleccionadas).filter(
            (k) => seccionesSeleccionadas[k]
        );

        if (seleccionadas.length === 0) {
            setErrorPDF('Debes seleccionar al menos un elemento para exportar.');
            return;
        }

        setExportandoPDF(true);
        setErrorPDF(null);

        try {
            const data = await exportarResumenFinancieroPDF(seleccionadas);
            const blob = new Blob([data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const hoyStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            link.setAttribute('download', `resumen_financiero_${hoyStr}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setModalPDF(false);
        } catch (err) {
            console.error('Error al exportar PDF:', err);
            setErrorPDF(
                err.response?.status === 403
                    ? 'No tienes permisos para exportar el resumen financiero.'
                    : 'Error al generar el archivo PDF. Intente de nuevo.'
            );
        } finally {
            setExportandoPDF(false);
        }
    };

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
            <header className="rf-header">
                <div>
                    <h1 className="rf-header-title">
                        Resumen Financiero y KPIs
                    </h1>
                    <p className="rf-header-subtitle">
                        Indicadores económicos, facturación, morosidad y estado de obras.
                    </p>
                </div>

                <button
                    type="button"
                    className="btn-primary rf-btn-exportar"
                    onClick={() => {
                        setErrorPDF(null);
                        setModalPDF(true);
                    }}
                    title="Exportar resumen financiero a PDF"
                >
                    <span>📥</span> Exportar a PDF
                </button>
            </header>

            {cargando ? (
                <p className="rf-loading">
                    Cargando información financiera y KPIs...
                </p>
            ) : error ? (
                <div className="rf-error-card">
                    <p className="rf-error-text">
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
                    <section aria-label="Indicadores financieros" className="rf-kpi-grid">
                        {indicadores.map((indicador) => (
                            <article key={indicador.titulo} className="rf-kpi-card">
                                <h2 className="rf-kpi-title">
                                    {indicador.titulo}
                                </h2>
                                <p className="rf-kpi-valor">
                                    {indicador.valor}
                                </p>
                                <p className="rf-kpi-desc">
                                    {indicador.descripcion}
                                </p>
                            </article>
                        ))}
                    </section>

                    {/* Sección de Obras por Estado */}
                    {resumenEstados?.estados && (
                        <section aria-label="Distribución de obras por estado" className="rf-obras-section">
                            <div className="rf-obras-header">
                                <div>
                                    <h2 className="rf-obras-title">
                                        Distribución de Obras por Estado
                                    </h2>
                                    <p className="rf-obras-subtitle">
                                        Consultas agregadas y porcentaje de distribución sobre el total de obras activas.
                                    </p>
                                </div>
                                <span className="rf-obras-badge-total">
                                    Total: {resumenEstados.total_obras || 0} obras
                                </span>
                            </div>

                            <div className="rf-obras-grid">
                                {resumenEstados.estados.map((est) => (
                                    <div key={est.id_estado_obra} className="rf-obra-card">
                                        <div className="rf-obra-card-top">
                                            <span className="rf-obra-label">
                                                {est.descripcion}
                                            </span>
                                            <span className="rf-obra-cant">
                                                {est.cantidad_obras}
                                            </span>
                                        </div>
                                        <div className="rf-obra-progress-bg">
                                            <div
                                                className="rf-obra-progress-fill"
                                                style={{ width: `${Math.min(est.porcentaje || 0, 100)}%` }}
                                            />
                                        </div>
                                        <span className="rf-obra-pct">
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

            {/* MODAL: SELECCIÓN DE ELEMENTOS PARA EXPORTAR A PDF */}
            {modalPDF && (
                <div
                    className="rf-modal-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !exportandoPDF) {
                            setModalPDF(false);
                        }
                    }}
                >
                    <div className="rf-modal-card" onClick={(e) => e.stopPropagation()}>
                        {/* Cabecera del modal */}
                        <div className="rf-modal-header">
                            <div>
                                <h3 className="rf-modal-title">
                                    📥 Exportar Resumen Financiero a PDF
                                </h3>
                                <p className="rf-modal-subtitle">
                                    Elige los elementos y secciones que deseas incluir en el reporte:
                                </p>
                            </div>
                            <button
                                type="button"
                                className="rf-modal-close-btn"
                                onClick={() => setModalPDF(false)}
                                disabled={exportandoPDF}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Barra de selección rápida */}
                        <div className="rf-modal-quickbar">
                            <span className="rf-modal-counter">
                                {Object.values(seccionesSeleccionadas).filter(Boolean).length} de {OPCIONES_EXPORTACION.length} seleccionados
                            </span>
                            <div className="rf-modal-quick-actions">
                                <button
                                    type="button"
                                    className="rf-link-btn"
                                    onClick={() => seleccionarTodas(true)}
                                    disabled={exportandoPDF}
                                >
                                    Marcar todos
                                </button>
                                <span className="rf-quick-divider">|</span>
                                <button
                                    type="button"
                                    className="rf-link-btn muted"
                                    onClick={() => seleccionarTodas(false)}
                                    disabled={exportandoPDF}
                                >
                                    Desmarcar todos
                                </button>
                            </div>
                        </div>

                        {/* Lista de elementos seleccionables */}
                        <div className="rf-modal-body">
                            {OPCIONES_EXPORTACION.map((opc) => {
                                const activo = !!seccionesSeleccionadas[opc.id];
                                return (
                                    <div
                                        key={opc.id}
                                        onClick={() => !exportandoPDF && toggleSeccion(opc.id)}
                                        className={`rf-option-card ${activo ? 'activo' : ''} ${exportandoPDF ? 'disabled' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            id={`sec_${opc.id}`}
                                            checked={activo}
                                            onChange={() => toggleSeccion(opc.id)}
                                            disabled={exportandoPDF}
                                            className="rf-option-checkbox"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="rf-option-icon">
                                            {opc.icono}
                                        </span>
                                        <div className="rf-option-info">
                                            <div className="rf-option-title">
                                                {opc.titulo}
                                            </div>
                                            <div className="rf-option-desc">
                                                {opc.descripcion}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Alerta de error */}
                            {errorPDF && (
                                <div className="rf-modal-error">
                                    ⚠️ {errorPDF}
                                </div>
                            )}
                        </div>

                        {/* Botones de acción al pie */}
                        <div className="rf-modal-footer">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setModalPDF(false)}
                                disabled={exportandoPDF}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn-primary rf-btn-submit"
                                onClick={handleExportarPDF}
                                disabled={exportandoPDF || Object.values(seccionesSeleccionadas).filter(Boolean).length === 0}
                            >
                                {exportandoPDF ? (
                                    <>⏳ Generando PDF...</>
                                ) : (
                                    <>📥 Descargar PDF</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
