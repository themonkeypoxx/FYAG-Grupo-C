from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fichas_obras', '0010_remove_asignaciontecnico_asignacion_activa_unica_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='obra',
            name='especificaciones_lugar',
            field=models.TextField(blank=True),
        ),
    ]