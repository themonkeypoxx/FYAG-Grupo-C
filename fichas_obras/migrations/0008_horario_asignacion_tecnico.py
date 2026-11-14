import datetime

from django.db import migrations, models
from django.db.models import F, Q


def completar_horarios_existentes(apps, schema_editor):
    Asignacion = apps.get_model("fichas_obras", "AsignacionTecnico")
    hoy = datetime.date.today()
    # Las asignaciones antiguas no tenían horario. Repartirlas en días consecutivos
    # evita inventar conflitos entre registros históricos do mesmo técnico.
    for indice, asignacion in enumerate(Asignacion.objects.filter(fecha__isnull=True).order_by("pk")):
        asignacion.fecha = hoy + datetime.timedelta(days=indice)
        asignacion.hora_inicio = datetime.time(9, 0)
        asignacion.hora_termino = datetime.time(18, 0)
        asignacion.save(update_fields=["fecha", "hora_inicio", "hora_termino"])


class Migration(migrations.Migration):
    dependencies = [("fichas_obras", "0007_crear_usuarios_prueba")]

    operations = [
        migrations.AddField(model_name="asignaciontecnico", name="fecha", field=models.DateField(null=True)),
        migrations.AddField(model_name="asignaciontecnico", name="hora_inicio", field=models.TimeField(null=True)),
        migrations.AddField(model_name="asignaciontecnico", name="hora_termino", field=models.TimeField(null=True)),
        migrations.RunPython(completar_horarios_existentes, migrations.RunPython.noop),
        migrations.AlterField(model_name="asignaciontecnico", name="fecha", field=models.DateField()),
        migrations.AlterField(model_name="asignaciontecnico", name="hora_inicio", field=models.TimeField()),
        migrations.AlterField(model_name="asignaciontecnico", name="hora_termino", field=models.TimeField()),
        migrations.AddConstraint(
            model_name="asignaciontecnico",
            constraint=models.UniqueConstraint(
                fields=("tecnico", "fecha", "hora_inicio", "hora_termino"),
                condition=Q(activo=True),
                name="asignacion_tecnico_horario_unico",
            ),
        ),
        migrations.AddConstraint(
            model_name="asignaciontecnico",
            constraint=models.CheckConstraint(condition=Q(hora_termino__gt=F("hora_inicio")), name="asignacion_horario_coherente"),
        ),
    ]
