from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('fichas_obras', '0003_cliente_de_prueba'),
    ]

    operations = [
        migrations.CreateModel(
            name='Rol',
            fields=[
                ('id_rol', models.AutoField(primary_key=True, serialize=False)),
                ('nombre_rol', models.CharField(choices=[('GERENCIA', 'Gerencia / Administrador'), ('ADMINISTRATIVO', 'Administrativo / Finanzas'), ('SUPERVISOR', 'Supervisor/a de Obras'), ('TECNICO', 'Técnico en Terreno')], max_length=50, unique=True)),
                ('descripcion', models.CharField(blank=True, max_length=200, null=True)),
                ('nivel_jerarquia', models.IntegerField(help_text='1: Gerencia, 2: Finanzas, 3: Supervisor, 4: Técnico')),
            ],
        ),
    ]