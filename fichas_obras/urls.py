#Estas son las rutas q va a consultar el frontend !!!!!! - Ismael
from django.urls import path, include
from rest_framework import routers
from .views import *
### este es el único cambio que hice al merge q hicimos -Ismael
from fichas_obras.views import CustomTokenObtainPairView ### aca se usa el custom, no el q viene x defecto
from rest_framework_simplejwt.views import TokenRefreshView

#versionado de api
router = routers.DefaultRouter()
router.register("clientes", ClienteViewSet, basename="cliente")
router.register("obras", Crud_obras, basename="obra")
router.register("tipos-servicio", TipoServicioViewSet, basename="tipo-servicio")
router.register("estados-obra", EstadoObraViewSet, basename="estado-obra")
router.register("obras-asignadas", ObrasAsignadasViewSet, basename= "obras-asignadas")

urlpatterns = [
    path("fyag/v1/", include(router.urls))
]


urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Rutas de Autenticación JWT
    # Lo mismo q puse en las primeras líneas, se usa el custom !!!!- Ismael
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Tus otras rutas (fichas_obras, etc.)
    path('api/', include('fichas_obras.urls')),
]

## esto solito ya genera todos los GET, POST, PUT Y DELETE PARA LAS OBRAS