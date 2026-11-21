from rest_framework.views import APIView
from rest_framework.response import Response

from .permissions import EsGerencial, EsAdministrativo

from .resumen_financiero import (
    calcular_total_estimado_obras,
    calcular_total_cobrado,
    calcular_total_facturado,
    calcular_deuda_pendiente,
    calcular_deuda_vencida,
    calcular_porcentaje_morosidad,
    calcular_saldo_estimado_por_cobrar,
    obtener_kpis_completos,
    obtener_agregacion_facturacion_mensual,
    obtener_agregacion_morosidad_clientes,
    obtener_agregacion_presupuesto_vs_real,
)

class ResumenFinancieroView(APIView):
    """
    Vista de resumen financiero para gerencia y administración.
    Incluye indicadores clave de facturación, cobranza y morosidad.
    """

    permission_classes = [EsGerencial | EsAdministrativo]

    def get(self, request):
        datos_financieros = {
            "total_facturado": str(calcular_total_facturado()),
            "presupuesto_estimado": str(calcular_total_estimado_obras()),
            "total_cobrado": str(calcular_total_cobrado()),
            "deuda_pendiente": str(calcular_deuda_pendiente()),
            "deuda_vencida": str(calcular_deuda_vencida()),
            "porcentaje_morosidad": str(calcular_porcentaje_morosidad()),
            "saldo_estimado_por_cobrar": str(calcular_saldo_estimado_por_cobrar()),
        }

        return Response(datos_financieros)


class KPIsDashboardView(APIView):
    """
    Vista agregada de KPIs completos:
    - Facturación
    - Obras por estado
    - Morosidad
    """

    permission_classes = [EsGerencial | EsAdministrativo]

    def get(self, request):
        return Response(obtener_kpis_completos())


class AgregacionFacturacionView(APIView):
    permission_classes = [EsGerencial | EsAdministrativo]
    def get(self, request):
        return Response({
            "evolucion_mensual": obtener_agregacion_facturacion_mensual(),
            "presupuesto_vs_real": obtener_agregacion_presupuesto_vs_real(),
        })

class AgregacionMorosidadView(APIView):
    permission_classes = [EsGerencial | EsAdministrativo]
    def get(self, request):
        return Response({
            "top_clientes_morosos": obtener_agregacion_morosidad_clientes(),
            "resumen": obtener_kpis_completos()["morosidad"],
        })