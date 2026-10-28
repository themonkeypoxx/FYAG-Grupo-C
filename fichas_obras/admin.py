from django.contrib import admin
from .models import Cliente, EstadoObra, Obra, TipoServicio

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("razon_social", "rut_empresa", "ciudad", "estado_cliente", "soft_deleted")
    list_filter = ("estado_cliente", "soft_deleted")
    search_fields = ("razon_social", "rut_empresa")


@admin.register(Obra)
class ObraAdmin(admin.ModelAdmin):
    list_display = ("codigo_obra", "nombre_obra", "cliente", "estado_obra", "soft_deleted")
    list_filter = ("estado_obra", "tipo_servicio", "soft_deleted")
    search_fields = ("codigo_obra", "nombre_obra")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # No ofrecer clientes "eliminados" (soft delete) al crear obras
        if db_field.name == "cliente":
            kwargs["queryset"] = Cliente.objects.filter(soft_deleted=False).order_by("razon_social")
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


admin.site.register(TipoServicio)
admin.site.register(EstadoObra)