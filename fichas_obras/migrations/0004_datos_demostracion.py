from datetime import date
from django.db import migrations

def crear_datos_demo(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Cliente = apps.get_model("fichas_obras", "Cliente")
    TipoServicio = apps.get_model("fichas_obras", "TipoServicio")
    EstadoObra = apps.get_model("fichas_obras", "EstadoObra")
    Obra = apps.get_model("fichas_obras", "Obra")

    # Supervisor por defecto
    supervisor, _ = User.objects.get_or_create(
        username="supervisor_fyag",
        defaults={
            "first_name": "Carlos",
            "last_name": "Valenzuela",
            "email": "carlos.valenzuela@fyag.cl",
            "is_staff": True,
        }
    )

    # Clientes
    c1, _ = Cliente.objects.get_or_create(
        rut_empresa="76123456-0",
        defaults={
            "razon_social": "Agrícola Los Aromos SpA",
            "giro_comercial": "Producción Frutícola y Exportación",
            "direccion_matriz": "Camino a Pemuco km 5",
            "comuna": "Chillán",
            "ciudad": "Chillán",
            "contacto_nombre": "Juan Pérez",
            "contacto_telefono": "+56912345678",
            "contacto_email": "contacto@losaromos.cl",
            "estado_cliente": "Activo",
        }
    )

    c2, _ = Cliente.objects.get_or_create(
        rut_empresa="77987654-3",
        defaults={
            "razon_social": "Frigoríficos del Biobío S.A.",
            "giro_comercial": "Almacenamiento y Congelado Industrial",
            "direccion_matriz": "Parque Industrial Coronel Lote 12",
            "comuna": "Coronel",
            "ciudad": "Concepción",
            "contacto_nombre": "Mariana Soto",
            "contacto_telefono": "+56987654321",
            "contacto_email": "operaciones@frigobiobio.cl",
            "estado_cliente": "Activo",
        }
    )

    c3, _ = Cliente.objects.get_or_create(
        rut_empresa="78111222-K",
        defaults={
            "razon_social": "Centros Logísticos del Sur Ltda.",
            "giro_comercial": "Infraestructura Logística",
            "direccion_matriz": "Ruta 5 Sur km 402",
            "comuna": "Chillán Viejo",
            "ciudad": "Chillán",
            "contacto_nombre": "Roberto Gómez",
            "contacto_telefono": "+56955544433",
            "contacto_email": "rgomez@centrosur.cl",
            "estado_cliente": "Activo",
        }
    )

    # Tipos
    t_mant = TipoServicio.objects.filter(codigo="MANTENCION").first()
    t_clima = TipoServicio.objects.filter(codigo="CLIMATIZACION").first()
    t_elec = TipoServicio.objects.filter(codigo="PROY_ELECTRICO").first()
    t_emerg = TipoServicio.objects.filter(codigo="EMERGENCIA").first()
    t_garan = TipoServicio.objects.filter(codigo="GARANTIA").first()
    t_proy = TipoServicio.objects.filter(codigo="PROYECTO").first()

    # Estados
    e_pend = EstadoObra.objects.filter(codigo_estado="PENDIENTE").first()
    e_ejec = EstadoObra.objects.filter(codigo_estado="EJECUCION").first()
    e_susp = EstadoObra.objects.filter(codigo_estado="SUSPENDIDA").first()
    e_fina = EstadoObra.objects.filter(codigo_estado="FINALIZADA").first()

    obras_demo = [
        {
            "codigo_obra": "FYAG-2026-001",
            "nombre_obra": "Instalación HVAC Central en Cámaras 3 y 4",
            "ubicacion_faena": "Planta Pemuco km 5",
            "cliente": c1,
            "tipo_servicio": t_clima,
            "estado_obra": e_pend,
            "supervisor": supervisor,
            "fecha_inicio": date(2026, 4, 1),
            "fecha_termino_estimada": date(2026, 5, 15),
            "costo_estimado": 18500000.00,
            "costo_real": 0.00,
        },
        {
            "codigo_obra": "FYAG-2026-002",
            "nombre_obra": "Mantenimiento Preventivo Mensual Sistema de Frío",
            "ubicacion_faena": "Parque Industrial Coronel Lote 12",
            "cliente": c2,
            "tipo_servicio": t_mant,
            "estado_obra": e_ejec,
            "supervisor": supervisor,
            "fecha_inicio": date(2026, 3, 10),
            "fecha_termino_estimada": date(2026, 3, 20),
            "costo_estimado": 4200000.00,
            "costo_real": 3950000.00,
        },
        {
            "codigo_obra": "FYAG-2026-003",
            "nombre_obra": "Montaje de Tablero Eléctrico y Fuerza para Compresores",
            "ubicacion_faena": "Ruta 5 Sur km 402",
            "cliente": c3,
            "tipo_servicio": t_elec,
            "estado_obra": e_susp,
            "supervisor": supervisor,
            "fecha_inicio": date(2026, 2, 1),
            "fecha_termino_estimada": date(2026, 3, 1),
            "costo_estimado": 9800000.00,
            "costo_real": 5400000.00,
            "motivo_suspension_cancelacion": "En espera de entrega de transformador de media tensión por parte del proveedor",
        },
        {
            "codigo_obra": "FYAG-2026-004",
            "nombre_obra": "Reparación Urgente por Fuga de Refrigerante R404A",
            "ubicacion_faena": "Planta Pemuco km 5",
            "cliente": c1,
            "tipo_servicio": t_emerg,
            "estado_obra": e_ejec,
            "supervisor": supervisor,
            "fecha_inicio": date(2026, 3, 12),
            "fecha_termino_estimada": date(2026, 3, 15),
            "costo_estimado": 1500000.00,
            "costo_real": 1620000.00,
        },
        {
            "codigo_obra": "FYAG-2026-005",
            "nombre_obra": "Revisión en Garantía de Válvulas Expansoras",
            "ubicacion_faena": "Parque Industrial Coronel Lote 12",
            "cliente": c2,
            "tipo_servicio": t_garan,
            "estado_obra": e_fina,
            "supervisor": supervisor,
            "fecha_inicio": date(2026, 1, 15),
            "fecha_termino_estimada": date(2026, 1, 20),
            "fecha_cierre_real": date(2026, 1, 19),
            "costo_estimado": 0.00,
            "costo_real": 0.00,
        },
        {
            "codigo_obra": "FYAG-2026-006",
            "nombre_obra": "Proyecto de Automatización y Control SCADA Frigorífico",
            "ubicacion_faena": "Ruta 5 Sur km 402",
            "cliente": c3,
            "tipo_servicio": t_proy,
            "estado_obra": e_pend,
            "supervisor": supervisor,
            "fecha_inicio": date(2026, 5, 1),
            "fecha_termino_estimada": date(2026, 7, 30),
            "costo_estimado": 35000000.00,
            "costo_real": 0.00,
        },
    ]

    for data in obras_demo:
        if data["tipo_servicio"] and data["estado_obra"]:
            Obra.objects.get_or_create(
                codigo_obra=data["codigo_obra"],
                defaults=data
            )


def revertir_datos_demo(apps, schema_editor):
    Obra = apps.get_model("fichas_obras", "Obra")
    Obra.objects.filter(codigo_obra__startswith="FYAG-2026-").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("fichas_obras", "0003_cliente_de_prueba"),
    ]

    operations = [
        migrations.RunPython(crear_datos_demo, revertir_datos_demo),
    ]

