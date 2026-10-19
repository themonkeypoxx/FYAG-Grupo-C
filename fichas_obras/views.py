from rest_framework import viewsets
from .serializer import *
from .models import Obra
# Create your views here.


class Crud_obras(viewsets.ModelViewSet):
    serializer_class = Obras_Serializer
    queryset = Obra.objects.all()

