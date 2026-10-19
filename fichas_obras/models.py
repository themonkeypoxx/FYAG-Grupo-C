from django.db import models
import uuid
from django.conf import settings

# Create your models here.
## HOLA
## Este es el CRUD solamente de obras, lo hice como prueba en SQLite3 (la base de datos q usa x defecto Django)
## para cambiarlo a POSTGRESQL es fácil, solo hay que cambiar el bloque de database en fyag_apy/settings.py (línea 85)
## luego hacer las migraciones con python manage.py makemigrations y python manage.py migrate


## AGREGADO: ESTO LO HICE DE PRUEBA, NO ES COMPLETAMENTE FIEL AL MODELO DEL INFORME (No hay relación con cliente, agregar)
## - Ismael, cualquier duda por whatsapp

class TipoServicio(models.Model):
    id_tipo_servicio = models.AutoField(primary_key=True) 
    codigo = models.CharField(max_length=20, unique=True)
    nombre_servicio = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    tarifa_base_referencial = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    class Meta:
        db_table = "tipo_servicio"

    def __str__(self):
        return self.nombre_servicio


class EstadoObra(models.Model):
    id_estado_obra = models.AutoField(primary_key=True)
    codigo_estado = models.CharField(max_length=20, unique=True)
    descripcion = models.CharField(max_length=100)

    class Meta:
        db_table = "estado_obra"

    def __str__(self):
        return self.descripcion



class Obra(models.Model):
    id_obra = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo_obra = models.CharField(max_length=30, unique=True)

    tipo_servicio = models.ForeignKey(
        TipoServicio, on_delete=models.PROTECT,
        db_column="id_tipo_servicio", related_name="obras",
    )
    estado_obra = models.ForeignKey(
        EstadoObra, on_delete=models.PROTECT,
        db_column="id_estado_obra", related_name="obras",
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="id_supervisor", related_name="obras_supervisadas",
    )

    nombre_obra = models.CharField(max_length=200)
    ubicacion_faena = models.CharField(max_length=255)

    fecha_inicio = models.DateField()
    fecha_termino_estimada = models.DateField(null=True, blank=True)
    fecha_cierre_real = models.DateField(null=True, blank=True)

    costo_estimado = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    costo_real = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    motivo_suspension_cancelacion = models.TextField(blank=True)
    soft_deleted = models.BooleanField(default=False)

    class Meta:
        db_table = "obra"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(fecha_termino_estimada__gte=models.F("fecha_inicio"))
                | models.Q(fecha_termino_estimada__isnull=True),
                name="obra_fechas_coherentes",
            ),
        ]

    def __str__(self):
        return f"{self.codigo_obra} - {self.nombre_obra}"

