from rest_framework import viewsets
from .serializer import *
from .models import *
from .permissions import *
# Create your views here.


#### esto hace todo el crud, usando el serializer q ya hice
##### se supone q con esto ya debería ser posible hacer POST, GET, ETC (queryset)
class Crud_obras(viewsets.ModelViewSet):
    permission_classes = [EsGerencial | EsSupervisor]
    serializer_class = Obras_Serializer
    # esto ya deja configurado el queryset
    queryset = Obra.objects.all()

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
    queryset = Cliente.objects.all()
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