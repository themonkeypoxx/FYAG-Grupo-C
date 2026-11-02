"""
Módulo de lógica de negocio y máquina de estados operativos para Obras FYAG.
"""
from typing import Dict, List, Optional, Tuple
from django.utils import timezone
from rest_framework import serializers
from .models import EstadoObra, Obra


# Matriz de transiciones permitidas según el estado actual
TRANSICIONES_VALIDAS: Dict[str, List[str]] = {
    "PENDIENTE": ["EJECUCION", "CANCELADA"],
    "EJECUCION": ["SUSPENDIDA", "FINALIZADA"],
    "SUSPENDIDA": ["EJECUCION", "CANCELADA"],
    "FINALIZADA": [],  # Estado terminal
    "CANCELADA": [],   # Estado terminal
}

# Nombres amigables para las acciones en el frontend
ETIQUETAS_ACCIONES: Dict[Tuple[str, str], str] = {
    ("PENDIENTE", "EJECUCION"): "Iniciar Ejecución",
    ("PENDIENTE", "CANCELADA"): "Cancelar Obra",
    ("EJECUCION", "SUSPENDIDA"): "Suspender Obra",
    ("EJECUCION", "FINALIZADA"): "Finalizar Obra",
    ("SUSPENDIDA", "EJECUCION"): "Reanudar Obra",
    ("SUSPENDIDA", "CANCELADA"): "Cancelar Obra",
}


def obtener_transiciones_posibles(estado_codigo: str) -> List[dict]:
    """
    Retorna la lista de transiciones operativas válidas a partir de un estado dado,
    con su código, descripción y etiqueta de acción recomendada.
    """
    destinos = TRANSICIONES_VALIDAS.get(estado_codigo, [])
    if not destinos:
        return []

    estados_db = {
        e.codigo_estado: e.descripcion
        for e in EstadoObra.objects.filter(codigo_estado__in=destinos)
    }

    resultado = []
    for cod in destinos:
        resultado.append({
            "codigo_estado": cod,
            "descripcion": estados_db.get(cod, cod),
            "accion": ETIQUETAS_ACCIONES.get((estado_codigo, cod), f"Pasar a {cod}"),
            "requiere_motivo": cod in ["SUSPENDIDA", "CANCELADA"],
        })
    return resultado


def validar_transicion_estado(
    obra: Obra,
    nuevo_codigo: str,
    motivo: Optional[str] = None
) -> EstadoObra:
    """
    Valida las reglas de la máquina de estados.
    Si es válida, retorna la instancia de EstadoObra destino.
    Lanza serializers.ValidationError con mensaje claro si no cumple las reglas.
    """
    if not obra.estado_obra:
        raise serializers.ValidationError("La obra no tiene un estado asignado.")

    estado_actual_cod = obra.estado_obra.codigo_estado

    if estado_actual_cod == nuevo_codigo:
        raise serializers.ValidationError(
            f"La obra ya se encuentra en estado '{obra.estado_obra.descripcion}'."
        )

    # Verificar si es estado terminal
    if estado_actual_cod in ["FINALIZADA", "CANCELADA"]:
        raise serializers.ValidationError(
            f"No se pueden realizar cambios: la obra ya está en estado terminal "
            f"'{obra.estado_obra.descripcion}'."
        )

    destinos_permitidos = TRANSICIONES_VALIDAS.get(estado_actual_cod, [])
    if nuevo_codigo not in destinos_permitidos:
        permitidos_str = ", ".join(destinos_permitidos) if destinos_permitidos else "ninguno"
        raise serializers.ValidationError(
            f"Transición no permitida: no se puede pasar de '{estado_actual_cod}' a '{nuevo_codigo}'. "
            f"Transiciones válidas desde este estado: [{permitidos_str}]."
        )

    # Exigir motivo en caso de suspensión o cancelación
    if nuevo_codigo in ["SUSPENDIDA", "CANCELADA"]:
        motivo_limpio = (motivo or "").strip()
        if not motivo_limpio:
            accion = "suspender" if nuevo_codigo == "SUSPENDIDA" else "cancelar"
            raise serializers.ValidationError(
                f"Debe especificar obligatoriamente un motivo para {accion} la obra."
            )

    try:
        nuevo_estado = EstadoObra.objects.get(codigo_estado=nuevo_codigo)
    except EstadoObra.DoesNotExist:
        raise serializers.ValidationError(
            f"El estado con código '{nuevo_codigo}' no existe en el catálogo."
        )

    return nuevo_estado


def aplicar_transicion_estado(
    obra: Obra,
    nuevo_codigo: str,
    motivo: Optional[str] = None
) -> Obra:
    """
    Ejecuta la transición validando reglas de negocio y actualizando
    fechas y motivos pertinentes en el modelo.
    """
    nuevo_estado = validar_transicion_estado(obra, nuevo_codigo, motivo)

    # Registrar motivo si aplica
    if nuevo_codigo in ["SUSPENDIDA", "CANCELADA"] and motivo:
        obra.motivo_suspension_cancelacion = motivo.strip()

    # Si se finaliza, establecer fecha_cierre_real automática si está vacía
    if nuevo_codigo == "FINALIZADA":
        if not obra.fecha_cierre_real:
            obra.fecha_cierre_real = timezone.now().date()

    # Si se reanuda desde SUSPENDIDA a EJECUCION, mantenemos registro o historial
    obra.estado_obra = nuevo_estado
    obra.save()
    return obra

