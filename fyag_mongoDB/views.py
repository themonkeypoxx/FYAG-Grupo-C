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
from .servicios import registrar_evento

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