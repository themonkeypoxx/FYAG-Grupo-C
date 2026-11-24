"""
URL configuration for fyag_api project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
# ahora si lo arregle bien... lo habia puesto en el otro archivo ;( -Ismael
# es para usar el custom token obtain en lugar del q viene x defecto en drf!!!!
from fichas_obras.views import CustomTokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView
from fyag_mongoDB.views import (
    MaquinariaCatalogView,
    AsignarMaquinariaView,
    DashboardMongoAgregacionView,
    AuditoriaLogsListView,
)
from fyag_pdf_back.views import presupuesto_pdf, factura_pdf, ResumenFinancieroPDFView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/maquinarias/', MaquinariaCatalogView.as_view(), name='catalogo-maquinarias'),
    path('api/maquinarias/asignar/', AsignarMaquinariaView.as_view(), name='asignar-maquinaria'),
    path('obras/fyag/v1/maquinarias/', MaquinariaCatalogView.as_view(), name='catalogo-maquinarias-v1'),
    path('obras/', include('fichas_obras.urls')),
    path('obras/fyag/v1/dashboard/mongo-agregacion/', DashboardMongoAgregacionView.as_view(), name='dashboard-mongo-agregacion'),
    # PDF exports - fyag_pdf_back
    path('obras/fyag/v1/presupuestos/<uuid:pk>/pdf/', presupuesto_pdf, name='presupuesto-pdf'),
    path('obras/fyag/v1/facturas/<uuid:pk>/pdf/', factura_pdf, name='factura-pdf'),
    path('obras/fyag/v1/resumen-financiero/pdf/', ResumenFinancieroPDFView.as_view(), name='resumen-financiero-pdf'),
    # AUDITORIA 
    path('obras/fyag/v1/auditoria/', AuditoriaLogsListView.as_view(), name='auditoria-logs'),
]
