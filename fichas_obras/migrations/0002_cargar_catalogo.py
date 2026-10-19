from django.db import migrations

def cargar_catalogos(apps, schema_editor):
    EstadoObra = apps.get_model("fichas_obras", "EstadoObra")
    TipoServicio = apps.get_model("fichas_obras", "TipoServicio")

    for codigo, desc in [
        ("PENDIENTE", "Pendiente"),
        ("EJECUCION", "En Ejecución"),
        ("SUSPENDIDA", "Suspendida"),
        ("FINALIZADA", "Finalizada"),
        ("CANCELADA", "Cancelada"),
    ]:
        EstadoObra.objects.get_or_create(
            codigo_estado=codigo,
            defaults={"descripcion": desc},
        )

    for codigo, nombre in [
        ("MANTENCION", "Mantención"),
        ("CLIMATIZACION", "Climatización"),
        ("PROY_ELECTRICO", "Proyecto eléctrico"),
        ("EMERGENCIA", "Emergencia"),
        ("GARANTIA", "Garantía"),
        ("PROYECTO", "Proyecto"),
    ]:
        TipoServicio.objects.get_or_create(
            codigo=codigo,
            defaults={"nombre_servicio": nombre},
        )


class Migration(migrations.Migration):
    dependencies = [("fichas_obras", "0001_initial")] 
    operations = [migrations.RunPython(cargar_catalogos, migrations.RunPython.noop)]