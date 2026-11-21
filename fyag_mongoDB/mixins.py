# esto lo hice para no seguir agrandando el monolito q hay en fichas_obras/views.py -Ismael

# dps en cada viewset esto solo se hereda. 

from .servicios import registrar_evento

class AuditModelViewSetMixin:
    recurso_nombre = None  

    def get_recurso_nombre(self):
        if self.recurso_nombre:
            return self.recurso_nombre
        # x defecto toma el nombre del modelo
        queryset = getattr(self, "queryset", None)
        if queryset is None:
            queryset = self.get_queryset()
        return queryset.model.__name__

    def perform_create(self, serializer):
        instance = serializer.save()
        registrar_evento(
            request=self.request,
            accion="CREAR",
            recurso=self.get_recurso_nombre(),
            recurso_id=instance.pk,
            detalles=serializer.data
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        registrar_evento(
            request=self.request,
            accion="EDITAR",
            recurso=self.get_recurso_nombre(),
            recurso_id=instance.pk,
            detalles=serializer.data
        )

    def perform_destroy(self, instance):
        pk = instance.pk
        instance.delete()
        registrar_evento(
            request=self.request,
            accion="ELIMINAR",
            recurso=self.get_recurso_nombre(),
            recurso_id=pk
        )
