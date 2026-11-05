from datetime import date
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
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


# --- Pruebas de Creación Básica y Clasificación  ---

class CreacionYClasificacionObrasTests(TestCase):
    def setUp(self):
        self.supervisor = User.objects.create_user(
            username="supervisor_Juan",
            first_name="Juan",
            last_name="Gonzales",
        )
        self.cliente = Cliente.objects.create(
            rut_empresa="76432190-K",
            razon_social="Agrícola San Carlos SpA",
            ciudad="Chillán"
        )
        self.estado_pendiente = EstadoObra.objects.get_or_create(
            codigo_estado="PENDIENTE", defaults={"descripcion": "Pendiente"}
        )[0]
        self.tipo_clima = TipoServicio.objects.get_or_create(
            codigo="CLIMATIZACION", defaults={"nombre_servicio": "Climatización"}
        )[0]
        self.tipo_mantencion = TipoServicio.objects.get_or_create(
            codigo="MANTENCION", defaults={"nombre_servicio": "Mantención"}
        )[0]

    def test_creacion_obra_correcta(self):
        """Verifica la creación exitosa de una obra con estado PENDIENTE por defecto."""
        obra = Obra.objects.create(
            codigo_obra="OBRA-TEST-001",
            nombre_obra="Instalación Cámara Frigorífica",
            ubicacion_faena="Chillán",
            fecha_inicio=date(2026, 3, 1),
            cliente=self.cliente,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_pendiente,
            supervisor=self.supervisor,
            costo_estimado=4500000.00
        )
        self.assertEqual(obra.codigo_obra, "OBRA-TEST-001")
        self.assertEqual(obra.estado_obra.codigo_estado, "PENDIENTE")
        self.assertEqual(obra.tipo_servicio.nombre_servicio, "Climatización")

    def test_clasificacion_obra_por_tipo_servicio(self):
        """Verifica la vinculación correcta al tipo de servicio de mantención."""
        obra = Obra.objects.create(
            codigo_obra="OBRA-TEST-002",
            nombre_obra="Mantención Preventiva Chiller",
            ubicacion_faena="Chillán Viejo",
            fecha_inicio=date(2026, 3, 5),
            cliente=self.cliente,
            tipo_servicio=self.tipo_mantencion,
            estado_obra=self.estado_pendiente,
            supervisor=self.supervisor
        )
        self.assertEqual(obra.tipo_servicio.codigo, "MANTENCION")


# --- Pruebas de endpoints JWT (Login / Refresh) ---

class JWTAuthEndpointsTests(TestCase):
    """
    Pruebas sintéticas para los endpoints agregados en la rama
    'Configurar-los-endpoints-de-Login-Refresh':
      - POST /api/auth/login/   → TokenObtainPairView
      - POST /api/auth/refresh/ → TokenRefreshView
    """

    LOGIN_URL   = "/api/auth/login/"
    REFRESH_URL = "/api/auth/refresh/"

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="test_jwt_user",
            password="Contrasena_Segura_123",
        )

    # ── Login ────────────────────────────────────────────────────────────────

    def test_login_credenciales_correctas_devuelve_tokens(self):
        """Login con credenciales válidas retorna access y refresh tokens."""
        res = self.client.post(
            self.LOGIN_URL,
            {"username": "test_jwt_user", "password": "Contrasena_Segura_123"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        # Los tokens no deben estar vacíos
        self.assertTrue(len(res.data["access"]) > 20)
        self.assertTrue(len(res.data["refresh"]) > 20)

    def test_login_password_incorrecta_retorna_401(self):
        """Login con password errónea debe retornar 401."""
        res = self.client.post(
            self.LOGIN_URL,
            {"username": "test_jwt_user", "password": "password_incorrecta"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", res.data)

    def test_login_usuario_inexistente_retorna_401(self):
        """Login con usuario que no existe debe retornar 401."""
        res = self.client.post(
            self.LOGIN_URL,
            {"username": "nadie", "password": "cualquier"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_sin_campos_retorna_400(self):
        """Login sin enviar username ni password debe retornar 400."""
        res = self.client.post(self.LOGIN_URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_solo_acepta_post(self):
        """El endpoint de login no debe aceptar GET."""
        res = self.client.get(self.LOGIN_URL)
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    # ── Refresh ───────────────────────────────────────────────────────────────

    def test_refresh_con_token_valido_devuelve_nuevo_access(self):
        """Refresh con un refresh token válido devuelve un nuevo access token."""
        # Primero hacemos login para obtener el refresh token
        login_res = self.client.post(
            self.LOGIN_URL,
            {"username": "test_jwt_user", "password": "Contrasena_Segura_123"},
            format="json",
        )
        refresh_token = login_res.data["refresh"]

        # Ahora usamos ese refresh token
        res = self.client.post(
            self.REFRESH_URL,
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("access", res.data)
        self.assertTrue(len(res.data["access"]) > 20)

    def test_refresh_con_token_invalido_retorna_401(self):
        """Refresh con un token inventado debe retornar 401."""
        res = self.client.post(
            self.REFRESH_URL,
            {"refresh": "esto.no.es.un.token.valido"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_sin_token_retorna_400(self):
        """Refresh sin enviar el campo refresh debe retornar 400."""
        res = self.client.post(self.REFRESH_URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_refresh_solo_acepta_post(self):
        """El endpoint de refresh no debe aceptar GET."""
        res = self.client.get(self.REFRESH_URL)
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)