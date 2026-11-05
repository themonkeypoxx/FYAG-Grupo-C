from django.db import migrations

def cargar_grupos_django(apps, schema_editor):
    
    Group = apps.get_model('auth', 'Group')
    
    roles = ["GERENCIA", "ADMINISTRATIVO", "SUPERVISOR", "TECNICO"]
    
    for nombre_rol in roles:
        Group.objects.get_or_create(name=nombre_rol)

def revertir_grupos(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name__in=["GERENCIA", "ADMINISTRATIVO", "SUPERVISOR", "TECNICO"]).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('fichas_obras', '0003_cliente_de_prueba'),
    ]

    operations = [
        migrations.RunPython(cargar_grupos_django, revertir_grupos),
    ]