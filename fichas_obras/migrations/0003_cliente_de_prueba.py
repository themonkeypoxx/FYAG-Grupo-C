import uuid

from django.db import migrations

RUT_PRUEBA = "76123456-0"


def crear_cliente_prueba(apps, schema_editor):
    Cliente = apps.get_model("fichas_obras", "Cliente")
    Cliente.objects.get_or_create(
        rut_empresa=RUT_PRUEBA,
        defaults={
            "id_cliente": uuid.UUID("5b0f3c1e-8a47-4d2b-9f6e-2c1a7d9e4b10"),
            "razon_social": "Agrícola Los Aromos SpA",
            "giro_comercial": "Producción y exportación de uva de mesa",
            "direccion_matriz": "Camino a Pemuco km 5",
            "comuna": "Chillán",
            "ciudad": "Chillán",
            "contacto_nombre": "Juan Pérez",
            "contacto_telefono": "+56912345678",
            "contacto_email": "contacto@losaromos.cl",
            "estado_cliente": "Activo",
            "soft_deleted": False,
        },
    )


def eliminar_cliente_prueba(apps, schema_editor):
    Cliente = apps.get_model("fichas_obras", "Cliente")
    Cliente.objects.filter(rut_empresa=RUT_PRUEBA).delete()
class Migration(migrations.Migration):

    dependencies = [
        ('fichas_obras', '0002_cargar_catalogo'),
    ]

    operations = [
    ]
