from .mongo import maquinarias_collection, inicializar_catalogo_maquinarias

def obtener_todas_las_maquinas():
    inicializar_catalogo_maquinarias() 
    return list(maquinarias_collection.find({}, {'_id': 0}))

def obtener_maquinas_por_obra(obra_id):
    #Retorna las máquinas actualmente asignadas a una obra específica
    return list(maquinarias_collection.find({"obra_id": str(obra_id)}, {'_id': 0}))

def asignar_maquina_a_obra(codigo_maquina, obra_id):
    return maquinarias_collection.update_one(
        {"codigo": codigo_maquina},
        {"$set": {"obra_id": str(obra_id), "estado": "ASIGNADA"}}
    )

def liberar_maquina(codigo_maquina):
    return maquinarias_collection.update_one(
        {"codigo": codigo_maquina},
        {"$set": {"obra_id": None, "estado": "DISPONIBLE"}}
    )