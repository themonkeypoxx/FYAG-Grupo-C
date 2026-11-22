from datetime import date, time
from decimal import Decimal
from django.contrib.auth.models import Group, User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import (
    AsignacionTecnico, Cliente, EstadoObra, Obra, TipoServicio,
    Presupuesto, Factura, RegistroPago, NotificacionPresupuesto
)
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
        grupo_sup, _ = Group.objects.get_or_create(name="SUPERVISOR")
        self.supervisor.groups.add(grupo_sup)
        self.client.force_authenticate(user=self.supervisor)

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


# ── Pruebas de Respuestas de Acceso Denegado (403 Forbidden) ──────────────────

class AccesoDenegadoPermisosTests(TestCase):
    """
    Pruebas para el criterio de aceptación de 'Implementar respuestas de acceso denegado':
    - Un usuario autenticado pero sin el rol requerido recibe HTTP 403 Forbidden.
    - Un usuario con rol permitido (Gerencial / Supervisor) accede correctamente (HTTP 200).
    - Un usuario anónimo/no autenticado recibe HTTP 401 Unauthorized.
    """

    ENDPOINT_OBRAS = "/obras/fyag/v1/obras/"
    ENDPOINT_CLIENTES = "/obras/fyag/v1/clientes/"

    def setUp(self):
        self.client = APIClient()

        # Grupos de la base de datos
        self.grupo_gerencia, _ = Group.objects.get_or_create(name="GERENCIA")
        self.grupo_tecnico, _ = Group.objects.get_or_create(name="TECNICO")

        # Usuario Técnico (no autorizado para CRUD de obras ni clientes)
        self.user_tecnico = User.objects.filter(username="tecnico_test").first()
        if not self.user_tecnico:
            self.user_tecnico = User.objects.create_user(
                username="tecnico_test",
                password="Password_123"
            )
        self.user_tecnico.groups.add(self.grupo_tecnico)

        # Usuario Gerente (autorizado)
        self.user_gerente = User.objects.filter(username="gerente_test").first()
        if not self.user_gerente:
            self.user_gerente = User.objects.create_user(
                username="gerente_test",
                password="Password_123"
            )
        self.user_gerente.groups.add(self.grupo_gerencia)

    def test_usuario_sin_rol_gerencial_recibe_403_forbidden(self):
        """
        Un usuario con rol 'TECNICO' intentando acceder al listado de obras
        recibe respuesta de error HTTP 403 Forbidden.
        """
        self.client.force_authenticate(user=self.user_tecnico)
        response = self.client.get(self.ENDPOINT_OBRAS)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_sin_rol_gerencial_recibe_403_forbidden_en_clientes(self):
        """
        Un usuario con rol 'TECNICO' intentando acceder a clientes
        recibe respuesta de error HTTP 403 Forbidden.
        """
        self.client.force_authenticate(user=self.user_tecnico)
        response = self.client.get(self.ENDPOINT_CLIENTES)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_usuario_con_rol_gerencial_accede_con_exito_200(self):
        """
        Un usuario con rol 'GERENCIA' accede con éxito HTTP 200 al endpoint protegido.
        """
        self.client.force_authenticate(user=self.user_gerente)
        response = self.client.get(self.ENDPOINT_OBRAS)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_usuario_no_autenticado_recibe_401(self):
        """
        Un usuario sin credenciales recibe HTTP 401 Unauthorized.
        """
        response = self.client.get(self.ENDPOINT_OBRAS)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class AsignacionesPorIntervaloYSolicitudesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.supervisor = User.objects.create_user(username="supervisor_intervalo")
        self.supervisor.groups.add(Group.objects.get_or_create(name="SUPERVISOR")[0])
        self.tecnico = User.objects.create_user(username="tecnico_intervalo")
        self.tecnico.groups.add(Group.objects.get_or_create(name="TECNICO")[0])
        self.cliente = Cliente.objects.get_or_create(
            rut_empresa="76123456-7",
            razon_social="Cliente Intervalo SpA",
        )[0]
        self.tipo = TipoServicio.objects.get_or_create(
            codigo="INTERVALO", nombre_servicio="Servicio de intervalo"
        )[0]
        self.estado_pendiente = EstadoObra.objects.get_or_create(
            codigo_estado="PENDIENTE", descripcion="Pendiente"
        )[0]
        self.estado_cancelada = EstadoObra.objects.get_or_create(
            codigo_estado="CANCELADA", descripcion="Cancelada"
        )[0]
        self.obra = Obra.objects.create(
            codigo_obra="OBRA-INTERVALO-001",
            nombre_obra="Obra de prueba de intervalo",
            ubicacion_faena="Santiago",
            fecha_inicio=date(2026, 12, 1),
            cliente=self.cliente,
            tipo_servicio=self.tipo,
            estado_obra=self.estado_pendiente,
            supervisor=self.supervisor,
        )

    def test_asignacion_por_intervalo_omite_fines_de_semana(self):
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.post(
            "/obras/fyag/v1/asignaciones-tecnico/",
            {
                "obra": str(self.obra.id_obra),
                "tecnico": self.tecnico.pk,
                "fecha_inicio": "2026-12-09",
                "fecha_termino": "2026-12-21",
                "hora_inicio": "08:00",
                "hora_termino": "14:00",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["asignaciones"].__len__(), 9)
        self.assertFalse(AsignacionTecnico.objects.filter(fecha__week_day__in=[1, 7]).exists())

    def test_tecnico_solicita_y_supervisor_aprueba_cancelacion(self):
        AsignacionTecnico.objects.create(
            obra=self.obra,
            tecnico=self.tecnico,
            fecha=date(2026, 12, 9),
            hora_inicio=time(8),
            hora_termino=time(14),
        )
        self.client.force_authenticate(user=self.tecnico)
        solicitud = self.client.post(
            "/obras/fyag/v1/solicitudes-cambio-obra/",
            {"obra": str(self.obra.id_obra), "tipo": "CANCELACION", "motivo": "Cliente canceló el servicio"},
            format="json",
        )
        self.assertEqual(solicitud.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.supervisor)
        resolver = self.client.post(
            f"/obras/fyag/v1/solicitudes-cambio-obra/{solicitud.data['id_solicitud']}/resolver/",
            {"accion": "APROBAR"},
            format="json",
        )
        self.assertEqual(resolver.status_code, status.HTTP_200_OK)
        self.obra.refresh_from_db()
        self.assertEqual(self.obra.estado_obra.codigo_estado, "CANCELADA")

    def test_supervisor_puede_editar_detalles_de_obra(self):
        self.client.force_authenticate(user=self.supervisor)
        response = self.client.patch(
            f"/obras/fyag/v1/obras/{self.obra.id_obra}/",
            {"nombre_obra": "Obra actualizada", "ubicacion_faena": "Rancagua"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.obra.refresh_from_db()
        self.assertEqual(self.obra.nombre_obra, "Obra actualizada")

# ── Pruebas de Registro de Presupuestos (Vinculados a Cliente y Proyecto Activo) ──

class RegistroPresupuestosTests(TestCase):
    ENDPOINT_PRESUPUESTOS = "/obras/fyag/v1/presupuestos/"
    ENDPOINT_OBRAS = "/obras/fyag/v1/obras/"

    def setUp(self):
        self.client = APIClient()

        # Grupos
        self.grupo_gerencia, _ = Group.objects.get_or_create(name="GERENCIA")
        self.grupo_supervisor, _ = Group.objects.get_or_create(name="SUPERVISOR")
        self.grupo_tecnico, _ = Group.objects.get_or_create(name="TECNICO")

        # Usuarios
        self.user_supervisor = User.objects.create_user(
            username="sup_presupuestos",
            password="Password_123"
        )
        self.user_supervisor.groups.add(self.grupo_supervisor)

        self.user_tecnico = User.objects.create_user(
            username="tec_presupuestos",
            password="Password_123"
        )
        self.user_tecnico.groups.add(self.grupo_tecnico)

        # Clientes
        self.cliente_activo = Cliente.objects.create(
            rut_empresa="76543210-K",
            razon_social="Agrícola Frutícola del Sur SpA",
            estado_cliente="Activo",
        )
        self.cliente_inactivo = Cliente.objects.create(
            rut_empresa="76111222-3",
            razon_social="Constructora Parada S.A.",
            estado_cliente="Inactivo",
        )
        self.cliente_otro = Cliente.objects.create(
            rut_empresa="77888999-4",
            razon_social="Comercial Chillán Ltda.",
            estado_cliente="Activo",
        )

        # Estados Obra
        self.estado_ejecucion, _ = EstadoObra.objects.get_or_create(
            codigo_estado="EJECUCION", defaults={"descripcion": "En Ejecución"}
        )
        self.estado_pendiente, _ = EstadoObra.objects.get_or_create(
            codigo_estado="PENDIENTE", defaults={"descripcion": "Pendiente"}
        )
        self.estado_finalizada, _ = EstadoObra.objects.get_or_create(
            codigo_estado="FINALIZADA", defaults={"descripcion": "Finalizada"}
        )
        self.estado_cancelada, _ = EstadoObra.objects.get_or_create(
            codigo_estado="CANCELADA", defaults={"descripcion": "Cancelada"}
        )

        # Tipo Servicio
        self.tipo_clima, _ = TipoServicio.objects.get_or_create(
            codigo="CLIMATIZACION", defaults={"nombre_servicio": "Climatización"}
        )

        # Obras
        self.obra_activa = Obra.objects.create(
            codigo_obra="OBRA-ACT-001",
            nombre_obra="Instalación Climatización Planta Chillán",
            ubicacion_faena="Chillán",
            fecha_inicio=date(2026, 3, 1),
            cliente=self.cliente_activo,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_ejecucion,
            supervisor=self.user_supervisor,
        )

        self.obra_finalizada = Obra.objects.create(
            codigo_obra="OBRA-FIN-002",
            nombre_obra="Mantención Completa Chiller",
            ubicacion_faena="Chillán",
            fecha_inicio=date(2026, 1, 1),
            cliente=self.cliente_activo,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_finalizada,
            supervisor=self.user_supervisor,
        )

        self.obra_cancelada = Obra.objects.create(
            codigo_obra="OBRA-CANC-003",
            nombre_obra="Proyecto Desistido",
            ubicacion_faena="Chillán",
            fecha_inicio=date(2026, 2, 1),
            cliente=self.cliente_activo,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_cancelada,
            supervisor=self.user_supervisor,
        )

        # Autenticación por defecto como supervisor
        self.client.force_authenticate(user=self.user_supervisor)

    def test_registro_presupuesto_exitoso_vinculado_cliente_y_proyecto_activo(self):
        """
        Registra exitosamente un presupuesto vinculado a un proyecto activo.
        El cliente y creador se asocian de forma coherente y se calculan montos.
        """
        payload = {
            "obra": str(self.obra_activa.id_obra),
            "subtotal": "100000.00",
            "estado_presupuesto": "Borrador",
        }
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["obra"], self.obra_activa.id_obra)
        self.assertEqual(res.data["cliente"], self.cliente_activo.id_cliente)
        self.assertEqual(Decimal(str(res.data["monto_iva"])), Decimal("19000.00"))
        self.assertEqual(Decimal(str(res.data["monto_total"])), Decimal("119000.00"))
        self.assertTrue(res.data["numero_presupuesto"].startswith(f"PRE-{self.obra_activa.codigo_obra}"))

        # Verificar persistencia en base de datos
        presupuesto = Presupuesto.objects.get(id_presupuesto=res.data["id_presupuesto"])
        self.assertEqual(presupuesto.obra, self.obra_activa)
        self.assertEqual(presupuesto.cliente, self.cliente_activo)
        self.assertEqual(presupuesto.creador, self.user_supervisor)

    def test_registro_presupuesto_con_cliente_explicito_coincidente(self):
        """
        Permite registrar enviando explícitamente el cliente si coincide con el del proyecto.
        """
        payload = {
            "obra": str(self.obra_activa.id_obra),
            "cliente": str(self.cliente_activo.id_cliente),
            "subtotal": "50000.00",
        }
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["cliente"], self.cliente_activo.id_cliente)

    def test_registro_presupuesto_falla_si_cliente_no_coincide_con_obra(self):
        """
        Rechaza el registro si se envía un cliente distinto al cliente vinculado a la obra.
        """
        payload = {
            "obra": str(self.obra_activa.id_obra),
            "cliente": str(self.cliente_otro.id_cliente),
            "subtotal": "50000.00",
        }
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cliente", res.data)

    def test_registro_presupuesto_falla_si_proyecto_esta_finalizado(self):
        """
        Rechaza el registro de presupuesto si el proyecto está en estado terminal FINALIZADA.
        """
        payload = {
            "obra": str(self.obra_finalizada.id_obra),
            "subtotal": "75000.00",
        }
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("obra", res.data)

    def test_registro_presupuesto_falla_si_proyecto_esta_cancelado(self):
        """
        Rechaza el registro de presupuesto si el proyecto está en estado terminal CANCELADA.
        """
        payload = {
            "obra": str(self.obra_cancelada.id_obra),
            "subtotal": "75000.00",
        }
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("obra", res.data)

    def test_registro_presupuesto_falla_si_proyecto_esta_soft_deleted(self):
        """
        Rechaza el registro de presupuesto si el proyecto tiene soft_deleted=True.
        """
        self.obra_activa.soft_deleted = True
        self.obra_activa.save()

        payload = {
            "obra": str(self.obra_activa.id_obra),
            "subtotal": "10000.00",
        }
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("obra", res.data)

    def test_registro_presupuesto_falla_si_cliente_esta_inactivo(self):
        """
        Rechaza el registro de presupuesto si el cliente vinculado no está activo.
        """
        obra_cliente_inactivo = Obra.objects.create(
            codigo_obra="OBRA-INACT-004",
            nombre_obra="Obra Cliente Inactivo",
            ubicacion_faena="Chillán",
            fecha_inicio=date(2026, 4, 1),
            cliente=self.cliente_inactivo,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_pendiente,
            supervisor=self.user_supervisor,
        )
        payload = {
            "obra": str(obra_cliente_inactivo.id_obra),
            "subtotal": "20000.00",
        }
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cliente", res.data)

    def test_filtro_solo_obras_activas_en_api(self):
        """
        Verifica que el parámetro ?solo_activas=true solo retorne obras operativas no finalizadas ni canceladas.
        """
        res = self.client.get(f"{self.ENDPOINT_OBRAS}?solo_activas=true")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        codigos = [item["codigo_obra"] for item in res.data]
        self.assertIn(self.obra_activa.codigo_obra, codigos)
        self.assertNotIn(self.obra_finalizada.codigo_obra, codigos)
        self.assertNotIn(self.obra_cancelada.codigo_obra, codigos)

    def test_permisos_usuario_no_autenticado_recibe_401(self):
        """
        Usuario sin token recibe 401 Unauthorized al intentar registrar presupuesto.
        """
        self.client.force_authenticate(user=None)
        payload = {"obra": str(self.obra_activa.id_obra), "subtotal": "10000.00"}
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_permisos_usuario_sin_rol_recibe_403(self):
        """
        Usuario con rol técnico (no administrativo ni gerencial ni supervisor) recibe 403 Forbidden.
        """
        self.client.force_authenticate(user=self.user_tecnico)
        payload = {"obra": str(self.obra_activa.id_obra), "subtotal": "10000.00"}
        res = self.client.post(self.ENDPOINT_PRESUPUESTOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


# ── Pruebas de Actualización del Estado de Pago de Facturas ──────────────────

class ActualizacionEstadoPagoFacturaTests(TestCase):
    ENDPOINT_FACTURAS = "/obras/fyag/v1/facturas/"
    ENDPOINT_PAGOS = "/obras/fyag/v1/pagos/"

    def setUp(self):
        self.client = APIClient()

        # Grupos y usuario admin/gerencial
        self.grupo_gerencia, _ = Group.objects.get_or_create(name="GERENCIA")
        self.user_admin = User.objects.create_user(
            username="admin_facturas",
            password="Password_123"
        )
        self.user_admin.groups.add(self.grupo_gerencia)
        self.client.force_authenticate(user=self.user_admin)

        # Cliente y Obra base
        self.cliente = Cliente.objects.create(
            rut_empresa="76123456-7",
            razon_social="Inversiones Maule S.A.",
            estado_cliente="Activo",
        )
        self.estado_ejecucion, _ = EstadoObra.objects.get_or_create(
            codigo_estado="EJECUCION", defaults={"descripcion": "En Ejecución"}
        )
        self.tipo_clima, _ = TipoServicio.objects.get_or_create(
            codigo="CLIMATIZACION", defaults={"nombre_servicio": "Climatización"}
        )
        self.obra = Obra.objects.create(
            codigo_obra="OBRA-FAC-001",
            nombre_obra="Climatización Maule",
            ubicacion_faena="Talca",
            fecha_inicio=date(2026, 1, 1),
            cliente=self.cliente,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_ejecucion,
            supervisor=self.user_admin,
        )
        self.presupuesto = Presupuesto.objects.create(
            numero_presupuesto="PRE-FAC-001",
            obra=self.obra,
            cliente=self.cliente,
            creador=self.user_admin,
            subtotal=Decimal("100000.00"),
            monto_iva=Decimal("19000.00"),
            monto_total=Decimal("119000.00"),
        )
        self.factura = Factura.objects.create(
            folio_factura="FAC-2026-0001",
            presupuesto=self.presupuesto,
            cliente=self.cliente,
            fecha_emision=date(2026, 2, 1),
            fecha_vencimiento=date(2026, 3, 1),
            monto_total=Decimal("100000.00"),
            saldo_pendiente=Decimal("100000.00"),
            estado_pago="Pendiente",
        )

    def test_abono_parcial_actualiza_a_pago_parcial(self):
        """Un abono menor al total cambia el estado a 'Pago Parcial' y descuenta el saldo."""
        payload = {
            "factura": str(self.factura.id_factura),
            "monto_abonado": "40000.00",
            "metodo_pago": "Transferencia",
        }
        res = self.client.post(self.ENDPOINT_PAGOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.factura.refresh_from_db()
        self.assertEqual(self.factura.estado_pago, "Pago Parcial")
        self.assertEqual(self.factura.saldo_pendiente, Decimal("60000.00"))

    def test_pago_total_actualiza_a_pagado(self):
        """Un abono que cubre el saldo pendiente cambia el estado a 'Pagado' y saldo a 0."""
        payload = {
            "factura": str(self.factura.id_factura),
            "monto_abonado": "100000.00",
            "metodo_pago": "Transferencia",
        }
        res = self.client.post(self.ENDPOINT_PAGOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        self.factura.refresh_from_db()
        self.assertEqual(self.factura.estado_pago, "Pagado")
        self.assertEqual(self.factura.saldo_pendiente, Decimal("0.00"))

    def test_abono_superior_al_saldo_es_rechazado(self):
        """Un abono que supera el saldo pendiente es rechazado con HTTP 400."""
        payload = {
            "factura": str(self.factura.id_factura),
            "monto_abonado": "150000.00",
            "metodo_pago": "Efectivo",
        }
        res = self.client.post(self.ENDPOINT_PAGOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("monto_abonado", res.data)

    def test_endpoint_actualizar_estado_pago_directo(self):
        """El endpoint POST /facturas/{id}/actualizar-estado-pago/ permite cambiar de estado directamente."""
        url = f"{self.ENDPOINT_FACTURAS}{self.factura.id_factura}/actualizar-estado-pago/"
        res = self.client.post(url, {"estado_pago": "Pagado"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.factura.refresh_from_db()
        self.assertEqual(self.factura.estado_pago, "Pagado")
        self.assertEqual(self.factura.saldo_pendiente, Decimal("0.00"))

    def test_endpoint_actualizar_estado_pago_con_monto_abono(self):
        """El endpoint /actualizar-estado-pago/ permite registrar abono y actualiza automáticamente."""
        url = f"{self.ENDPOINT_FACTURAS}{self.factura.id_factura}/actualizar-estado-pago/"
        res = self.client.post(url, {"monto_abono": "50000.00", "metodo_pago": "Cheque"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.factura.refresh_from_db()
        self.assertEqual(self.factura.estado_pago, "Pago Parcial")
        self.assertEqual(self.factura.saldo_pendiente, Decimal("50000.00"))



class ResumenFinancieroTests(TestCase):
    ENDPOINT = "/obras/fyag/v1/resumen-financiero/"
    ENDPOINT_FACTURAS = "/obras/fyag/v1/facturas/"
    ENDPOINT_PAGOS = "/obras/fyag/v1/pagos/"

    def setUp(self):
        self.client = APIClient()

        self.grupo_gerencia, _ = Group.objects.get_or_create(name="GERENCIA")
        self.user_admin = User.objects.create_user(
            username="admin_resumen",
            password="Password_123"
        )
        self.user_admin.groups.add(self.grupo_gerencia)
        self.client.force_authenticate(user=self.user_admin)

        self.cliente = Cliente.objects.create(
            rut_empresa="76123456-7",
            razon_social="Inversiones Maule S.A.",
            estado_cliente="Activo",
        )
        self.estado_ejecucion, _ = EstadoObra.objects.get_or_create(
            codigo_estado="EJECUCION", defaults={"descripcion": "En Ejecución"}
        )
        self.tipo_clima, _ = TipoServicio.objects.get_or_create(
            codigo="CLIMATIZACION", defaults={"nombre_servicio": "Climatización"}
        )
        self.obra = Obra.objects.create(
            codigo_obra="OBRA-RES-001",
            nombre_obra="Climatización Maule",
            ubicacion_faena="Talca",
            fecha_inicio=date(2026, 1, 1),
            cliente=self.cliente,
            tipo_servicio=self.tipo_clima,
            estado_obra=self.estado_ejecucion,
            supervisor=self.user_admin,
            costo_estimado=Decimal("500000.00"),
        )
        self.presupuesto = Presupuesto.objects.create(
            numero_presupuesto="PRE-RES-001",
            obra=self.obra,
            cliente=self.cliente,
            creador=self.user_admin,
            subtotal=Decimal("100000.00"),
            monto_iva=Decimal("19000.00"),
            monto_total=Decimal("119000.00"),
        )
        # Las migraciones cargan obras de demostración, así que el saldo estimado no parte en 0:
        # se guarda el valor inicial y se compara contra él.
        self.saldo_estimado_inicial = self._resumen()["saldo_estimado_por_cobrar"]

    def _crear_factura(self, folio, fecha_vencimiento):
        return Factura.objects.create(
            folio_factura=folio,
            presupuesto=self.presupuesto,
            cliente=self.cliente,
            fecha_emision=date(2026, 1, 1),
            fecha_vencimiento=fecha_vencimiento,
            monto_total=Decimal("100000.00"),
            saldo_pendiente=Decimal("100000.00"),
            estado_pago="Pendiente",
        )

    def _resumen(self):
        res = self.client.get(self.ENDPOINT)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return {clave: Decimal(valor) for clave, valor in res.data.items()}

    def test_sin_facturas_ni_pagos_devuelve_ceros(self):
        """Sin facturas ni pagos, todo es 0 y la morosidad no falla por división por cero."""
        datos = self._resumen()
        self.assertEqual(datos["total_cobrado"], Decimal("0.00"))
        self.assertEqual(datos["deuda_pendiente"], Decimal("0.00"))
        self.assertEqual(datos["deuda_vencida"], Decimal("0.00"))
        self.assertEqual(datos["porcentaje_morosidad"], Decimal("0.00"))

    def test_calculos_con_un_abono_y_una_factura_vencida(self):
        """Dos facturas de $100.000 (una vencida y una vigente) y un abono de $40.000 a la vencida."""
        factura_vencida = self._crear_factura("FAC-RES-0001", date(2026, 1, 31))
        self._crear_factura("FAC-RES-0002", date(2099, 12, 31))

        payload = {
            "factura": str(factura_vencida.id_factura),
            "monto_abonado": "40000.00",
            "metodo_pago": "Transferencia",
        }
        res = self.client.post(self.ENDPOINT_PAGOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        datos = self._resumen()
        self.assertEqual(datos["total_cobrado"], Decimal("40000.00"))
        self.assertEqual(datos["deuda_pendiente"], Decimal("160000.00"))
        self.assertEqual(datos["deuda_vencida"], Decimal("60000.00"))
        self.assertEqual(datos["porcentaje_morosidad"], Decimal("37.50"))
        self.assertEqual(
            datos["saldo_estimado_por_cobrar"],
            self.saldo_estimado_inicial - Decimal("40000.00"),
        )

    def test_morosidad_es_cero_si_no_hay_facturas_vencidas(self):
        self._crear_factura("FAC-RES-0003", date(2099, 12, 31))
        datos = self._resumen()
        self.assertEqual(datos["deuda_pendiente"], Decimal("100000.00"))
        self.assertEqual(datos["porcentaje_morosidad"], Decimal("0.00"))

    def test_morosidad_es_cien_si_toda_la_deuda_esta_vencida(self):
        self._crear_factura("FAC-RES-0004", date(2026, 1, 31))
        datos = self._resumen()
        self.assertEqual(datos["porcentaje_morosidad"], Decimal("100.00"))

    def test_factura_pagada_completa_no_cuenta_como_deuda(self):
        factura_vencida = self._crear_factura("FAC-RES-0005", date(2026, 1, 31))
        self._crear_factura("FAC-RES-0006", date(2099, 12, 31))

        payload = {
            "factura": str(factura_vencida.id_factura),
            "monto_abonado": "100000.00",
            "metodo_pago": "Transferencia",
        }
        res = self.client.post(self.ENDPOINT_PAGOS, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        datos = self._resumen()
        self.assertEqual(datos["total_cobrado"], Decimal("100000.00"))
        self.assertEqual(datos["deuda_pendiente"], Decimal("100000.00"))
        self.assertEqual(datos["deuda_vencida"], Decimal("0.00"))
        self.assertEqual(datos["porcentaje_morosidad"], Decimal("0.00"))

    def test_usuario_tecnico_no_puede_ver_el_resumen(self):
        grupo_tecnico, _ = Group.objects.get_or_create(name="TECNICO")
        tecnico = User.objects.create_user(username="tecnico_resumen", password="Password_123")
        tecnico.groups.add(grupo_tecnico)
        self.client.force_authenticate(user=tecnico)

        res = self.client.get(self.ENDPOINT)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_kpi_total_facturado_en_resumen(self):
        """Verifica que el KPI de total facturado se actualice con las facturas emitidas."""
        self._crear_factura("FAC-TEST-001", date(2026, 1, 31))
        self._crear_factura("FAC-TEST-002", date(2099, 12, 31))

        res = self.client.get(self.ENDPOINT)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(res.data["total_facturado"]), Decimal("200000.00"))

    def test_kpis_obras_por_estado_endpoint(self):
        """Verifica la consulta agregada de obras agrupadas por estado operativo."""
        res = self.client.get("/obras/fyag/v1/obras/resumen-estados/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("total_obras", res.data)
        self.assertIn("estados", res.data)
        self.assertGreaterEqual(res.data["total_obras"], 1)

        # Cada estado debe tener cantidad_obras y porcentaje
        for est in res.data["estados"]:
            self.assertIn("cantidad_obras", est)
            self.assertIn("porcentaje", est)

    def test_kpis_morosidad_conteo_facturas_y_clientes(self):
        """Verifica KPIs de morosidad avanzada: facturas vencidas y clientes morosos."""
        from .resumen_financiero import calcular_conteo_facturas_morosas, calcular_clientes_morosos

        # Inicialmente 0 morosas
        self.assertEqual(calcular_conteo_facturas_morosas(), 0)
        self.assertEqual(calcular_clientes_morosos(), 0)

        # Crear factura vencida
        self._crear_factura("FAC-MORA-001", date(2026, 1, 15))

        self.assertEqual(calcular_conteo_facturas_morosas(), 1)
        self.assertEqual(calcular_clientes_morosos(), 1)

    def test_kpis_dashboard_consolidado_endpoint(self):
        """Verifica el endpoint consolidado de KPIs (facturacion, obras_por_estado, morosidad)."""
        res = self.client.get("/obras/fyag/v1/kpis/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.assertIn("facturacion", res.data)
        self.assertIn("obras_por_estado", res.data)
        self.assertIn("morosidad", res.data)

        fact = res.data["facturacion"]
        self.assertIn("total_facturado", fact)
        self.assertIn("total_cobrado", fact)
        self.assertIn("deuda_pendiente", fact)
        self.assertIn("facturas_por_estado", fact)

        obras = res.data["obras_por_estado"]
        self.assertIn("total_obras", obras)
        self.assertIn("estados", obras)

        mora = res.data["morosidad"]
        self.assertIn("deuda_vencida", mora)
        self.assertIn("porcentaje_morosidad", mora)
        self.assertIn("facturas_vencidas_cantidad", mora)
        self.assertIn("clientes_morosos_cantidad", mora)


class NotificacionesYAprobacionPresupuestosTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Grupos
        self.grupo_gerente, _ = Group.objects.get_or_create(name="Gerencial")
        self.grupo_admin, _ = Group.objects.get_or_create(name="Administrativo")
        self.grupo_tecnico, _ = Group.objects.get_or_create(name="Tecnico")

        # Usuarios
        self.user_gerente = User.objects.create_user(username="gerente_presupuestos", password="password123")
        self.user_gerente.groups.add(self.grupo_gerente)

        self.user_admin = User.objects.create_user(username="admin_presupuestos", password="password123")
        self.user_admin.groups.add(self.grupo_admin)

        self.user_tecnico = User.objects.create_user(username="tecnico_presupuestos", password="password123")
        self.user_tecnico.groups.add(self.grupo_tecnico)

        # Datos base
        self.cliente = Cliente.objects.create(
            rut_empresa="76543210-9",
            razon_social="Constructora BioBio SpA",
            estado_cliente=Cliente.EstadoCliente.ACTIVO
        )
        self.tipo_servicio = TipoServicio.objects.create(
            codigo="CLIMA_NOTIF",
            nombre_servicio="Climatización Comercial"
        )
        self.estado_ejecucion, _ = EstadoObra.objects.get_or_create(
            codigo_estado="EJECUCION",
            defaults={"descripcion": "En Ejecución"}
        )
        self.obra = Obra.objects.create(
            codigo_obra="OBRA-NOTIF-001",
            nombre_obra="Instalación HVAC Torre A",
            ubicacion_faena="Concepción",
            fecha_inicio=date(2026, 3, 1),
            cliente=self.cliente,
            tipo_servicio=self.tipo_servicio,
            estado_obra=self.estado_ejecucion,
            supervisor=self.user_gerente,
        )

    def test_crear_presupuesto_genera_notificacion_para_gerente(self):
        """Al crear un presupuesto se debe notificar automáticamente a los gerentes."""
        self.client.force_authenticate(user=self.user_admin)
        res = self.client.post("/obras/fyag/v1/presupuestos/", {
            "obra": str(self.obra.id_obra),
            "subtotal": "500000.00",
            "estado_presupuesto": "Borrador"
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        presupuesto_id = res.data["id_presupuesto"]
        notifs = NotificacionPresupuesto.objects.filter(
            usuario=self.user_gerente,
            presupuesto_id=presupuesto_id
        )
        self.assertTrue(notifs.exists())
        notif = notifs.first()
        self.assertFalse(notif.leida)
        self.assertIn("Nuevo presupuesto", notif.mensaje)

    def test_gerente_puede_aprobar_presupuesto_exitosamente(self):
        """Un usuario con rol Gerencial puede aprobar un presupuesto y registrarse como aprobador."""
        presupuesto = Presupuesto.objects.create(
            numero_presupuesto="PRE-APROB-001",
            obra=self.obra,
            cliente=self.cliente,
            creador=self.user_admin,
            subtotal=Decimal("100000.00"),
            monto_iva=Decimal("19000.00"),
            monto_total=Decimal("119000.00"),
            estado_presupuesto=Presupuesto.EstadoPresupuesto.PENDIENTE_APROBACION
        )
        NotificacionPresupuesto.objects.create(
            usuario=self.user_gerente,
            presupuesto=presupuesto,
            tipo="PENDIENTE",
            mensaje="Pendiente de aprobación"
        )

        self.client.force_authenticate(user=self.user_gerente)
        url = f"/obras/fyag/v1/presupuestos/{presupuesto.id_presupuesto}/aprobar/"
        res = self.client.post(url, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        presupuesto.refresh_from_db()
        self.assertEqual(presupuesto.estado_presupuesto, Presupuesto.EstadoPresupuesto.APROBADO)
        self.assertEqual(presupuesto.aprobador_gerencia, self.user_gerente)

        # La notificación debe haberse marcado como leída
        notif = NotificacionPresupuesto.objects.get(usuario=self.user_gerente, presupuesto=presupuesto)
        self.assertTrue(notif.leida)

    def test_gerente_puede_rechazar_presupuesto_exitosamente(self):
        """Un usuario con rol Gerencial puede rechazar un presupuesto."""
        presupuesto = Presupuesto.objects.create(
            numero_presupuesto="PRE-RECH-001",
            obra=self.obra,
            cliente=self.cliente,
            creador=self.user_admin,
            subtotal=Decimal("100000.00"),
            monto_iva=Decimal("19000.00"),
            monto_total=Decimal("119000.00"),
            estado_presupuesto=Presupuesto.EstadoPresupuesto.BORRADOR
        )

        self.client.force_authenticate(user=self.user_gerente)
        url = f"/obras/fyag/v1/presupuestos/{presupuesto.id_presupuesto}/rechazar/"
        res = self.client.post(url, {"motivo": "Precio unitario excesivo"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        presupuesto.refresh_from_db()
        self.assertEqual(presupuesto.estado_presupuesto, Presupuesto.EstadoPresupuesto.RECHAZADO)
        self.assertEqual(presupuesto.aprobador_gerencia, self.user_gerente)

    def test_usuario_no_gerencial_no_puede_aprobar_ni_rechazar(self):
        """Usuarios sin rol Gerencial reciben 403 Forbidden al intentar aprobar o rechazar."""
        presupuesto = Presupuesto.objects.create(
            numero_presupuesto="PRE-NOAUTH-001",
            obra=self.obra,
            cliente=self.cliente,
            creador=self.user_admin,
            subtotal=Decimal("100000.00"),
            monto_iva=Decimal("19000.00"),
            monto_total=Decimal("119000.00"),
            estado_presupuesto=Presupuesto.EstadoPresupuesto.PENDIENTE_APROBACION
        )

        # Probar como Administrativo
        self.client.force_authenticate(user=self.user_admin)
        url_aprobar = f"/obras/fyag/v1/presupuestos/{presupuesto.id_presupuesto}/aprobar/"
        res = self.client.post(url_aprobar, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Probar como Técnico
        self.client.force_authenticate(user=self.user_tecnico)
        url_rechazar = f"/obras/fyag/v1/presupuestos/{presupuesto.id_presupuesto}/rechazar/"
        res = self.client.post(url_rechazar, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_gerente_puede_listar_y_marcar_notificaciones_leidas(self):
        """El gerente puede ver sus notificaciones y marcarlas como leídas."""
        presupuesto = Presupuesto.objects.create(
            numero_presupuesto="PRE-LIST-001",
            obra=self.obra,
            cliente=self.cliente,
            creador=self.user_admin,
            subtotal=Decimal("100000.00"),
            monto_iva=Decimal("19000.00"),
            monto_total=Decimal("119000.00"),
        )
        notif = NotificacionPresupuesto.objects.create(
            usuario=self.user_gerente,
            presupuesto=presupuesto,
            mensaje="Test notificacion",
            leida=False
        )

        self.client.force_authenticate(user=self.user_gerente)
        res_list = self.client.get("/obras/fyag/v1/notificaciones-presupuesto/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in (res_list.data if isinstance(res_list.data, list) else res_list.data.get("results", []))]
        self.assertIn(notif.id, ids)

        # Marcar leída
        res_marcar = self.client.post(f"/obras/fyag/v1/notificaciones-presupuesto/{notif.id}/marcar-leida/")
        self.assertEqual(res_marcar.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertTrue(notif.leida)


class BloqueoFinalizacionObraFacturaPendienteTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.grupo_gerente, _ = Group.objects.get_or_create(name="Gerencial")
        self.user_gerente = User.objects.create_user(username="gerente_bloqueo", password="password123")
        self.user_gerente.groups.add(self.grupo_gerente)
        self.client.force_authenticate(user=self.user_gerente)

        self.cliente = Cliente.objects.create(
            rut_empresa="77111222-3",
            razon_social="Inmobiliaria San Pedro Ltda",
            estado_cliente=Cliente.EstadoCliente.ACTIVO
        )
        self.tipo_servicio = TipoServicio.objects.create(
            codigo="ELEC_BLOQ",
            nombre_servicio="Proyecto Eléctrico"
        )
        self.estado_ejecucion, _ = EstadoObra.objects.get_or_create(
            codigo_estado="EJECUCION",
            defaults={"descripcion": "En Ejecución"}
        )
        self.estado_finalizada, _ = EstadoObra.objects.get_or_create(
            codigo_estado="FINALIZADA",
            defaults={"descripcion": "Finalizada"}
        )

        self.obra = Obra.objects.create(
            codigo_obra="OBRA-BLOQ-001",
            nombre_obra="Subestación Eléctrica Fase 1",
            ubicacion_faena="San Pedro de la Paz",
            fecha_inicio=date(2026, 1, 10),
            cliente=self.cliente,
            tipo_servicio=self.tipo_servicio,
            estado_obra=self.estado_ejecucion,
            supervisor=self.user_gerente,
        )

        self.presupuesto = Presupuesto.objects.create(
            numero_presupuesto="PRE-BLOQ-001",
            obra=self.obra,
            cliente=self.cliente,
            creador=self.user_gerente,
            subtotal=Decimal("1000000.00"),
            monto_iva=Decimal("190000.00"),
            monto_total=Decimal("1190000.00"),
            estado_presupuesto=Presupuesto.EstadoPresupuesto.APROBADO
        )

    def test_obra_con_presupuesto_sin_factura_no_puede_finalizarse(self):
        """Si la obra tiene presupuesto aprobado pero sin factura emitida, no puede finalizarse."""
        with self.assertRaises(Exception) as ctx:
            aplicar_transicion_estado(self.obra, "FINALIZADA")
        self.assertIn("no cuenta con una factura emitida", str(ctx.exception))

    def test_obra_con_presupuesto_y_factura_pendiente_no_puede_finalizarse(self):
        """Si la factura tiene saldo pendiente y estado Pendiente, no puede finalizarse."""
        Factura.objects.create(
            folio_factura="FAC-BLOQ-001",
            presupuesto=self.presupuesto,
            cliente=self.cliente,
            fecha_emision=date(2026, 2, 1),
            fecha_vencimiento=date(2026, 3, 1),
            monto_total=Decimal("1190000.00"),
            saldo_pendiente=Decimal("1190000.00"),
            estado_pago=Factura.EstadoPago.PENDIENTE
        )

        with self.assertRaises(Exception) as ctx:
            aplicar_transicion_estado(self.obra, "FINALIZADA")
        self.assertIn("no está completamente pagada", str(ctx.exception))

    def test_obra_con_presupuesto_y_factura_pago_parcial_no_puede_finalizarse(self):
        """Si la factura tiene saldo pendiente y estado Pago Parcial, no puede finalizarse."""
        Factura.objects.create(
            folio_factura="FAC-BLOQ-002",
            presupuesto=self.presupuesto,
            cliente=self.cliente,
            fecha_emision=date(2026, 2, 1),
            fecha_vencimiento=date(2026, 3, 1),
            monto_total=Decimal("1190000.00"),
            saldo_pendiente=Decimal("400000.00"),
            estado_pago=Factura.EstadoPago.PAGO_PARCIAL
        )

        with self.assertRaises(Exception) as ctx:
            aplicar_transicion_estado(self.obra, "FINALIZADA")
        self.assertIn("no está completamente pagada", str(ctx.exception))

    def test_obra_con_presupuesto_y_factura_pagada_puede_finalizarse(self):
        """Cuando todas las facturas del presupuesto están pagadas y saldo 0, la obra se finaliza exitosamente."""
        Factura.objects.create(
            folio_factura="FAC-BLOQ-003",
            presupuesto=self.presupuesto,
            cliente=self.cliente,
            fecha_emision=date(2026, 2, 1),
            fecha_vencimiento=date(2026, 3, 1),
            monto_total=Decimal("1190000.00"),
            saldo_pendiente=Decimal("0.00"),
            estado_pago=Factura.EstadoPago.PAGADO
        )

        obra_fin = aplicar_transicion_estado(self.obra, "FINALIZADA")
        self.assertEqual(obra_fin.estado_obra.codigo_estado, "FINALIZADA")
        self.assertIsNotNone(obra_fin.fecha_cierre_real)

    def test_api_cambiar_estado_rechaza_finalizar_si_factura_impaga(self):
        """Endpoint de cambio de estado retorna 400 si la factura del presupuesto no está pagada."""
        Factura.objects.create(
            folio_factura="FAC-BLOQ-API-001",
            presupuesto=self.presupuesto,
            cliente=self.cliente,
            fecha_emision=date(2026, 2, 1),
            fecha_vencimiento=date(2026, 3, 1),
            monto_total=Decimal("1190000.00"),
            saldo_pendiente=Decimal("1190000.00"),
            estado_pago=Factura.EstadoPago.PENDIENTE
        )

        url = f"/obras/fyag/v1/obras/{self.obra.id_obra}/cambiar-estado/"
        res = self.client.post(url, {"nuevo_estado": "FINALIZADA"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no está completamente pagada", str(res.data.get("error", "")))

    def test_api_cambiar_estado_permite_finalizar_cuando_factura_esta_pagada(self):
        """Endpoint de cambio de estado retorna 200 y finaliza cuando la factura está 100% pagada."""
        Factura.objects.create(
            folio_factura="FAC-BLOQ-API-002",
            presupuesto=self.presupuesto,
            cliente=self.cliente,
            fecha_emision=date(2026, 2, 1),
            fecha_vencimiento=date(2026, 3, 1),
            monto_total=Decimal("1190000.00"),
            saldo_pendiente=Decimal("0.00"),
            estado_pago=Factura.EstadoPago.PAGADO
        )

        url = f"/obras/fyag/v1/obras/{self.obra.id_obra}/cambiar-estado/"
        res = self.client.post(url, {"nuevo_estado": "FINALIZADA"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.obra.refresh_from_db()
        self.assertEqual(self.obra.estado_obra.codigo_estado, "FINALIZADA")

