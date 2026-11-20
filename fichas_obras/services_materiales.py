from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import AsignacionMaterial, Material, Obra

ESTADOS_OBRA_CERRADOS = {"FINALIZADA", "CANCELADA"}
DOS_DECIMALES = Decimal("0.01")


def _normalizar_cantidad(cantidad):
    try: 
        valor = Decimal(str(cantidad)).quantize(DOS_DECIMALES, rounding=ROUND_HALF_UP)
    except Exception:
        raise ValidationError({"cantidad": "La cantidad debe ser un numero valido."})
    if valor <= 0:
        raise ValidationError({"cantidad": "La cantidad deber mayor a cero"})
    return valor

def _validar_obra_abierta(obra):
    if obra.soft_deleted:
        raise ValidationError({"obra":"La obra fue eliminada: no admite cambios de materiales."})
    if obra.estado_obra.codigo_estado in ESTADOS_OBRA_CERRADOS:
        raise ValidationError({
            "obra": f"No se pueden modificar materiales de una obra{obra.estado_obra.descripcion.lower()}."
        })

def _bloquear_material(material_id):
    try:
        return Material.objects.select_for_update().get(pk=material_id)
    except Material.DoesNotExist:
        raise ValidationError({"material": "El material no existe."})


def _validar_stock(material, requerido):
    if material.stock_actual < requerido:
        raise ValidationError({
            "cantidad": (
                f"Stock insuficiente de {material.nombre}: "
                f"disponible {material.stock_actual} {material.unidad_medida}, "
                f"solicitado {requerido}."
            )
        })


def asignar_material(obra, material_id, cantidad, usuario, observacion=""):
    """Entrega material a la obra y descuenta el stock del catálogo."""
    cantidad = _normalizar_cantidad(cantidad)
    with transaction.atomic():
        obra = Obra.objects.select_related("estado_obra").get(pk=obra.pk)
        _validar_obra_abierta(obra)

        material = _bloquear_material(material_id)
        if not material.activo:
            raise ValidationError({"material": "El material está inactivo y no se puede asignar."})
        _validar_stock(material, cantidad)

        material.stock_actual -= cantidad
        material.save(update_fields=["stock_actual"])

        return AsignacionMaterial.objects.create(
            obra=obra,
            material=material,
            asignado_por=usuario,
            cantidad=cantidad,
            precio_unitario=material.precio_unitario,
            fecha_asignacion=timezone.now(),
            observacion=(observacion or "").strip(),
        )   

def actualizar_asignacion(asignacion, cantidad=None, observacion=None):
    """CAmbia la cantidad (ajustando el stock por la diferencia) y/o la observacion."""
    with transaction.atomic():
        asignacion = (
            AsignacionMaterial.objects.select_related("obra__estado_obra")
            .get(pk=asignacion.pk)
        )
        _validar_obra_abierta(asignacion.obra)
        material = _bloquear_material(asignacion.material_id)

        if cantidad is not None:
            nueva = _normalizar_cantidad(cantidad)
            diferencia = nueva - asignacion.cantidad
            if diferencia > 0:
                _validar_stock(material, diferencia)
            if diferencia != 0:
                material.stock_actual -= diferencia
                material.save(update_fields=["stock_actual"])
                asignacion.cantidad = nueva

        if observacion is not None:
            asignacion.observacion = observacion.strip()

        asignacion.save(update_fields=["cantidad", "observacion"])
        return asignacion

def quitar_asignacion(asignacion):
    """Devuelve el material al catálogo (repone stock) y elimina la asignación."""
    with transaction.atomic():
        asignacion = (
            AsignacionMaterial.objects.select_related("obra__estado_obra")
            .get(pk=asignacion.pk)
        )
        _validar_obra_abierta(asignacion.obra)
        material = _bloquear_material(asignacion.material_id)

        material.stock_actual += asignacion.cantidad
        material.save(update_fields=["stock_actual"])
        datos = {
            "material_id": asignacion.material_id,
            "material_codigo": material.codigo,
            "cantidad": asignacion.cantidad,
            "stock_resultante": material.stock_actual,
        }
        asignacion.delete()
        return datos
            