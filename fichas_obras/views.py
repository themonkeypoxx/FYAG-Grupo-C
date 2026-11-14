from datetime import date, timedelta

from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response


from rest_framework_simplejwt.views import TokenObtainPairView
from .serializer import CustomTokenObtainPairSerializer

from .models import (
    AsignacionTecnico, Cliente, EstadoObra, Factura, ItemPresupuesto, Obra,
    Presupuesto, RegistroPago, SolicitudCambioObra, TipoServicio,
)
from .permissions import EsGerencial, EsSupervisor, EsAdministrativo, EsTecnico 
#x alguna razon faltaba el import de los demas grupos y solo estaban EsSupervisor y Gerencial *raro
from .serializer import (
    ClienteSerializer,
    EstadoObra_Serializer,
    Obras_Serializer,
    TipoServ_Serializer,
    AsignacionTecnicoSerializer,
    FacturaSerializer,
    ItemPresupuestoSerializer,
    PresupuestoSerializer,
    RegistroPagoSerializer,
    SolicitudCambioObraSerializer,
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
            .prefetch_related(
                Prefetch(
                    "asignaciones",
                    queryset=AsignacionTecnico.objects.filter(activo=True).select_related("tecnico"),
                    to_attr="asignaciones_activas",
                )
            )
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
    permission_classes = [EsGerencial | EsAdministrativo | EsSupervisor  ]
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
        if self.request.user.groups.filter(name__in=['Gerencial', 'GERENCIA', 'Supervisor', 'SUPERVISOR']).exists():
            return Obra.objects.all()

        return Obra.objects.filter(asignaciones__tecnico=self.request.user, asignaciones__activo=True).distinct()


class AsignacionTecnicoViewSet(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsSupervisor | EsTecnico]
    serializer_class = AsignacionTecnicoSerializer
    queryset = AsignacionTecnico.objects.select_related("obra", "tecnico").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.groups.filter(name__in=["Tecnico", "TECNICO", "Técnico"]).exists() and not self.request.user.groups.filter(name__in=["Supervisor", "SUPERVISOR", "Gerencial", "GERENCIA"]).exists():
            return queryset.filter(tecnico=self.request.user, activo=True)
        return queryset

    def _puede_gestionar_asignaciones(self):
        return self.request.user.groups.filter(
            name__in=["Supervisor", "SUPERVISOR", "Gerencial", "GERENCIA", "Gerente", "Gerencia"]
        ).exists()

    def create(self, request, *args, **kwargs):
        if not self._puede_gestionar_asignaciones():
            return Response(
                {"detail": "Solo un supervisor puede crear asignaciones."},
                status=status.HTTP_403_FORBIDDEN,
            )
        fecha_inicio = request.data.get("fecha_inicio")
        fecha_termino = request.data.get("fecha_termino")

        # Se mantiene compatibilidad con las asignaciones antiguas de un solo día.
        if not fecha_inicio and not fecha_termino:
            return super().create(request, *args, **kwargs)

        if not fecha_inicio or not fecha_termino:
            return Response(
                {"fechas": "Debes indicar fecha_inicio y fecha_termino."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            inicio = date.fromisoformat(str(fecha_inicio))
            termino = date.fromisoformat(str(fecha_termino))
        except ValueError:
            return Response(
                {"fechas": "Las fechas deben tener formato YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if termino < inicio:
            return Response(
                {"fechas": "La fecha de término no puede ser anterior a la fecha de inicio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dias_habiles = []
        dia_actual = inicio
        while dia_actual <= termino:
            if dia_actual.weekday() < 5:
                dias_habiles.append(dia_actual)
            dia_actual += timedelta(days=1)

        if not dias_habiles:
            return Response(
                {"fechas": "El intervalo seleccionado no contiene días hábiles."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        datos_base = request.data.copy()
        datos_base.pop("fecha_inicio", None)
        datos_base.pop("fecha_termino", None)
        serializers_por_dia = []

        for dia_habil in dias_habiles:
            datos_dia = datos_base.copy()
            datos_dia["fecha"] = dia_habil.isoformat()
            serializer = self.get_serializer(data=datos_dia)
            serializer.is_valid(raise_exception=True)
            serializers_por_dia.append(serializer)

        with transaction.atomic():
            asignaciones = [serializer.save() for serializer in serializers_por_dia]

        return Response(
            {
                "mensaje": f"Técnico asignado durante {len(asignaciones)} día(s) hábil(es).",
                "asignaciones": self.get_serializer(asignaciones, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        if not self._puede_gestionar_asignaciones():
            return Response({"detail": "Solo un supervisor puede modificar asignaciones."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._puede_gestionar_asignaciones():
            return Response({"detail": "Solo un supervisor puede modificar asignaciones."}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._puede_gestionar_asignaciones():
            return Response({"detail": "Solo un supervisor puede eliminar asignaciones."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="tecnicos")
    def tecnicos(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        tecnicos = User.objects.filter(groups__name__in=["Tecnico", "TECNICO", "Técnico"], is_active=True).distinct().order_by("first_name", "last_name", "username")
        return Response([{"id": user.pk, "username": user.username, "nombre": user.get_full_name() or user.username} for user in tecnicos])


class SolicitudCambioObraViewSet(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsSupervisor | EsTecnico]
    serializer_class = SolicitudCambioObraSerializer
    http_method_names = ["get", "post", "head", "options"]
    queryset = SolicitudCambioObra.objects.select_related(
        "obra", "obra__estado_obra", "tecnico", "supervisor_respuesta"
    ).all()

    def get_queryset(self):
        queryset = super().get_queryset()
        es_gerencia = self.request.user.groups.filter(
            name__in=["Gerencial", "GERENCIA", "Gerente", "Gerencia"]
        ).exists()
        es_supervisor = self.request.user.groups.filter(
            name__in=["Supervisor", "SUPERVISOR"]
        ).exists()
        if es_gerencia:
            return queryset
        if es_supervisor:
            return queryset.filter(obra__supervisor=self.request.user)
        return queryset.filter(tecnico=self.request.user)

    def create(self, request, *args, **kwargs):
        if not request.user.groups.filter(name__in=["Tecnico", "TECNICO", "Técnico"]).exists():
            return Response(
                {"detail": "Solo un técnico puede crear solicitudes."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(tecnico=self.request.user)

    @action(detail=True, methods=["post"], url_path="resolver")
    def resolver(self, request, pk=None):
        if not request.user.groups.filter(
            name__in=["Gerencial", "GERENCIA", "Gerente", "Gerencia", "Supervisor", "SUPERVISOR"]
        ).exists():
            return Response({"detail": "Solo un supervisor puede resolver solicitudes."}, status=status.HTTP_403_FORBIDDEN)

        solicitud = self.get_object()
        if solicitud.estado != SolicitudCambioObra.EstadoSolicitud.PENDIENTE:
            return Response({"detail": "La solicitud ya fue resuelta."}, status=status.HTTP_400_BAD_REQUEST)

        accion = str(request.data.get("accion", "")).upper()
        respuesta = str(request.data.get("respuesta", "")).strip()
        if accion not in ["APROBAR", "RECHAZAR"]:
            return Response(
                {"accion": "Debe ser APROBAR o RECHAZAR."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if accion == "APROBAR":
                codigo_estado = "SUSPENDIDA" if solicitud.tipo == SolicitudCambioObra.TipoSolicitud.SUSPENSION else "CANCELADA"
                obra = Obra.objects.select_for_update().select_related("estado_obra").get(pk=solicitud.obra_id)
                aplicar_transicion_estado(obra, codigo_estado, motivo=solicitud.motivo)
                solicitud.estado = SolicitudCambioObra.EstadoSolicitud.APROBADA
            else:
                solicitud.estado = SolicitudCambioObra.EstadoSolicitud.RECHAZADA

            solicitud.respuesta_supervisor = respuesta
            solicitud.supervisor_respuesta = request.user
            solicitud.respondida_en = timezone.now()
            solicitud.save(update_fields=[
                "estado", "respuesta_supervisor", "supervisor_respuesta", "respondida_en"
            ])

        return Response(self.get_serializer(solicitud).data)


class PresupuestoViewSet(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsAdministrativo | EsSupervisor]
    serializer_class = PresupuestoSerializer
    queryset = Presupuesto.objects.select_related(
        "obra", "cliente", "creador", "aprobador_gerencia"
    ).all()


class ItemPresupuestoViewSet(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsAdministrativo]
    serializer_class = ItemPresupuestoSerializer
    queryset = ItemPresupuesto.objects.select_related("presupuesto").all()


class FacturaViewSet(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsAdministrativo]
    serializer_class = FacturaSerializer
    queryset = Factura.objects.select_related("presupuesto", "cliente").all()


class RegistroPagoViewSet(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsAdministrativo]
    serializer_class = RegistroPagoSerializer
    queryset = RegistroPago.objects.select_related("factura", "registrador").all()

    def perform_create(self, serializer):
        serializer.save(registrador=self.request.user)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
