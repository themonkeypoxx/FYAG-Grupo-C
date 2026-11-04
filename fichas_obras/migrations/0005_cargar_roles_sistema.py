from django.db import migrations

def cargar_roles_sistema(apps, schema_editor):
    Rol = apps.get_model('fichas_obras', 'Rol')
    
    roles = [
        {
            "nombre_rol": "GERENCIA", 
            "descripcion": "Gerencia / Administrador General (Nivel 1): Acceso total, métricas, auditoría y roles.", 
            "nivel_jerarquia": 1
        },
        {
            "nombre_rol": "ADMINISTRATIVO", 
            "descripcion": "Administrativo / Finanzas (Nivel 2): Presupuestos, facturación, cobranza y clientes.", 
            "nivel_jerarquia": 2
        },
        {
            "nombre_rol": "SUPERVISOR", 
            "descripcion": "Supervisor/a de Obras (Nivel 3): Creación, clasificación de obras, asignación y cambio de estados.", 
            "nivel_jerarquia": 3
        },
        {
            "nombre_rol": "TECNICO", 
            "descripcion": "Técnico en Terreno (Nivel 4): Consulta de obras asignadas sin acceso a datos financieros.", 
            "nivel_jerarquia": 4
        },
    ]
    
    for datos in roles:
        Rol.objects.get_or_create(nombre_rol=datos["nombre_rol"], defaults=datos)

def revertir_roles(apps, schema_editor):
    Rol = apps.get_model('fichas_obras', 'Rol')
    Rol.objects.filter(nombre_rol__in=["GERENCIA", "ADMINISTRATIVO", "SUPERVISOR", "TECNICO"]).delete()

class Migration(migrations.Migration):

    dependencies = [
        ('fichas_obras', '0004_rol'),
    ]

    operations = [
        migrations.RunPython(cargar_roles_sistema, revertir_roles),
    ]