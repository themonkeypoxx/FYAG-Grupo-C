import os
from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from xhtml2pdf import pisa
from django.contrib.staticfiles import finders


def link_callback(uri, rel):
    if uri.startswith(settings.STATIC_URL):
        path = uri.replace(settings.STATIC_URL, "", 1)
        result = finders.find(path)
        if result:
            if isinstance(result, (list, tuple)):
                result = result[0]
            return os.path.realpath(result)
        # Fallback: STATIC_ROOT (producción tras collectstatic)
        fallback = os.path.join(settings.STATIC_ROOT or "", path)
        if os.path.isfile(fallback):
            return fallback
        raise FileNotFoundError(f"Recurso no encontrado: {path}")

    if settings.MEDIA_URL and uri.startswith(settings.MEDIA_URL):
        path = os.path.join(settings.MEDIA_ROOT, uri.replace(settings.MEDIA_URL, "", 1))
        if os.path.isfile(path):
            return path
        raise FileNotFoundError(f"Recurso no encontrado: {path}")
    return uri

def render_pdf(template_name, context, filename):
    html = render_to_string(template_name, context)
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    result = pisa.CreatePDF(html, dest=response, encoding="utf-8", link_callback=link_callback)
    if result.err:
        return HttpResponse("Error al generar el PDF", status=500)
    return response