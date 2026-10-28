from rest_framework import viewsets
from .serializer import *
from .models import *
# Create your views here.


#### esto hace todo el crud, usando el serializer q ya hice
##### se supone q con esto ya debería ser posible hacer POST, GET, ETC (queryset)
class Crud_obras(viewsets.ModelViewSet):
    serializer_class = Obras_Serializer
    # esto ya deja configurado el queryset
    queryset = Obra.objects.all()

class TipoServicioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TipoServicio.objects.all().order_by("nombre_servicio")
    serializer_class = TipoServ_Serializer


class EstadoObraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EstadoObra.objects.all()
    serializer_class = EstadoObra_Serializer

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer