from rest_framework import serializers


def normalizar_rut(valor: str) -> str:
    """Devuelve el RUT como '76123456-7' (sin puntos, DV en mayúscula)."""
    rut = valor.replace(".", "").replace("-", "").replace(" ", "").upper()
    return f"{rut[:-1]}-{rut[-1]}"


def validar_rut(valor: str) -> str:
    rut = normalizar_rut(valor)
    cuerpo, dv = rut.split("-")
    if not cuerpo.isdigit() or len(cuerpo) < 7:
        raise serializers.ValidationError("RUT inválido.")

    suma, mult = 0, 2
    for digito in reversed(cuerpo):
        suma += int(digito) * mult
        mult = mult + 1 if mult < 7 else 2

    resto = 11 - (suma % 11)
    esperado = "0" if resto == 11 else "K" if resto == 10 else str(resto)
    if dv != esperado:
        raise serializers.ValidationError("El dígito verificador del RUT no es correcto.")
    return rut