from rest_framework.views import APIView
from rest_framework.response import Response

from .permissions import EsGerencial, EsAdministrativo

from .resumen_financiero import (
    calcular_total_estimado_obras,
    calcular_total_cobrado,
    calcular_deuda_pendiente,
    calcular_deuda_vencida,
    calcular_porcentaje_morosidad,
    calcular_saldo_estimado_por_cobrar,
)


class ResumenFinancieroView(APIView):

    permission_classes = [EsGerencial | EsAdministrativo]

    def get(self, request):
        datos_financieros = {
            "presupuesto_estimado": str(calcular_total_estimado_obras()),
            "total_cobrado": str(calcular_total_cobrado()),
            "deuda_pendiente": str(calcular_deuda_pendiente()),
            "deuda_vencida": str(calcular_deuda_vencida()),
            "porcentaje_morosidad": str(calcular_porcentaje_morosidad()),
            "saldo_estimado_por_cobrar": str(calcular_saldo_estimado_por_cobrar()),
        }

        return Response(datos_financieros)