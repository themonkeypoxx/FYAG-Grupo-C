from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone
from django.db.models.functions import TruncMonth
from .models import EstadoObra, Factura, Obra, RegistroPago


def calcular_total_estimado_obras():
    """
    Suma del costo estimado de todas las obras activas (no eliminadas lógicamente).
    """
    obras = Obra.objects.filter(soft_deleted=False)

    resultado = obras.aggregate(
        total=Sum("costo_estimado")
    )

    return resultado["total"] or Decimal("0.00")


def calcular_total_facturado():
    """
    KPI de Facturación bruta: suma de monto_total de todas las facturas
    activas (no soft-deleted).
    """
    resultado = Factura.objects.filter(soft_deleted=False).aggregate(
        total=Sum("monto_total")
    )

    return resultado["total"] or Decimal("0.00")


def calcular_total_cobrado():
    """
    Total recaudado / cobrado: suma de todos los abonos registrados en pagos.
    """
    resultado = RegistroPago.objects.aggregate(
        total=Sum("monto_abonado")
    )

    return resultado["total"] or Decimal("0.00")


def calcular_deuda_pendiente():
    """
    Total de deuda pendiente por cobrar en facturas no eliminadas.
    """
    resultado = Factura.objects.filter(
        soft_deleted=False,
        saldo_pendiente__gt=0
    ).aggregate(
        total=Sum("saldo_pendiente")
    )

    return resultado["total"] or Decimal("0.00")


def calcular_deuda_vencida():
    """
    KPI de Morosidad: suma del saldo pendiente en facturas cuya fecha de
    vencimiento es anterior a la fecha actual.
    """
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
    """
    KPI de Tasa de Morosidad (%): porcentaje de la deuda pendiente que ya venció.
    (deuda_vencida / deuda_pendiente) * 100
    """
    deuda = calcular_deuda_pendiente()
    vencida = calcular_deuda_vencida()

    if deuda == Decimal("0.00"):
        return Decimal("0.00")

    porcentaje = (vencida / deuda) * Decimal("100")

    return porcentaje.quantize(Decimal("0.01"))


def calcular_conteo_facturas_morosas():
    """
    KPI de Morosidad: cantidad de facturas vencidas con saldo pendiente.
    """
    hoy = timezone.localdate()
    return Factura.objects.filter(
        soft_deleted=False,
        saldo_pendiente__gt=0,
        fecha_vencimiento__lt=hoy
    ).count()


def calcular_clientes_morosos():
    """
    KPI de Morosidad: número de clientes distintos con al menos una factura vencida.
    """
    hoy = timezone.localdate()
    return Factura.objects.filter(
        soft_deleted=False,
        saldo_pendiente__gt=0,
        fecha_vencimiento__lt=hoy
    ).values("cliente_id").distinct().count()


def calcular_saldo_estimado_por_cobrar():
    """
    Saldo estimado por cobrar global:
    Para cada obra activa, costo_estimado menos pagos abonados.
    """
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


def calcular_obras_por_estado():
    """
    KPI de Obras por Estado: consulta agregada agrupando obras activas
    por estado operativo, retornando cantidad de obras y porcentaje sobre el total.
    """
    estados = EstadoObra.objects.all().order_by("id_estado_obra")
    conteo_por_estado = dict(
        Obra.objects.filter(soft_deleted=False)
        .values("estado_obra_id")
        .annotate(total=Count("id_obra"))
        .values_list("estado_obra_id", "total")
    )

    total_obras = sum(conteo_por_estado.values())
    resultado = []

    for est in estados:
        cant = conteo_por_estado.get(est.id_estado_obra, 0)
        porcentaje = round((cant / total_obras) * 100, 2) if total_obras > 0 else 0.0
        resultado.append({
            "id_estado_obra": est.id_estado_obra,
            "codigo_estado": est.codigo_estado,
            "descripcion": est.descripcion,
            "cantidad_obras": cant,
            "porcentaje": porcentaje,
        })

    return {
        "total_obras": total_obras,
        "estados": resultado,
    }


def calcular_facturas_por_estado():
    """
    KPI agregado de facturas por estado de pago.
    """
    facturas = (
        Factura.objects.filter(soft_deleted=False)
        .values("estado_pago")
        .annotate(
            cantidad=Count("id_factura"),
            monto_total=Sum("monto_total"),
            saldo_pendiente=Sum("saldo_pendiente"),
        )
        .order_by("estado_pago")
    )
    return list(facturas)


def obtener_kpis_completos():
    """
    KPIs y Consultas Agregadas consolidadas:
    - facturacion (total facturado, cobrado, estimado, facturas por estado)
    - obras_por_estado (conteo y porcentaje por estado)
    - morosidad (deuda vencida, porcentaje, cantidad de facturas y clientes morosos)
    """
    facturas_estado = calcular_facturas_por_estado()

    return {
        "facturacion": {
            "total_facturado": str(calcular_total_facturado()),
            "total_cobrado": str(calcular_total_cobrado()),
            "presupuesto_estimado": str(calcular_total_estimado_obras()),
            "deuda_pendiente": str(calcular_deuda_pendiente()),
            "saldo_estimado_por_cobrar": str(calcular_saldo_estimado_por_cobrar()),
            "facturas_por_estado": [
                {
                    "estado_pago": f["estado_pago"],
                    "cantidad": f["cantidad"],
                    "monto_total": str(f["monto_total"] or Decimal("0.00")),
                    "saldo_pendiente": str(f["saldo_pendiente"] or Decimal("0.00")),
                }
                for f in facturas_estado
            ],
        },
        "obras_por_estado": calcular_obras_por_estado(),
        "morosidad": {
            "deuda_vencida": str(calcular_deuda_vencida()),
            "deuda_pendiente": str(calcular_deuda_pendiente()),
            "porcentaje_morosidad": str(calcular_porcentaje_morosidad()),
            "facturas_vencidas_cantidad": calcular_conteo_facturas_morosas(),
            "clientes_morosos_cantidad": calcular_clientes_morosos(),
        },
    }
def obtener_agregacion_facturacion_mensual():
    """
    Agrupa facturación emitida vs saldo pendiente por mes de emisión.
    """
    datos = (
        Factura.objects.filter(soft_deleted=False)
        .annotate(mes=TruncMonth("fecha_emision"))
        .values("mes")
        .annotate(
            total_facturado=Sum("monto_total"),
            saldo_pendiente=Sum("saldo_pendiente"),
            cantidad_facturas=Count("id_factura"),
        )
        .order_by("mes")
    )
    resultado = []
    for fila in datos:
        facturado = fila["total_facturado"] or Decimal("0.00")
        pendiente = fila["saldo_pendiente"] or Decimal("0.00")
        cobrado = max(facturado - pendiente, Decimal("0.00"))
        resultado.append({
            "mes": fila["mes"].strftime("%Y-%m") if fila["mes"] else "Sin fecha",
            "facturado": float(facturado),
            "cobrado": float(cobrado),
            "pendiente": float(pendiente),
            "cantidad_facturas": fila["cantidad_facturas"],
        })
    return resultado

def obtener_agregacion_morosidad_clientes():
    """
    Top clientes con deuda vencida y facturas pendientes para gráfico de morosidad.
    """
    hoy = timezone.localdate()
    morosos = (
        Factura.objects.filter(
            soft_deleted=False,
            saldo_pendiente__gt=0,
            fecha_vencimiento__lt=hoy,
        )
        .values("cliente__razon_social", "cliente__rut_empresa")
        .annotate(
            deuda_vencida=Sum("saldo_pendiente"),
            facturas_vencidas=Count("id_factura"),
        )
        .order_by("-deuda_vencida")[:8]
    )
    return [
        {
            "cliente": m["cliente__razon_social"],
            "rut": m["cliente__rut_empresa"],
            "deuda_vencida": float(m["deuda_vencida"] or Decimal("0.00")),
            "facturas_vencidas": m["facturas_vencidas"],
        }
        for m in morosos
    ]

def obtener_agregacion_presupuesto_vs_real():
    """
    Compara costo estimado vs costo real por tipo de servicio.
    """
    servicios = (
        Obra.objects.filter(soft_deleted=False)
        .values("tipo_servicio__nombre_servicio")
        .annotate(
            cantidad=Count("id_obra"),
            estimado=Sum("costo_estimado"),
            real=Sum("costo_real"),
        )
        .order_by("-estimado")
    )
    return [
        {
            "servicio": s["tipo_servicio__nombre_servicio"],
            "cantidad": s["cantidad"],
            "costo_estimado": float(s["estimado"] or Decimal("0.00")),
            "costo_real": float(s["real"] or Decimal("0.00")),
        }
        for s in servicios
    ]