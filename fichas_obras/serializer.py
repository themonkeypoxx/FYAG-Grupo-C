from rest_framework import serializers
from .models import *
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