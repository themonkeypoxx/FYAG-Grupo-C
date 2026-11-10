from rest_framework.permissions import BasePermission

# Comentarios dejados en este script son para entender el código
# Estoy conciente de que todos estamos aprendiendo sobre la marcha
# y si no dejo por escrito lo que hago puedo olvidarlo. Considerar sacarlos
# para la entrega final el 30 de noviembre -Ismael

# Esta clase es un ejemplo de permiso personalizado para verificar si un 
# usuario pertenece a un rol específico.
class EsRol(BasePermission):
    rol_requerido = None
    roles_alternativos = []

    # DRF llama a este método cada vez que una petición llega.
    # Si el usuario está autenticado pero no tiene el rol, DRF genera HTTP 403 Forbidden.
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        roles = [self.rol_requerido] + (self.roles_alternativos or [])
        return (
            request.user.groups.filter(name__in=roles).exists()
            or any(request.user.groups.filter(name__iexact=r).exists() for r in roles)
        )

class EsGerencial(EsRol):
    rol_requerido = "Gerencial"
    roles_alternativos = ["GERENCIA", "Gerente", "Gerencia"]

class EsSupervisor(EsRol):
    rol_requerido = "Supervisor"
    roles_alternativos = ["SUPERVISOR"]

class EsAdministrativo(EsRol):
    rol_requerido = "Administrativo"
    roles_alternativos = ["ADMINISTRATIVO"]

class EsTecnico(EsRol):
    rol_requerido = "Tecnico"
    roles_alternativos = ["TECNICO"]
