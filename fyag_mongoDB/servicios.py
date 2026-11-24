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


def consultar_auditoria(
    usuario=None,
    accion=None,
    recurso=None,
    recurso_id=None,
    desde=None,
    hasta=None,
    pagina=1,
    por_pagina=50,
):
    filtro = {}

    if usuario:
        filtro["metadata.usuario"] = usuario
    if accion:
        filtro["metadata.accion"] = accion
    if recurso:
        filtro["metadata.recurso"] = recurso
    if recurso_id is not None:
        filtro["metadata.recurso_id"] = str(recurso_id)

    if desde or hasta:
        rango = {}
        if desde:
            rango["$gte"] = desde
        if hasta:
            rango["$lte"] = hasta
        filtro["timestamp"] = rango
    #max sirve para q la pagina no sea menor q uno, nada más
    pagina = max(int(pagina), 1)
    por_pagina = min(max(int(por_pagina), 1), 100) #esto es para poner el limite en 100 y el menor en 1
    saltar = (pagina - 1) * por_pagina

    try:
        total = audit_logs_collection.count_documents(filtro)

        cursor = (
            audit_logs_collection.find(filtro)
            .sort("timestamp", -1)    #lo mas reciente primero
            .skip(saltar)
            .limit(por_pagina)
        )

        resultados = []
        for doc in cursor:
            meta = doc.get("metadata", {})
            resultados.append({
                "id": str(doc["_id"]),
                "timestamp": doc["timestamp"].isoformat(),
                "usuario_id": meta.get("usuario_id"),
                "usuario": meta.get("usuario"),
                "accion": meta.get("accion"),
                "recurso": meta.get("recurso"),
                "recurso_id": meta.get("recurso_id"),
                "ip": meta.get("ip"),
                "detalles": doc.get("detalles", {}),
            })

        return {
            "total": total,
            "pagina": pagina,
            "por_pagina": por_pagina,
            "total_paginas": (total + por_pagina - 1) // por_pagina,
            "resultados": resultados,
        }
    except Exception as err:
        logger.error(f"Error al consultar auditoría en MongoDB: {err}")
        return {"total": 0, "pagina": pagina, "por_pagina": por_pagina,
                "total_paginas": 0, "resultados": []}