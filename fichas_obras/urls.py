#Estas son las rutas q va a consultar el frontend !!!!!! - Ismael
from django.urls import path, include
from rest_framework import routers
from fichas_obras import views

#versionado de api
router = routers.DefaultRouter()
router.register(r'Obras', views.Crud_obras, 'obras')

urlpatterns = [
    path("fyag/v1/", include(router.urls))
]

## esto solito ya genera todos los GET, POST, PUT Y DELETE PARA LAS OBRAS