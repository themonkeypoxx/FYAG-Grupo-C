from django.db import migrations
from django.contrib.auth.hashers import make_password


def crear_usuarios_prueba(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Group = apps.get_model('auth', 'Group')

    # Diccionario con los 4 usuarios de prueba especificados en el README (uno por cada rol)
    usuarios = [
        {
            "username": "gerente_test",
            "email": "gerente_test@fyag.cl",
            "first_name": "Gerente",
            "last_name": "Test",
            "roles": ["GERENCIA", "Gerencial"],
            "is_staff": True,
        },
        {
            "username": "supervisor_test",
            "email": "supervisor_test@fyag.cl",
            "first_name": "Supervisor",
            "last_name": "Test",
            "roles": ["SUPERVISOR", "Supervisor"],
            "is_staff": False,
        },
        {
            "username": "admin_test",
            "email": "admin_test@fyag.cl",
            "first_name": "Administrador",
            "last_name": "Test",
            "roles": ["ADMINISTRATIVO", "Administrativo"],
            "is_staff": True,
        },
        {
            "username": "tecnico_test",
            "email": "tecnico_test@fyag.cl",
            "first_name": "Tecnico",
            "last_name": "Test",
            "roles": ["TECNICO", "Tecnico"],
            "is_staff": False,
        },
    ]

    password_hash = make_password("Prueba1234*")

    for u_data in usuarios:
        user, created = User.objects.get_or_create(
            username=u_data["username"],
            defaults={
                "email": u_data["email"],
                "first_name": u_data["first_name"],
                "last_name": u_data["last_name"],
                "password": password_hash,
                "is_active": True,
                "is_staff": u_data["is_staff"],
            }
        )
        if not created:
            user.email = u_data["email"]
            user.first_name = u_data["first_name"]
            user.last_name = u_data["last_name"]
            user.password = password_hash
            user.is_active = True
            user.is_staff = u_data["is_staff"]
            user.save()

        for rol in u_data["roles"]:
            grupo, _ = Group.objects.get_or_create(name=rol)
            user.groups.add(grupo)


def revertir_usuarios_prueba(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    usernames = ["gerente_test", "supervisor_test", "admin_test", "tecnico_test"]
    User.objects.filter(username__in=usernames).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('fichas_obras', '0006_presupuesto_itempresupuesto_factura_registropago_and_more'),
    ]

    operations = [
        migrations.RunPython(crear_usuarios_prueba, revertir_usuarios_prueba),
    ]

