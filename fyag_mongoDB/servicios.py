from datetime import datetime, timezone
import json
import logging
from .mongo import audit_logs_collection, asegurar_coleccion_timeseries

logger = logging.getLogger(__name__)

def sanitizar_para_bson(datos):

    # Convierte tipos no compatibles directamente con BSON (como datetime.date,
    # datetime.time, Decimal o UUID) a estructuras JSON válidas y serializables.
    if not datos:
        return {}
    try:
        return json.loads(json.dumps(datos, default=str))
    except Exception:
        return {"raw": str(datos)}

def registrar_evento(request, accion, recurso, recurso_id, detalles=None):
    try:
        asegurar_coleccion_timeseries()

        # esto le saca la ip al user
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR') if request else None
        ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else (request.META.get('REMOTE_ADDR') if request else None)

        usuario = request.user if request and request.user.is_authenticated else None

        documento = {
            "timestamp": datetime.now(timezone.utc),

            "metadata": {
                "usuario_id": getattr(usuario, 'id', None),
                "usuario": getattr(usuario, 'username', 'anonimo'),
                "accion": accion,        # 'CREAR', 'EDITAR', 'ELIMINAR', etc.
                "recurso": recurso,      # 'Obra', 'Cliente', 'Factura', etc.
                "recurso_id": str(recurso_id),
                "ip": ip,
            },

            "detalles": sanitizar_para_bson(detalles)
        }

        audit_logs_collection.insert_one(documento)
    except Exception as err:
        logger.error(f"Error al registrar auditoría en MongoDB: {err}")
