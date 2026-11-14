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
router.register("obras-asignadas", ObrasAsignadasViewSet, basename= "obras-asignadas")
router.register("asignaciones-tecnico", AsignacionTecnicoViewSet, basename="asignacion-tecnico")
router.register("solicitudes-cambio-obra", SolicitudCambioObraViewSet, basename="solicitud-cambio-obra")
router.register("presupuestos", PresupuestoViewSet, basename="presupuesto")
router.register("items-presupuesto", ItemPresupuestoViewSet, basename="item-presupuesto")
router.register("facturas", FacturaViewSet, basename="factura")
router.register("pagos", RegistroPagoViewSet, basename="registro-pago")

urlpatterns = [
    path("fyag/v1/", include(router.urls))
]

## esto solito ya genera todos los GET, POST, PUT Y DELETE PARA LAS OBRAS
