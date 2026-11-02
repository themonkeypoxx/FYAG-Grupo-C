from datetime import date
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import Cliente, EstadoObra, Obra, TipoServicio
from .services import aplicar_transicion_estado, validar_transicion_estado


class TransicionEstadosYClasificacionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Usuario supervisor
        self.supervisor = User.objects.create_user(
            username="supervisor1",
            first_name="Carlos",
            last_name="Tapia"
        )

        # Cliente de prueba
        self.cliente, _ = Cliente.objects.get_or_create(
            rut_empresa="79999999-9",
            defaults={
                "razon_social": "Agrícola del Valle SpA",
                "ciudad": "Chillán",
            }
        )

        # Estados
        self.estado_pendiente, _ = EstadoObra.objects.get_or_create(
            codigo_estado="PENDIENTE", defaults={"descripcion": "Pendiente"}
        )
        self.estado_ejecucion, _ = EstadoObra.objects.get_or_create(
            codigo_estado="EJECUCION", defaults={"descripcion": "En Ejecución"}
        )
        self.estado_suspendida, _ = EstadoObra.objects.get_or_create(
            codigo_estado="SUSPENDIDA", defaults={"descripcion": "Suspendida"}
        )
        self.estado_finalizada, _ = EstadoObra.objects.get_or_create(
            codigo_estado="FINALIZADA", defaults={"descripcion": "Finalizada"}
        )
        self.estado_cancelada, _ = EstadoObra.objects.get_or_create(
            codigo_estado="CANCELADA", defaults={"descripcion": "Cancelada"}
        )

        # Tipos de servicio
        self.tipo_clima, _ = TipoServicio.objects.get_or_create(
            codigo="CLIMATIZACION", defaults={"nombre_servicio": "Climatización"}
        )
        self.tipo_mantencion, _ = TipoServicio.objects.get_or_create(
            codigo="MANTENCION", defaults={"nombre_servicio": "Mantención"}
        )
        self.tipo_electrico, _ = TipoServicio.objects.get_or_create(
            codigo="PROY_ELECTRICO", defaults={"nombre_servicio": "Proyecto eléctrico"}
        )

        # Crear obra base en estado PENDIENTE y tipo CLIMATIZACION
        self.obra = Obra.objects.create(
            codigo_obra="OBRA-2026-001",
            nombre_obra="Instalación HVAC Central Frío",
            ubicacion_faena="Planta Chillán Km 8",
            fecha_inicio=date(2026, 3, 1),
            cliente=self.cliente,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_pendiente,
            supervisor=self.supervisor,
            costo_estimado=15000000.00,
        )

    # --- Pruebas de Máquina de Estados Operativos ---

    def test_transicion_valida_pendiente_a_ejecucion(self):
        """PENDIENTE -> EJECUCION es válida"""
        obra_actualizada = aplicar_transicion_estado(self.obra, "EJECUCION")
        self.assertEqual(obra_actualizada.estado_obra.codigo_estado, "EJECUCION")

    def test_transicion_invalida_pendiente_a_finalizada(self):
        """PENDIENTE -> FINALIZADA no está permitida directamente"""
        with self.assertRaises(Exception):
            aplicar_transicion_estado(self.obra, "FINALIZADA")

    def test_suspension_requiere_motivo(self):
        """Pasar a SUSPENDIDA sin motivo debe fallar"""
        # Primero pasamos a EJECUCION
        aplicar_transicion_estado(self.obra, "EJECUCION")

        # Intentar suspender sin motivo debe fallar
        with self.assertRaises(Exception):
            aplicar_transicion_estado(self.obra, "SUSPENDIDA", motivo="")

        # Con motivo debe funcionar
        obra_susp = aplicar_transicion_estado(
            self.obra, "SUSPENDIDA", motivo="Espera de repuestos de importación"
        )
        self.assertEqual(obra_susp.estado_obra.codigo_estado, "SUSPENDIDA")
        self.assertEqual(obra_susp.motivo_suspension_cancelacion, "Espera de repuestos de importación")

    def test_finalizar_asigna_fecha_cierre_real(self):
        """Pasar a FINALIZADA asigna automáticamente la fecha de cierre real"""
        aplicar_transicion_estado(self.obra, "EJECUCION")
        obra_fin = aplicar_transicion_estado(self.obra, "FINALIZADA")
        self.assertEqual(obra_fin.estado_obra.codigo_estado, "FINALIZADA")
        self.assertIsNotNone(obra_fin.fecha_cierre_real)

    def test_estado_terminal_no_permite_mas_transiciones(self):
        """Una obra FINALIZADA no puede cambiar a ningún otro estado"""
        aplicar_transicion_estado(self.obra, "EJECUCION")
        aplicar_transicion_estado(self.obra, "FINALIZADA")
        with self.assertRaises(Exception):
            aplicar_transicion_estado(self.obra, "EJECUCION")

    # --- Pruebas de API REST / Endpoints ---

    def test_endpoint_cambiar_estado_api(self):
        """Endpoint POST /obras/fyag/v1/obras/{id}/cambiar-estado/ funciona vía API"""
        url = f"/obras/fyag/v1/obras/{self.obra.id_obra}/cambiar-estado/"
        response = self.client.post(url, {"nuevo_estado": "EJECUCION"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["obra"]["estado_obra_codigo"], "EJECUCION")

    def test_endpoint_cambiar_estado_rechaza_transicion_invalida(self):
        """Endpoint rechaza transición inválida con HTTP 400"""
        url = f"/obras/fyag/v1/obras/{self.obra.id_obra}/cambiar-estado/"
        response = self.client.post(url, {"nuevo_estado": "FINALIZADA"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    def test_endpoint_clasificacion_por_tipo_servicio(self):
        """Filtrado de obras por tipo de servicio funciona"""
        # Crear otra obra de tipo Mantención
        Obra.objects.create(
            codigo_obra="OBRA-2026-002",
            nombre_obra="Mantención preventiva Chiller",
            ubicacion_faena="Chillán",
            fecha_inicio=date(2026, 3, 5),
            cliente=self.cliente,
            tipo_servicio=self.tipo_mantencion,
            estado_obra=self.estado_pendiente,
            supervisor=self.supervisor,
        )

        # Consultar solo CLIMATIZACION
        res_clima = self.client.get("/obras/fyag/v1/obras/?tipo_servicio_codigo=CLIMATIZACION")
        self.assertEqual(res_clima.status_code, status.HTTP_200_OK)
        self.assertTrue(any(o["codigo_obra"] == "OBRA-2026-001" for o in res_clima.data))
        self.assertTrue(all(o["tipo_servicio_codigo"] == "CLIMATIZACION" for o in res_clima.data))

        # Consultar solo MANTENCION
        res_mant = self.client.get("/obras/fyag/v1/obras/?tipo_servicio_codigo=MANTENCION")
        self.assertEqual(res_mant.status_code, status.HTTP_200_OK)
        self.assertTrue(any(o["codigo_obra"] == "OBRA-2026-002" for o in res_mant.data))
        self.assertTrue(all(o["tipo_servicio_codigo"] == "MANTENCION" for o in res_mant.data))

    def test_endpoint_resumen_tipos(self):
        """Endpoint /resumen-tipos/ retorna conteos agrupados"""
        res = self.client.get("/obras/fyag/v1/obras/resumen-tipos/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("total_obras", res.data)
        self.assertIn("clasificacion", res.data)
