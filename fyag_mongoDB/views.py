from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .servicio_maquinarias import (
    obtener_todas_las_maquinas,
    asignar_maquina_a_obra,
    liberar_maquina
)
from .servicios import (registrar_evento, consultar_auditoria)

#tuve q importar los permisos d usuario pal log -ismael!

from rest_framework.permissions import IsAuthenticated
from fichas_obras.permissions import EsGerencial

class MaquinariaCatalogView(APIView):
    def get(self, request):
        #devuelve las máquinas
        maquinas = obtener_todas_las_maquinas()
        return Response(maquinas)

class AsignarMaquinariaView(APIView):
    def post(self, request):
        codigo = request.data.get("codigo_maquina")
        obra_id = request.data.get("obra_id")

        if not codigo or not obra_id:
            return Response({"error": "Falta codigo_maquina u obra_id"}, status=status.HTTP_400_BAD_REQUEST)

        asignar_maquina_a_obra(codigo, obra_id)

        # registro d auditoria !!!!!!!!!
        registrar_evento(
            request=request,
            accion="ASIGNAR_MAQUINARIA",
            recurso="Maquinaria",
            recurso_id=codigo,
            detalles={"obra_id": str(obra_id)}
        )

        return Response({"mensaje": f"Máquina {codigo} asignada exitosamente a la obra."})
    
from .servicios import registrar_evento, obtener_agregacion_dashboard_mongo

class DashboardMongoAgregacionView(APIView):
    def get(self, request):
        datos = obtener_agregacion_dashboard_mongo()
        return Response(datos)


##########


class AuditoriaLogsListView(APIView):
    permission_classes = [IsAuthenticated, EsGerencial]

    def get(self, request):
        try:
            limite = int(request.query_params.get('limite', request.query_params.get('por_pagina', 50)))
            salto = int(request.query_params.get('salto', request.query_params.get('saltar', 0)))
            pagina = int(request.query_params.get('pagina', 1))
            if salto > 0 and limite > 0:
                pagina = (salto // limite) + 1

            accion = request.query_params.get('accion', None)
            usuario = request.query_params.get('usuario', None)

            datos = consultar_auditoria(
                usuario=usuario,
                accion=accion,
                pagina=pagina,
                por_pagina=limite,
            )
            if "registros" not in datos and "resultados" in datos:
                datos["registros"] = datos["resultados"]

            return Response(datos, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": f"Error al consultar auditoría!: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )