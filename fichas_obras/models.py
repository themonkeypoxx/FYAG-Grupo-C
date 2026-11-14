from django.db import models
import uuid
from django.conf import settings
from django.utils import timezone
 
# Create your models here.
## HOLA
## Este es el CRUD solamente de obras, lo hice como prueba en SQLite3 (la base de datos q usa x defecto Django)
## para cambiarlo a POSTGRESQL es fácil, solo hay que cambiar el bloque de database en fyag_api/settings.py (línea 85)
## luego hacer las migraciones con python manage.py makemigrations | python manage.py migrate
 
 
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
 
class Cliente(models.Model):
    class EstadoCliente(models.TextChoices):
        ACTIVO = "Activo", "Activo"
        INACTIVO = "Inactivo", "Inactivo"
        MOROSO = "Moroso", "Moroso"
 
    id_cliente = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rut_empresa = models.CharField(max_length=12, unique=True)
    razon_social = models.CharField(max_length=150)
    giro_comercial = models.CharField(max_length=150, blank=True)
 
    direccion_matriz = models.CharField(max_length=255, blank=True)
    comuna = models.CharField(max_length=100, blank=True)
    ciudad = models.CharField(max_length=100, blank=True)
 
    contacto_nombre = models.CharField(max_length=150, blank=True)
    contacto_telefono = models.CharField(max_length=30, blank=True)
    contacto_email = models.EmailField(max_length=150, blank=True)
 
    estado_cliente = models.CharField(
        max_length=20,
        choices=EstadoCliente.choices,
        default=EstadoCliente.ACTIVO,
    )
    soft_deleted = models.BooleanField(default=False)
 
    class Meta:
        db_table = "cliente"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(estado_cliente__in=["Activo", "Inactivo", "Moroso"]),
                name="cliente_estado_valido",
            ),
        ]
 
    def __str__(self):
        return f"{self.razon_social} ({self.rut_empresa})"
 
class Obra(models.Model):
    id_obra = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo_obra = models.CharField(max_length=30, unique=True)
    
    cliente = models.ForeignKey(
        Cliente, on_delete=models.PROTECT,
        db_column="id_cliente", related_name="obras",
    )
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
 
 
# ---------------------------------------------------------------------------
# Técnicos asignados a obras ns si esto esté bien #sos
# ---------------------------------------------------------------------------
class AsignacionTecnico(models.Model):
    id_asignacion = models.AutoField(primary_key=True)
    obra = models.ForeignKey(
        Obra, on_delete=models.CASCADE,
        db_column="id_obra", related_name="asignaciones",
    )
    tecnico = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="id_tecnico", related_name="asignaciones_obra",
    )
    fecha = models.DateField()
    hora_inicio = models.TimeField()
    hora_termino = models.TimeField()
    fecha_asignacion = models.DateTimeField(default=timezone.now)
    activo = models.BooleanField(default=True)
 
    class Meta:
        db_table = "asignacion_tecnico"
        constraints = [
            # Un técnico no puede estar asignado dos veces (activo) a la misma obra
            models.UniqueConstraint(
                fields=["obra", "tecnico", "fecha", "hora_inicio", "hora_termino"],
                condition=models.Q(activo=True),
                name="asignacion_activa_unica",
            ),
            models.UniqueConstraint(
                fields=["tecnico", "fecha", "hora_inicio", "hora_termino"],
                condition=models.Q(activo=True),
                name="asignacion_tecnico_horario_unico",
            ),
            models.CheckConstraint(
                condition=models.Q(hora_termino__gt=models.F("hora_inicio")),
                name="asignacion_horario_coherente",
            ),
        ]
 
    def __str__(self):
        return f"{self.tecnico} -> {self.obra.codigo_obra}"


class SolicitudCambioObra(models.Model):
    class TipoSolicitud(models.TextChoices):
        SUSPENSION = "SUSPENSION", "Suspensión"
        CANCELACION = "CANCELACION", "Cancelación"

    class EstadoSolicitud(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADA = "APROBADA", "Aprobada"
        RECHAZADA = "RECHAZADA", "Rechazada"

    id_solicitud = models.AutoField(primary_key=True)
    obra = models.ForeignKey(
        Obra, on_delete=models.CASCADE,
        db_column="id_obra", related_name="solicitudes_cambio",
    )
    tecnico = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="id_tecnico", related_name="solicitudes_cambio_obra",
    )
    tipo = models.CharField(max_length=20, choices=TipoSolicitud.choices)
    motivo = models.TextField()
    estado = models.CharField(
        max_length=20,
        choices=EstadoSolicitud.choices,
        default=EstadoSolicitud.PENDIENTE,
    )
    respuesta_supervisor = models.TextField(blank=True)
    supervisor_respuesta = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="id_supervisor_respuesta", related_name="solicitudes_resueltas",
        null=True, blank=True,
    )
    solicitada_en = models.DateTimeField(auto_now_add=True)
    respondida_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "solicitud_cambio_obra"
        ordering = ["-solicitada_en"]

    def __str__(self):
        return f"{self.get_tipo_display()} · {self.obra.codigo_obra} · {self.estado}"
 
 
# ---------------------------------------------------------------------------
# Presupuesto (cotización formalizada de una obra)
# ---------------------------------------------------------------------------
class Presupuesto(models.Model):
    class EstadoPresupuesto(models.TextChoices):
        BORRADOR = "Borrador", "Borrador"
        PENDIENTE_APROBACION = "Pendiente_Aprobacion", "Pendiente de aprobación"
        APROBADO = "Aprobado", "Aprobado"
        RECHAZADO = "Rechazado", "Rechazado"
 
    id_presupuesto = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero_presupuesto = models.CharField(max_length=30, unique=True)
 
    obra = models.ForeignKey(
        Obra, on_delete=models.PROTECT,
        db_column="id_obra", related_name="presupuestos",
    )
    cliente = models.ForeignKey(
        Cliente, on_delete=models.PROTECT,
        db_column="id_cliente", related_name="presupuestos",
    )
    creador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="id_creador", related_name="presupuestos_creados",
    )
    aprobador_gerencia = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="id_aprobador_gerencia", related_name="presupuestos_aprobados",
        null=True, blank=True,  # queda vacío hasta que gerencia apruebe
    )
 
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_iva = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    monto_total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
 
    estado_presupuesto = models.CharField(
        max_length=30,
        choices=EstadoPresupuesto.choices,
        default=EstadoPresupuesto.BORRADOR,
    )
    soft_deleted = models.BooleanField(default=False)
 
    class Meta:
        db_table = "presupuesto"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(
                    estado_presupuesto__in=[
                        "Borrador", "Pendiente_Aprobacion", "Aprobado", "Rechazado",
                    ]
                ),
                name="presupuesto_estado_valido",
            ),
        ]
 
    def __str__(self):
        return f"{self.numero_presupuesto} ({self.estado_presupuesto})"
 
 
# ---------------------------------------------------------------------------
# Ítems del presupuesto (repuestos, insumos y mano de obra)
# ---------------------------------------------------------------------------
class ItemPresupuesto(models.Model):
    id_item = models.AutoField(primary_key=True)
    presupuesto = models.ForeignKey(
        Presupuesto, on_delete=models.CASCADE,
        db_column="id_presupuesto", related_name="items",
    )
    descripcion_item = models.CharField(max_length=250)
    unidad_medida = models.CharField(max_length=30)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
 
    # Columna generada por la base d datos: cantidad * precio_unitario 
    total_linea = models.GeneratedField(
        expression=models.F("cantidad") * models.F("precio_unitario"),
        output_field=models.DecimalField(max_digits=14, decimal_places=2),
        db_persist=True,
    )
 
    class Meta:
        db_table = "item_presupuesto"
 
    def __str__(self):
        return f"{self.descripcion_item} x {self.cantidad}"
 
 
# ---------------------------------------------------------------------------
# Factura (documento tributario de cobro)
# ---------------------------------------------------------------------------
class Factura(models.Model):
    class EstadoPago(models.TextChoices):
        PENDIENTE = "Pendiente", "Pendiente"
        PAGO_PARCIAL = "Pago Parcial", "Pago Parcial"
        PAGADO = "Pagado", "Pagado"
 
    id_factura = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    folio_factura = models.CharField(max_length=50, unique=True)
 
    presupuesto = models.ForeignKey(
        Presupuesto, on_delete=models.PROTECT,
        db_column="id_presupuesto", related_name="facturas",
    )
    cliente = models.ForeignKey(
        Cliente, on_delete=models.PROTECT,
        db_column="id_cliente", related_name="facturas",
    )
 
    fecha_emision = models.DateField()
    fecha_vencimiento = models.DateField()
 
    monto_total = models.DecimalField(max_digits=14, decimal_places=2)
    saldo_pendiente = models.DecimalField(max_digits=14, decimal_places=2)
 
    estado_pago = models.CharField(
        max_length=30,
        choices=EstadoPago.choices,
        default=EstadoPago.PENDIENTE,
    )
    soft_deleted = models.BooleanField(default=False)
 
    class Meta:
        db_table = "factura"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(estado_pago__in=["Pendiente", "Pago Parcial", "Pagado"]),
                name="factura_estado_pago_valido",
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_vencimiento__gte=models.F("fecha_emision")),
                name="factura_fechas_coherentes",
            ),
        ]
 
    def __str__(self):
        return f"Factura {self.folio_factura} ({self.estado_pago})"
 
 
# ---------------------------------------------------------------------------
# Registro de pagos (abonos del cliente a una factura)
# ---------------------------------------------------------------------------
class RegistroPago(models.Model):
    id_pago = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    factura = models.ForeignKey(
        Factura, on_delete=models.PROTECT,
        db_column="id_factura", related_name="pagos",
    )
    registrador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        db_column="id_registrador", related_name="pagos_registrados",
    )
 
    monto_abonado = models.DecimalField(max_digits=14, decimal_places=2)
    fecha_pago = models.DateTimeField(default=timezone.now)
    metodo_pago = models.CharField(max_length=50)
    nro_comprobante = models.CharField(max_length=50, blank=True)
    notas = models.TextField(blank=True)
 
    class Meta:
        db_table = "registro_pago"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(monto_abonado__gt=0),
                name="pago_monto_positivo",
            ),
        ]
 
    def __str__(self):
        return f"Pago {self.monto_abonado} -> {self.factura.folio_factura}"
