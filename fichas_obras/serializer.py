from rest_framework import serializers
from .models import *
from .validators import validar_rut
# alo, esto es para mandar los datos cm json al frontend -Ismael

class Obras_Serializer(serializers.ModelSerializer):
    class Meta:
        model = Obra
        fields = '__all__'

class TipoServ_Serializer(serializers.ModelSerializer):
    class Meta:
        model = TipoServicio
        fields = '__all__'
        
class EstadoObra_Serializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoObra
        fields = '__all__'


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