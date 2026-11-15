from decimal import Decimal

from django.db.models import Sum

from .models import Obra, RegistroPago, Factura

from django.utils import timezone


def calcular_total_estimado_obras():
    obras = Obra.objects.filter(soft_deleted=False)

    resultado = obras.aggregate(
        total=Sum("costo_estimado")
    )

    return resultado["total"] or Decimal("0.00")


def calcular_total_cobrado():
    resultado = RegistroPago.objects.aggregate(
        total=Sum("monto_abonado")
    )

    return resultado["total"] or Decimal("0.00")


def calcular_deuda_pendiente():
    resultado = Factura.objects.filter(
        soft_deleted=False,
        saldo_pendiente__gt=0
    ).aggregate(
        total=Sum("saldo_pendiente")
    )

    return resultado["total"] or Decimal("0.00")


def calcular_deuda_vencida():
    hoy = timezone.localdate()

    resultado = Factura.objects.filter(
        soft_deleted=False,
        saldo_pendiente__gt=0,
        fecha_vencimiento__lt=hoy
    ).aggregate(
        total=Sum("saldo_pendiente")
    )

    return resultado["total"] or Decimal("0.00")

def calcular_porcentaje_morosidad():
    deuda = calcular_deuda_pendiente()
    vencida = calcular_deuda_vencida()

    if deuda == Decimal("0.00"):
        return Decimal("0.00")

    porcentaje = (vencida / deuda) * Decimal("100")

    return porcentaje.quantize(Decimal("0.01"))


def calcular_saldo_estimado_por_cobrar():
    pagos_por_obra = (
        RegistroPago.objects
        .values("factura__presupuesto__obra_id")
        .annotate(total=Sum("monto_abonado"))
    )

    pagos_por_obra = {
        registro["factura__presupuesto__obra_id"]: registro["total"]
        for registro in pagos_por_obra
    }

    saldo_estimado_total = Decimal("0.00")

    obras = Obra.objects.filter(
        soft_deleted=False
    ).values("id_obra", "costo_estimado")

    for obra in obras:
        pagos = pagos_por_obra.get(
            obra["id_obra"],
            Decimal("0.00")
        )

        saldo_obra = obra["costo_estimado"] - pagos

        if saldo_obra > Decimal("0.00"):
            saldo_estimado_total += saldo_obra

    return saldo_estimado_total