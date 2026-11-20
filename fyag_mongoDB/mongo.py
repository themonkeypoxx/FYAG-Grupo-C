from django.conf import settings
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)

client = MongoClient(getattr(settings, 'MONGO_URI', 'mongodb://localhost:27017/'), serverSelectionTimeoutMS=2000)
audit_db = client[getattr(settings, 'MONGO_DB_NAME', 'fyag_auditoria')]

maquinarias_collection = audit_db['maquinarias']

NOMBRE_COLECCION = 'logs_auditoria'
audit_logs_collection = audit_db[NOMBRE_COLECCION]

coleccion_inicializada = False

def asegurar_coleccion_timeseries():
    global _coleccion_inicializada
    if _coleccion_inicializada:
        return
    try:
        if NOMBRE_COLECCION not in audit_db.list_collection_names():
            audit_db.create_collection(
                NOMBRE_COLECCION,
                timeseries={
                    'timeField': 'timestamp',     
                    'metaField': 'metadata',      
                    'granularity': 'seconds',     
                },
                expireAfterSeconds=100 * 24 * 60 * 60
            )
        _coleccion_inicializada = True
    except Exception as e:
        logger.warning(f"No se pudo inicializar la colección time-series en MongoDB: {e}")

def get_audit_collection():
    asegurar_coleccion_timeseries()
    return audit_logs_collection



####### Simulación de catálogo d maquinarias
####### al final decidí implementarlo, despues en el informe solo
####### debemos justificar el cambio del registro de auditoría a MongoDB
#     (lo haré yo) - Ismael

def inicializar_catalogo_maquinarias():
    if maquinarias_collection.count_documents({}) == 0:
        maquinarias_iniciales = [
            {
                "codigo": "MAQ-001",
                "nombre": "Bomba de Vacío Industrial Robinair 15800 (8 CFM)",
                "tipo": "Manejo de refrigerantes",
                "patente": None,
                "estado": "DISPONIBLE",  
                "obra_id": None,          
            },
            {
                "codigo": "MAQ-002",
                "nombre": "Recuperadora de Refrigerante Fieldpiece MR45",
                "tipo": "Manejo de refrigerantes",
                "patente": None,
                "estado": "DISPONIBLE",
                "obra_id": None,
            },
            {
                "codigo": "MAQ-003",
                "nombre": "Equipo de Soldadura Oxiacetilénica Portátil",
                "tipo": "Soldadura y tuberías",
                "patente": None,
                "estado": "DISPONIBLE",
                "obra_id": None,
            },
            {
                "codigo": "MAQ-004",
                "nombre": "Plataforma Elevadora Tijera Genie GS-1930",
                "tipo": "Elevación y montaje",
                "patente": "PL-HV-10",
                "estado": "DISPONIBLE",
                "obra_id": None,
            },
            {
                "codigo": "MAQ-005",
                "nombre": "Taladro Perforador Sacatestigos Hilti DD 150-U",
                "tipo": "Perforación estructural",
                "patente": None,
                "estado": "DISPONIBLE",
                "obra_id": None,
            },
            {
                "codigo": "MAQ-006",
                "nombre": "Hidrolavadora Industrial Kärcher HD 5/15 C",
                "tipo": "Limpieza y mantenimiento",
                "patente": None,
                "estado": "DISPONIBLE",
                "obra_id": None,
            },
            {
                "codigo": "MAQ-007",
                "nombre": "Analizador Digital de Combustión y Gases Testo 330i",
                "tipo": "Diagnóstico y medición",
                "patente": None,
                "estado": "DISPONIBLE",
                "obra_id": None,
            },
            {
                "codigo": "MAQ-008",
                "nombre": "Camión Pluma Fuso Canter (Montaje de Chillers)",
                "tipo": "Transporte y elevación",
                "patente": "KL-MN-88",
                "estado": "DISPONIBLE",
                "obra_id": None,
            },
        ]
        
        maquinarias_collection.insert_many(maquinarias_iniciales)