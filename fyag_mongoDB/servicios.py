from datetime import datetime, timezone
import json
import logging
from .mongo import audit_logs_collection, asegurar_coleccion_timeseries
from datetime import timedelta
from .mongo import maquinarias_collection, inicializar_catalogo_maquinarias

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
        
def obtener_agregacion_dashboard_mongo():
    """
    Pipeline de agregación en MongoDB para métricas operativas en tiempo real:
    - Estado actual del parque de maquinarias ($group)
    - Actividad reciente de auditoría en las últimas 24 horas ($match + $group)
    """
    inicializar_catalogo_maquinarias()
    hace_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    
    pipeline_maquinarias = [
        {"$group": {"_id": "$estado", "cantidad": {"$sum": 1}}},
        {"$project": {"_id": 0, "estado": "$_id", "cantidad": 1}}
    ]
    maquinarias_agg = list(maquinarias_collection.aggregate(pipeline_maquinarias))


    pipeline_auditoria = [
        {"$match": {"timestamp": {"$gte": hace_24h}}},
        {"$group": {"_id": "$metadata.accion", "total": {"$sum": 1}}},
        {"$sort": {"total": -1}},
        {"$limit": 6},
        {"$project": {"_id": 0, "accion": "$_id", "total": 1}}
    ]
    actividad_agg = list(audit_logs_collection.aggregate(pipeline_auditoria))

    return {
        "maquinarias_por_estado": maquinarias_agg,
        "actividad_reciente_24h": actividad_agg,
    }
