from django.shortcuts import render

# Create your views here.
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from fichas_obras.models import Presupuesto, Factura
from fichas_obras.permissions import EsGerencial, EsAdministrativo
from fichas_obras.resumen_financiero import (
    calcular_total_facturado,
    calcular_total_cobrado,
    calcular_total_estimado_obras,
    calcular_deuda_pendiente,
    calcular_deuda_vencida,
    calcular_porcentaje_morosidad,
    calcular_saldo_estimado_por_cobrar,
    calcular_facturas_por_estado,
    obtener_agregacion_facturacion_mensual,
    obtener_agregacion_morosidad_clientes,
    obtener_agregacion_presupuesto_vs_real,
    calcular_obras_por_estado,
    calcular_conteo_facturas_morosas,
    calcular_clientes_morosos,
)
from .pdf_utils import render_pdf


# ---------------------------------------------------------------------------
# Exportar PRESUPUESTO a PDF
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def presupuesto_pdf(request, pk):
    from django.utils import timezone

    obj = get_object_or_404(Presupuesto, pk=pk, soft_deleted=False)
    items = obj.items.all()
    subtotal = sum(i.total_linea for i in items)

    return render_pdf(
        "pdf/presupuesto.html",
        {
            "obj": obj,
            "items": [
                {
                    "descripcion_item": item.descripcion_item,
                    "unidad_medida": item.unidad_medida,
                    "cantidad": item.cantidad,
                    "precio_unitario": _formatear_clp(item.precio_unitario),
                    "total_linea": _formatear_clp(item.total_linea),
                }
                for item in items
            ],
            "subtotal": _formatear_clp(subtotal),
            "monto_iva": _formatear_clp(obj.monto_iva),
            "total": _formatear_clp(obj.monto_total),
            "fecha_generacion": timezone.localtime(timezone.now()).strftime("%d/%m/%Y %H:%M"),
            "usuario": request.user,
        },
        filename=f"presupuesto_{obj.numero_presupuesto}.pdf",
    )


# ---------------------------------------------------------------------------
# Exportar FACTURA a PDF
# ---------------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def factura_pdf(request, pk):
    from django.utils import timezone

    obj = get_object_or_404(Factura, pk=pk, soft_deleted=False)
    pagos = [
        {"pago": pago, "monto_abonado_formateado": _formatear_clp(pago.monto_abonado)}
        for pago in obj.pagos.all().order_by("fecha_pago")
    ]

    return render_pdf(
        "pdf/factura.html",
        {
            "obj": obj,
            "pagos": pagos,
            "monto_total_formateado": _formatear_clp(obj.monto_total),
            "saldo_pendiente_formateado": _formatear_clp(obj.saldo_pendiente),
            "fecha_generacion": timezone.localtime(timezone.now()).strftime("%d/%m/%Y %H:%M"),
            "usuario": request.user,
        },
        filename=f"factura_{obj.folio_factura}.pdf",
    )


def _formatear_clp(val):
    if val is None:
        return "$0"
    try:
        n = int(round(float(val)))
        return f"${n:,}".replace(",", ".")
    except (ValueError, TypeError):
        return f"${val}"


# ---------------------------------------------------------------------------
# Exportar RESUMEN FINANCIERO a PDF
# ---------------------------------------------------------------------------
class ResumenFinancieroPDFView(APIView):
    permission_classes = [EsGerencial | EsAdministrativo]

    def get(self, request):
        from django.utils import timezone

        # Claves válidas de elementos que se pueden exportar
        elementos_validos = {
            "indicadores",
            "obras_estado",
            "facturas_estado",
            "evolucion_mensual",
            "presupuesto_real",
            "top_morosos",
        }

        # Soporta parámetro ?secciones= o ?elementos= (separados por coma)
        secciones_param = request.query_params.get("secciones") or request.query_params.get("elementos")
        if secciones_param:
            items_solicitados = [s.strip().lower() for s in secciones_param.split(",") if s.strip()]
            seleccionados = {item for item in items_solicitados if item in elementos_validos}
            if not seleccionados:
                seleccionados = set(elementos_validos)
        else:
            seleccionados = set(elementos_validos)

        context = {
            "fecha_generacion": timezone.localtime(timezone.now()).strftime("%d/%m/%Y %H:%M"),
            "usuario": request.user,
            "incluye_indicadores": "indicadores" in seleccionados,
            "incluye_obras_estado": "obras_estado" in seleccionados,
            "incluye_facturas_estado": "facturas_estado" in seleccionados,
            "incluye_evolucion_mensual": "evolucion_mensual" in seleccionados,
            "incluye_presupuesto_real": "presupuesto_real" in seleccionados,
            "incluye_top_morosos": "top_morosos" in seleccionados,
        }

        # 1. Indicadores clave y métricas
        if "indicadores" in seleccionados:
            context["indicadores"] = {
                "total_facturado":           _formatear_clp(calcular_total_facturado()),
                "total_cobrado":             _formatear_clp(calcular_total_cobrado()),
                "presupuesto_estimado":      _formatear_clp(calcular_total_estimado_obras()),
                "deuda_pendiente":           _formatear_clp(calcular_deuda_pendiente()),
                "deuda_vencida":             _formatear_clp(calcular_deuda_vencida()),
                "saldo_estimado_por_cobrar": _formatear_clp(calcular_saldo_estimado_por_cobrar()),
                "porcentaje_morosidad":      f"{calcular_porcentaje_morosidad():.2f}%",
                "facturas_vencidas_cantidad": calcular_conteo_facturas_morosas(),
                "clientes_morosos_cantidad":  calcular_clientes_morosos(),
            }

        # 2. Distribución de obras por estado
        if "obras_estado" in seleccionados:
            context["obras_por_estado"] = calcular_obras_por_estado()

        # 3. Facturación por estado de pago
        if "facturas_estado" in seleccionados:
            facturas_raw = calcular_facturas_por_estado()
            context["facturas_por_estado"] = [
                {
                    "estado_pago": f.get("estado_pago"),
                    "cantidad": f.get("cantidad", 0),
                    "monto_total": _formatear_clp(f.get("monto_total")),
                    "saldo_pendiente": _formatear_clp(f.get("saldo_pendiente")),
                }
                for f in facturas_raw
            ]

        # 4. Evolución mensual de facturación
        if "evolucion_mensual" in seleccionados:
            mensual_raw = obtener_agregacion_facturacion_mensual()
            context["evolucion_mensual"] = [
                {
                    "mes": item.get("mes"),
                    "facturado": _formatear_clp(item.get("facturado")),
                    "cobrado": _formatear_clp(item.get("cobrado")),
                    "pendiente": _formatear_clp(item.get("pendiente")),
                    "cantidad_facturas": item.get("cantidad_facturas", 0),
                }
                for item in mensual_raw
            ]

        # 5. Presupuesto estimado vs costo real por servicio
        if "presupuesto_real" in seleccionados:
            presup_raw = obtener_agregacion_presupuesto_vs_real()
            context["presup_vs_real"] = [
                {
                    "servicio": item.get("servicio"),
                    "cantidad": item.get("cantidad", 0),
                    "costo_estimado": _formatear_clp(item.get("costo_estimado")),
                    "costo_real": _formatear_clp(item.get("costo_real")),
                }
                for item in presup_raw
            ]

        # 6. Top clientes morosos
        if "top_morosos" in seleccionados:
            morosos_raw = obtener_agregacion_morosidad_clientes()
            context["top_morosos"] = [
                {
                    "cliente": item.get("cliente"),
                    "rut": item.get("rut"),
                    "deuda_vencida": _formatear_clp(item.get("deuda_vencida")),
                    "facturas_vencidas": item.get("facturas_vencidas", 0),
                }
                for item in morosos_raw
            ]

        filename = f"resumen_financiero_{timezone.localdate().strftime('%Y%m%d')}.pdf"

        return render_pdf(
            "pdf/resumen_financiero.html",
            context,
            filename=filename,
        )
