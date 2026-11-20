from decimal import Decimal
from datetime import time
import uuid
from rest_framework import serializers
from .models import *
from .validators import validar_rut
from .services import obtener_transiciones_posibles, validar_transicion_estado
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from fyag_mongoDB.servicio_maquinarias import obtener_maquinas_por_obra

# Serializador de Tipos de Servicio (Mantención, Climatización, Proyecto eléctrico, Emergencia, Garantía, Proyecto)
class TipoServ_Serializer(serializers.ModelSerializer):
    class Meta:
        model = TipoServicio
        fields = '__all__'


# Serializador de Estados de Obra
class EstadoObra_Serializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoObra
        fields = '__all__'


# Serializador de Clientes con validación de RUT chileno
class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = [
            "id_cliente", "rut_empresa", "razon_social", "giro_comercial",
            "direccion_matriz", "comuna", "ciudad",
            "contacto_nombre", "contacto_telefono", "contacto_email",
            "estado_cliente", "soft_deleted",
        ]
        read_only_fields = ["id_cliente", "soft_deleted"]
        extra_kwargs = {"rut_empresa": {"validators": []}}

    def validate_rut_empresa(self, value):
        rut = validar_rut(value)
        existe = Cliente.objects.filter(rut_empresa=rut)
        if self.instance:
            existe = existe.exclude(pk=self.instance.pk)
        if existe.exists():
            raise serializers.ValidationError("Ya existe un cliente con este RUT.")
        return rut


# Serializador de Fichas de Obra enriquecido con clasificación y máquina de estados
class Obras_Serializer(serializers.ModelSerializer):
    # Campos descriptivos de solo lectura para frontend
    tipo_servicio_codigo = serializers.CharField(
        source='tipo_servicio.codigo', read_only=True
    )
    tipo_servicio_nombre = serializers.CharField(
        source='tipo_servicio.nombre_servicio', read_only=True
    )
    estado_obra_codigo = serializers.CharField(
        source='estado_obra.codigo_estado', read_only=True
    )
    estado_obra_descripcion = serializers.CharField(
        source='estado_obra.descripcion', read_only=True
    )
    cliente_razon_social = serializers.CharField(
        source='cliente.razon_social', read_only=True
    )
    cliente_rut = serializers.CharField(
        source='cliente.rut_empresa', read_only=True
    )
    supervisor_nombre = serializers.SerializerMethodField()
    tecnicos_asignados = serializers.SerializerMethodField()
    transiciones_posibles = serializers.SerializerMethodField()
    maquinarias_asignadas = serializers.SerializerMethodField()
    materiales_asignados = serializers.SerializerMethodField()
    costo_materiales = serializers.SerializerMethodField()
    maquinarias_codigos = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True
    )

    class Meta:
        model = Obra
        fields = '__all__'

    def get_maquinarias_asignadas(self, obj):
        try:
            return obtener_maquinas_por_obra(obj.id_obra)
        except Exception:
            return []

    def get_materiales_asignados(self, obj):
        return [
            {
                "id_asignacion_material": a.id_asignacion_material,
                "material": a.material_id,
                "material_codigo": a.material.codigo,
                "material_nombre": a.material.nombre,
                "unidad_medida": a.material.unidad_medida,
                "cantidad": a.cantidad,
                "precio_unitario": a.precio_unitario,
                "total_linea": a.total_linea,
                "observacion": a.observacion,
            }
            for a in obj.asignaciones_material.all()
        ]

    def get_costo_materiales(self, obj):
        return sum((a.total_linea for a in obj.asignaciones_material.all()), Decimal("0"))

    def get_supervisor_nombre(self, obj):
        if not obj.supervisor:
            return "Sin asignar"
        full = obj.supervisor.get_full_name()
        return full if full else obj.supervisor.username

    def get_tecnicos_asignados(self, obj):
        asignaciones = getattr(obj, "asignaciones_activas", None)
        if asignaciones is None:
            asignaciones = obj.asignaciones.filter(activo=True).select_related("tecnico")

        return [
            {
                "id_asignacion": asignacion.id_asignacion,
                "tecnico": asignacion.tecnico_id,
                "tecnico_nombre": asignacion.tecnico.get_full_name() or asignacion.tecnico.username,
                "fecha": str(asignacion.fecha) if asignacion.fecha else None,
                "hora_inicio": str(asignacion.hora_inicio)[:5] if asignacion.hora_inicio else None,
                "hora_termino": str(asignacion.hora_termino)[:5] if asignacion.hora_termino else None,
            }
            for asignacion in asignaciones
        ]

    def get_transiciones_posibles(self, obj):
        if not obj.estado_obra:
            return []
        return obtener_transiciones_posibles(obj.estado_obra.codigo_estado)

    def validate(self, attrs):
        # Si se está actualizando la obra y se intenta modificar el estado directamente
        if self.instance and 'estado_obra' in attrs:
            nuevo_estado = attrs['estado_obra']
            if nuevo_estado != self.instance.estado_obra:
                motivo = attrs.get(
                    'motivo_suspension_cancelacion',
                    self.instance.motivo_suspension_cancelacion
                )
                validar_transicion_estado(
                    self.instance,
                    nuevo_estado.codigo_estado,
                    motivo=motivo
                )
        return attrs


class AsignacionTecnicoSerializer(serializers.ModelSerializer):
    obra_nombre = serializers.CharField(source="obra.nombre_obra", read_only=True)
    obra_codigo = serializers.CharField(source="obra.codigo_obra", read_only=True)
    ubicacion_faena = serializers.CharField(source="obra.ubicacion_faena", read_only=True)
    tipo_servicio_codigo = serializers.CharField(source="obra.tipo_servicio.codigo", read_only=True)
    tipo_servicio_nombre = serializers.CharField(source="obra.tipo_servicio.nombre_servicio", read_only=True)
    estado_obra_codigo = serializers.CharField(source="obra.estado_obra.codigo_estado", read_only=True)
    estado_obra_descripcion = serializers.CharField(source="obra.estado_obra.descripcion", read_only=True)
    tecnico_nombre = serializers.SerializerMethodField()

    class Meta:
        model = AsignacionTecnico
        fields = [
            "id_asignacion", "obra", "tecnico", "fecha", "hora_inicio", "hora_termino",
            "activo", "fecha_asignacion", "obra_nombre", "obra_codigo",
            "ubicacion_faena", "tipo_servicio_codigo", "tipo_servicio_nombre",
            "estado_obra_codigo", "estado_obra_descripcion", "tecnico_nombre",
        ]
        read_only_fields = ["id_asignacion", "fecha_asignacion"]

    def get_tecnico_nombre(self, obj):
        return obj.tecnico.get_full_name() or obj.tecnico.username


    def validate(self, attrs):
        tecnico = attrs.get("tecnico", getattr(self.instance, "tecnico", None))
        fecha = attrs.get("fecha", getattr(self.instance, "fecha", None))
        inicio = attrs.get("hora_inicio", getattr(self.instance, "hora_inicio", None))
        termino = attrs.get("hora_termino", getattr(self.instance, "hora_termino", None))
        activo = attrs.get("activo", getattr(self.instance, "activo", True))
        if tecnico and not tecnico.groups.filter(name__in=["Tecnico", "TECNICO", "Técnico"]).exists():
            raise serializers.ValidationError({"tecnico": "El usuario seleccionado no tiene el rol de técnico."})
        if inicio and termino and termino <= inicio:
            raise serializers.ValidationError({"hora_termino": "Debe ser posterior a la hora de inicio."})
        bloques_permitidos = {
            (time(9, 30), time(13, 30)),
            (time(15, 0), time(17, 0)),
        }
        if activo and inicio and termino and (inicio, termino) not in bloques_permitidos:
            raise serializers.ValidationError({
                "bloque": "Selecciona uno de los bloques permitidos: 09:30–13:30 o 15:00–17:00."
            })
        if tecnico and fecha and inicio and termino and activo:
            conflictos = AsignacionTecnico.objects.filter(
                tecnico=tecnico, fecha=fecha, activo=True,
                hora_inicio__lt=termino, hora_termino__gt=inicio,
            )
            if self.instance:
                conflictos = conflictos.exclude(pk=self.instance.pk)
            if conflictos.exists():
                raise serializers.ValidationError({"horario": "El técnico ya tiene una obra asignada en ese horario."})
        return attrs


class NotificacionTecnicoSerializer(serializers.ModelSerializer):
    obra_codigo = serializers.CharField(source="obra.codigo_obra", read_only=True)
    obra_nombre = serializers.CharField(source="obra.nombre_obra", read_only=True)
    estado_descripcion = serializers.CharField(source="obra.estado_obra.descripcion", read_only=True)

    class Meta:
        model = NotificacionTecnico
        fields = ["id", "obra", "obra_codigo", "obra_nombre", "estado_codigo", "estado_descripcion", "creada_en", "leida"]


class SolicitudCambioObraSerializer(serializers.ModelSerializer):
    obra_codigo = serializers.CharField(source="obra.codigo_obra", read_only=True)
    obra_nombre = serializers.CharField(source="obra.nombre_obra", read_only=True)
    tecnico_nombre = serializers.SerializerMethodField()
    supervisor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudCambioObra
        fields = [
            "id_solicitud", "obra", "obra_codigo", "obra_nombre", "tecnico",
            "tecnico_nombre", "tipo", "motivo", "estado", "respuesta_supervisor",
            "supervisor_respuesta", "supervisor_nombre", "solicitada_en", "respondida_en",
        ]
        read_only_fields = [
            "id_solicitud", "tecnico", "estado", "supervisor_respuesta",
            "supervisor_nombre", "solicitada_en", "respondida_en",
        ]

    def get_tecnico_nombre(self, obj):
        return obj.tecnico.get_full_name() or obj.tecnico.username

    def get_supervisor_nombre(self, obj):
        if not obj.supervisor_respuesta:
            return None
        return obj.supervisor_respuesta.get_full_name() or obj.supervisor_respuesta.username

    def validate(self, attrs):
        request = self.context.get("request")
        obra = attrs.get("obra", getattr(self.instance, "obra", None))
        if request and request.user.groups.filter(name__in=["Tecnico", "TECNICO", "Técnico"]).exists():
            if not AsignacionTecnico.objects.filter(
                obra=obra, tecnico=request.user, activo=True
            ).exists():
                raise serializers.ValidationError(
                    {"obra": "Solo puedes solicitar cambios sobre obras que tienes asignadas."}
                )

        if obra and obra.estado_obra.codigo_estado in ["FINALIZADA", "CANCELADA"]:
            raise serializers.ValidationError(
                {"obra": "No se puede solicitar un cambio para una obra cerrada."}
            )

        if obra:
            destinos = {
                SolicitudCambioObra.TipoSolicitud.SUSPENSION: "SUSPENDIDA",
                SolicitudCambioObra.TipoSolicitud.CANCELACION: "CANCELADA",
                SolicitudCambioObra.TipoSolicitud.REANUDACION: "EJECUCION",
            }
            destino = destinos.get(attrs.get("tipo", getattr(self.instance, "tipo", None)))
            if destino:
                validar_transicion_estado(obra, destino, attrs.get("motivo", getattr(self.instance, "motivo", "")))

        if self.instance is None and obra and SolicitudCambioObra.objects.filter(
            obra=obra,
            tecnico=request.user if request else None,
            estado=SolicitudCambioObra.EstadoSolicitud.PENDIENTE,
        ).exists():
            raise serializers.ValidationError(
                "Ya existe una solicitud pendiente para esta obra."
            )
        return attrs


class PresupuestoSerializer(serializers.ModelSerializer):
    cliente_razon_social = serializers.CharField(source="cliente.razon_social", read_only=True)
    cliente_rut = serializers.CharField(source="cliente.rut_empresa", read_only=True)
    obra_codigo = serializers.CharField(source="obra.codigo_obra", read_only=True)
    obra_nombre = serializers.CharField(source="obra.nombre_obra", read_only=True)
    obra_estado = serializers.CharField(source="obra.estado_obra.descripcion", read_only=True)
    creador_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Presupuesto
        fields = "__all__"
        read_only_fields = [
            "id_presupuesto",
            "creador",
            "monto_iva",
            "monto_total",
            "soft_deleted",
        ]
        extra_kwargs = {
            "cliente": {"required": False},
            "numero_presupuesto": {"required": False},
        }

    def get_creador_nombre(self, obj):
        if not obj.creador:
            return ""
        full = obj.creador.get_full_name()
        return full if full else obj.creador.username

    def validate(self, attrs):
        obra = attrs.get("obra") or (self.instance.obra if self.instance else None)
        cliente = attrs.get("cliente") or (self.instance.cliente if self.instance else None)

        if not obra:
            raise serializers.ValidationError({"obra": "Debe vincular el presupuesto a un proyecto u obra."})

        # 1. Validación de proyecto activo
        if obra.soft_deleted:
            raise serializers.ValidationError({"obra": "El proyecto seleccionado ha sido eliminado o no está disponible."})

        codigo_estado = obra.estado_obra.codigo_estado.upper() if obra.estado_obra else ""
        if codigo_estado in ["FINALIZADA", "CANCELADA"]:
            desc_estado = obra.estado_obra.descripcion if obra.estado_obra else codigo_estado
            raise serializers.ValidationError({
                "obra": f"No se puede registrar un presupuesto para un proyecto inactivo (estado actual: {desc_estado})."
            })

        # 2. Vinculación con el cliente
        # Si no se envió cliente explícito, se vincula automáticamente el cliente del proyecto
        if not cliente:
            cliente = obra.cliente
            attrs["cliente"] = cliente
        else:
            # Si se envió cliente, debe coincidir con el cliente del proyecto
            if cliente != obra.cliente:
                raise serializers.ValidationError({
                    "cliente": "El cliente seleccionado no coincide con el cliente asociado al proyecto."
                })

        # 3. Validación de cliente activo
        if cliente.soft_deleted or cliente.estado_cliente != Cliente.EstadoCliente.ACTIVO:
            raise serializers.ValidationError({
                "cliente": f"El cliente '{cliente.razon_social}' debe estar activo para registrar un presupuesto (estado actual: {cliente.estado_cliente})."
            })

        # 4. Generación automática del número de presupuesto si no se proporciona
        numero = attrs.get("numero_presupuesto")
        if not numero and not (self.instance and self.instance.numero_presupuesto):
            correlativo = uuid.uuid4().hex[:6].upper()
            attrs["numero_presupuesto"] = f"PRE-{obra.codigo_obra}-{correlativo}"

        # 5. Cálculo coherente de montos (subtotal, IVA 19%, total)
        subtotal = attrs.get("subtotal")
        if subtotal is not None:
            subtotal_decimal = Decimal(str(subtotal))
            iva = round(subtotal_decimal * Decimal("0.19"), 2)
            total = subtotal_decimal + iva
            attrs["monto_iva"] = iva
            attrs["monto_total"] = total

        return attrs


class ItemPresupuestoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPresupuesto
        fields = "__all__"
        read_only_fields = ["id_item", "total_linea"]


class FacturaSerializer(serializers.ModelSerializer):
    cliente_razon_social = serializers.CharField(source="cliente.razon_social", read_only=True)
    cliente_rut = serializers.CharField(source="cliente.rut_empresa", read_only=True)
    numero_presupuesto = serializers.CharField(source="presupuesto.numero_presupuesto", read_only=True)

    class Meta:
        model = Factura
        fields = "__all__"
        read_only_fields = ["id_factura"]
        extra_kwargs = {
            "cliente": {"required": False},
            "saldo_pendiente": {"required": False},
        }

    def validate(self, attrs):
        presupuesto = attrs.get("presupuesto") or (self.instance.presupuesto if self.instance else None)
        if presupuesto and not attrs.get("cliente"):
            attrs["cliente"] = presupuesto.cliente

        monto_total = attrs.get("monto_total") or (self.instance.monto_total if self.instance else None)
        saldo = attrs.get("saldo_pendiente")

        if self.instance is None and saldo is None and monto_total is not None:
            attrs["saldo_pendiente"] = monto_total

        estado = attrs.get("estado_pago")
        if estado:
            if estado == Factura.EstadoPago.PAGADO:
                attrs["saldo_pendiente"] = Decimal("0.00")
            elif estado == Factura.EstadoPago.PENDIENTE and monto_total is not None and saldo is None:
                attrs["saldo_pendiente"] = monto_total

        return attrs


class RegistroPagoSerializer(serializers.ModelSerializer):
    folio_factura = serializers.CharField(source="factura.folio_factura", read_only=True)
    registrador_nombre = serializers.SerializerMethodField()

    class Meta:
        model = RegistroPago
        fields = "__all__"
        read_only_fields = ["id_pago", "fecha_pago", "registrador"]

    def get_registrador_nombre(self, obj):
        if not obj.registrador:
            return ""
        full = obj.registrador.get_full_name()
        return full if full else obj.registrador.username

    def validate(self, attrs):
        factura = attrs.get("factura") or (self.instance.factura if self.instance else None)
        monto = attrs.get("monto_abonado")

        if factura:
            if factura.estado_pago == Factura.EstadoPago.PAGADO or factura.saldo_pendiente <= Decimal("0.00"):
                raise serializers.ValidationError({"monto_abonado": "La factura ya se encuentra pagada en su totalidad."})

            if monto and monto > factura.saldo_pendiente:
                raise serializers.ValidationError({
                    "monto_abonado": f"El monto abonado (${monto}) no puede exceder el saldo pendiente (${factura.saldo_pendiente})."
                })

        return attrs



###VOY A DEJAR COMENTARIOS PARA ENTENDERLO BIEN DPS
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        #se obtiene el token estandar
        token = super().get_token(user)
        #arega claims personalizados DENTRO del token JWT 
        token['username'] = user.username
        token['email'] = user.email
        #se obtienen la lista de nombres de los grupos/roles del usuario
        token['roles'] = list(user.groups.values_list('name', flat=True))
        return token
    def validate(self, attrs):
        #esto personaliza lo que devuelve la respuesta JSON directa al hacer POST
        data = super().validate(attrs)
        #agregamos datos del usuario en la respuesta JSON para que el frontend (react) los pueda leer
        data['username'] = self.user.username
        data['email'] = self.user.email
        data['roles'] = list(self.user.groups.values_list('name', flat=True))
        return data


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = [
            "id_material", "codigo", "nombre", "unidad_medida",
            "stock_actual", "precio_unitario", "activo",
        ]
        read_only_fields = ["id_material"]

    def validate_codigo(self, value):
        return value.strip().upper()


class AsignacionMaterialSerializer(serializers.ModelSerializer):
    obra_codigo = serializers.CharField(source="obra.codigo_obra", read_only=True)
    obra_nombre = serializers.CharField(source="obra.nombre_obra", read_only=True)
    material_codigo = serializers.CharField(source="material.codigo", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    unidad_medida = serializers.CharField(source="material.unidad_medida", read_only=True)
    stock_disponible = serializers.DecimalField(
        source="material.stock_actual", max_digits=12, decimal_places=2, read_only=True
    )
    total_linea = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    asignado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = AsignacionMaterial
        fields = [
            "id_asignacion_material", "obra", "obra_codigo", "obra_nombre",
            "material", "material_codigo", "material_nombre", "unidad_medida",
            "stock_disponible", "cantidad", "precio_unitario", "total_linea",
            "asignado_por", "asignado_por_nombre", "fecha_asignacion", "observacion",
        ]
        read_only_fields = [
            "id_asignacion_material", "precio_unitario", "asignado_por", "fecha_asignacion",
        ]
        extra_kwargs = {"cantidad": {"min_value": Decimal("0.01")}}
        validators = []

    def get_asignado_por_nombre(self, obj):
        u = obj.asignado_por
        return u.get_full_name() or u.username


# ── Gestión de usuarios (solo Gerencia) ──────────────────────────
UserModel = get_user_model()

ROLES_USUARIO = [
    ("GERENCIA", "Gerencia"),
    ("ADMINISTRATIVO", "Administrativo"),
    ("SUPERVISOR", "Supervisor"),
    ("TECNICO", "Técnico"),
]


class UsuarioSerializer(serializers.ModelSerializer):
    username = serializers.CharField(max_length=150)
    rol = serializers.ChoiceField(choices=ROLES_USUARIO, write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    roles = serializers.SerializerMethodField()

    class Meta:
        model = UserModel
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "rol", "roles", "password", "is_active", "date_joined",
        ]
        read_only_fields = ["id", "is_active", "date_joined"]
        extra_kwargs = {
            "email": {"required": True},
            "first_name": {"required": True},
            "last_name": {"required": True},
        }

    def get_roles(self, obj):
        return [g.name for g in obj.groups.all()]

    def validate_username(self, value):
        value = value.strip()
        if " " in value:
            raise serializers.ValidationError("El nombre de usuario no puede tener espacios.")
        if UserModel.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese nombre de usuario.")
        return value

    def validate_email(self, value):
        value = value.strip()
        if UserModel.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese correo.")
        return value

    def validate(self, attrs):
        usuario_temporal = UserModel(
            username=attrs.get("username", ""),
            email=attrs.get("email", ""),
            first_name=attrs.get("first_name", ""),
            last_name=attrs.get("last_name", ""),
        )
        try:
            password_validation.validate_password(attrs["password"], user=usuario_temporal)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return attrs

    def create(self, validated_data):
        rol = validated_data.pop("rol")
        password = validated_data.pop("password")
        with transaction.atomic():
            user = UserModel(**validated_data)
            user.set_password(password)
            user.is_staff = False  # no se da acceso al admin de Django
            user.save()
            grupo, _ = Group.objects.get_or_create(name=rol)
            user.groups.add(grupo)
        return user