#Estas son las rutas q va a consultar el frontend !!!!!! - Ismael
from django.urls import path, include
from rest_framework import routers
from .views import *

#versionado de api
router = routers.DefaultRouter()
router.register("clientes", ClienteViewSet, basename="cliente")
router.register("obras", Crud_obras, basename="obra")
router.register("tipos-servicio", TipoServicioViewSet, basename="tipo-servicio")
router.register("estados-obra", EstadoObraViewSet, basename="estado-obra")

urlpatterns = [
    path("fyag/v1/", include(router.urls))
]

## esto solito ya genera todos los GET, POST, PUT Y DELETE PARA LAS OBRAS