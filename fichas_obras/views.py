from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Cliente, EstadoObra, Obra, TipoServicio
from .permissions import EsGerencia, EsSupervisor
from .serializer import (
    ClienteSerializer,
    EstadoObra_Serializer,
    Obras_Serializer,
    TipoServ_Serializer,
)
from .services import aplicar_transicion_estado, validar_transicion_estado

class Crud_obras(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsSupervisor]
    """
    CRUD principal de Obras con clasificación por tipo de servicio,
    búsqueda, filtros y máquina de estados operativos.
    """
    serializer_class = Obras_Serializer

    def get_queryset(self):
        queryset = (
            Obra.objects.all()
            .select_related("cliente", "tipo_servicio", "estado_obra", "supervisor")
            .order_by("-fecha_inicio", "codigo_obra")
        )

        params = self.request.query_params

        # 1. Filtro por Tipo de Servicio (por ID o código)
        tipo_param = params.get("tipo_servicio") or params.get("tipo_servicio_codigo")
        if tipo_param:
            if str(tipo_param).isdigit():
                queryset = queryset.filter(tipo_servicio_id=int(tipo_param))
            else:
                queryset = queryset.filter(tipo_servicio__codigo__iexact=tipo_param)

        # 2. Filtro por Estado Operativo (por ID o código)
        estado_param = params.get("estado") or params.get("estado_obra") or params.get("estado_codigo")
        if estado_param:
            if str(estado_param).isdigit():
                queryset = queryset.filter(estado_obra_id=int(estado_param))
            else:
                queryset = queryset.filter(estado_obra__codigo_estado__iexact=estado_param)

        # 3. Filtro por Cliente
        cliente_param = params.get("cliente")
        if cliente_param:
            queryset = queryset.filter(
                Q(cliente__id_cliente=cliente_param) | Q(cliente__rut_empresa__iexact=cliente_param)
            )

        # 4. Búsqueda por texto (código de obra, nombre, ubicación o cliente)
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(codigo_obra__icontains=search)
                | Q(nombre_obra__icontains=search)
                | Q(ubicacion_faena__icontains=search)
                | Q(cliente__razon_social__icontains=search)
            )

        return queryset

    @action(detail=True, methods=["post"], url_path="cambiar-estado")
    def cambiar_estado(self, request, pk=None):
        """
        Ejecuta la transición del estado operativo de una obra según la máquina de estados.
        Payload esperado:
        {
            "nuevo_estado": "EJECUCION" (código de estado) o id numérico,
            "motivo": "Explicación en caso de SUSPENDIDA o CANCELADA"
        }
        """
        obra = self.get_object()
        nuevo_estado_val = request.data.get("nuevo_estado")
        motivo = request.data.get("motivo")

        if not nuevo_estado_val:
            return Response(
                {"error": "Debe especificar el campo 'nuevo_estado' (código o ID)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolver si pasaron código o ID numérico
        if str(nuevo_estado_val).isdigit():
            try:
                estado_obj = EstadoObra.objects.get(pk=int(nuevo_estado_val))
                codigo_destino = estado_obj.codigo_estado
            except EstadoObra.DoesNotExist:
                return Response(
                    {"error": f"No existe el estado con ID {nuevo_estado_val}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            codigo_destino = str(nuevo_estado_val).strip().upper()

        try:
            obra_actualizada = aplicar_transicion_estado(
                obra=obra,
                nuevo_codigo=codigo_destino,
                motivo=motivo
            )
            serializer = self.get_serializer(obra_actualizada)
            return Response(
                {
                    "mensaje": f"Estado cambiado exitosamente a '{obra_actualizada.estado_obra.descripcion}'.",
                    "obra": serializer.data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            mensaje = exc.detail if hasattr(exc, "detail") else str(exc)
            return Response({"error": mensaje}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="resumen-tipos")
    def resumen_tipos(self, request):
        """
        Retorna la cantidad de obras clasificadas por cada uno de los tipos de servicio
        (Mantención, Climatización, Proyecto eléctrico, Emergencia, Garantía, Proyecto).
        """
        tipos = TipoServicio.objects.all().order_by("nombre_servicio")
        conteo_por_tipo = dict(
            Obra.objects.values("tipo_servicio_id")
            .annotate(total=Count("id_obra"))
            .values_list("tipo_servicio_id", "total")
        )

        resultado = []
        total_obras = 0
        for tipo in tipos:
            cant = conteo_por_tipo.get(tipo.id_tipo_servicio, 0)
            total_obras += cant
            resultado.append({
                "id_tipo_servicio": tipo.id_tipo_servicio,
                "codigo": tipo.codigo,
                "nombre_servicio": tipo.nombre_servicio,
                "tarifa_base_referencial": tipo.tarifa_base_referencial,
                "cantidad_obras": cant,
            })

        return Response({
            "total_obras": total_obras,
            "clasificacion": resultado,
        })

    @action(detail=False, methods=["get"], url_path="resumen-estados")
    def resumen_estados(self, request):
        """
        Retorna la cantidad de obras agrupadas por estado operativo.
        """
        estados = EstadoObra.objects.all().order_by("id_estado_obra")
        conteo_por_estado = dict(
            Obra.objects.values("estado_obra_id")
            .annotate(total=Count("id_obra"))
            .values_list("estado_obra_id", "total")
        )

        resultado = []
        total_obras = 0
        for est in estados:
            cant = conteo_por_estado.get(est.id_estado_obra, 0)
            total_obras += cant
            resultado.append({
                "id_estado_obra": est.id_estado_obra,
                "codigo_estado": est.codigo_estado,
                "descripcion": est.descripcion,
                "cantidad_obras": cant,
            })

        return Response({
            "total_obras": total_obras,
            "estados": resultado,
        })


class TipoServicioViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [EsGerencial | EsAdministrativo]
    queryset = TipoServicio.objects.all().order_by("nombre_servicio")
    serializer_class = TipoServ_Serializer


class EstadoObraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EstadoObra.objects.all()
    permission_classes = [EsGerencial | EsSupervisor]
    serializer_class = EstadoObra_Serializer


class ClienteViewSet(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsSupervisor]
    queryset = Cliente.objects.all().order_by("razon_social")
    serializer_class = ClienteSerializer

## Se supone q el portal del técnico es parte del sprint 5, 
# igual dejé configurado esto desde ya
class ObrasAsignadasViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [EsGerencial | EsTecnico | EsSupervisor]
    def get_queryset(self):
        #se configura el queryset para que de todos los elementos solo si es gerente o supervisor
        if self.request.user.groups.filter(name='Gerencial').exists() or self.request.user.groups.filter(name='Supervisor').exists():
            return Obra.objects.all()
        
        return Obra.objects.filter(tecnicos_asignados = self.request.user)
