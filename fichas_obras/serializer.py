from rest_framework import serializers
from .models import *
from .validators import validar_rut
from .services import obtener_transiciones_posibles, validar_transicion_estado
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
    transiciones_posibles = serializers.SerializerMethodField()

    class Meta:
        model = Obra
        fields = '__all__'

    def get_supervisor_nombre(self, obj):
        if not obj.supervisor:
            return "Sin asignar"
        full = obj.supervisor.get_full_name()
        return full if full else obj.supervisor.username

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



###VOY A DEJAR COMENTARIOS PARA ENTENDERLO BIEN DPS -I !!!!
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