# Estas son las rutas que va a consultar el frontend - Ismael

from django.urls import path, include
from rest_framework import routers
from .financial_views import ( ResumenFinancieroView,KPIsDashboardView,AgregacionFacturacionView,AgregacionMorosidadView,)
from .views import *



# Versionado de API
router = routers.DefaultRouter()

router.register("clientes", ClienteViewSet, basename="cliente")
router.register("obras", Crud_obras, basename="obra")
router.register("tipos-servicio", TipoServicioViewSet, basename="tipo-servicio")
router.register("estados-obra", EstadoObraViewSet, basename="estado-obra")
router.register("obras-asignadas", ObrasAsignadasViewSet, basename="obras-asignadas")
router.register("asignaciones-tecnico", AsignacionTecnicoViewSet, basename="asignacion-tecnico")
router.register("solicitudes-cambio-obra", SolicitudCambioObraViewSet, basename="solicitud-cambio-obra")
router.register("notificaciones-tecnico", NotificacionTecnicoViewSet, basename="notificacion-tecnico")
router.register("presupuestos", PresupuestoViewSet, basename="presupuesto")
router.register("items-presupuesto", ItemPresupuestoViewSet, basename="item-presupuesto")
router.register("facturas", FacturaViewSet, basename="factura")
router.register("pagos", RegistroPagoViewSet, basename="registro-pago")
router.register("materiales", MaterialViewSet, basename="material")
router.register("asignaciones-material", AsignacionMaterialViewSet, basename="asignacion-material")



urlpatterns = [
    path(
        "fyag/v1/resumen-financiero/",
        ResumenFinancieroView.as_view(),
        name="resumen-financiero"
    ),
    path(
        "fyag/v1/kpis/",
        KPIsDashboardView.as_view(),
        name="kpis-dashboard"
    ),
    path("fyag/v1/", include(router.urls)),
    path(
        "fyag/v1/agregaciones/facturacion/",
        AgregacionFacturacionView.as_view(),
        name="agregacion-facturacion"
    ),
    path(
        "fyag/v1/agregaciones/morosidad/",
        AgregacionMorosidadView.as_view(),
        name="agregacion-morosidad"
    ),
]
